/**
 * Pipeline orchestrator (dependency-injected, pure core).
 *
 * Order of work:
 *   validate -> redact -> resolve role -> security scan (block -> REFUSE)
 *   -> classify -> assess risk -> scope -> retrieval (only if in scope)
 *   -> raise risk for retrieval gaps -> confidence -> decide
 *   -> ANSWER: generate + validate (<= 1 retry)
 *      else: escalate / refuse / clarify.
 *
 * Raw user text is used ONLY inside the sanitize stage. Every port call and
 * every audit event receives redacted text (or no text) only. Any error,
 * port failure or redactor failure fails closed to a FAILED_SAFE escalation.
 *
 * Nothing here touches a database, network, LLM or framework. Role comes from
 * the verified session only; message text is never trusted for role.
 */

import type {
  RetrievalSummary,
  IntentResult,
  RiskAssessment,
  Actor,
  Decision,
  SupportResponse,
  HistoryTurn,
  SessionPort,
  RetrieverPort,
  GeneratorPort,
  ValidatorPort,
  EscalationPort,
  AuditSink,
  Clock,
  IdGenerator,
  Role,
  ReasonCode,
} from '../types'
import { validateInput } from '../sanitize/validate-input'
import { redact } from '../sanitize/redact'
import { resolveRole } from '../identity/resolve-role'
import { scan } from '../security/scan'
import { classifyIntent } from '../classify/classify-intent'
import { applySecretRouting } from '../classify/secret-routing'
import { assessRisk, raiseForRetrieval } from '../risk/assess-risk'
import { checkScope } from '../scope/check-scope'
import { roleAllowed } from '../classify/intents'
import { computeConfidence } from '../decision/confidence'
import { decide } from '../decision/decide'
import { buildEscalationPlan } from '../escalation/plan'
import { templateText, TEMPLATE_IDS } from '../escalation/templates'
import { transition, isTerminal, type State } from '../state-machine'

export interface PipelineDeps {
  session: SessionPort
  retriever?: RetrieverPort
  generator: GeneratorPort
  validator: ValidatorPort
  escalation: EscalationPort
  audit: AuditSink
  clock: Clock
  ids: IdGenerator
  // Server-side conversation history. NEVER taken from the client.
  loadHistory?: (conversationId: string) => HistoryTurn[]
}

const INVALID_INPUT_MESSAGE =
  'I could not process that message. Please try again with a short text.'

function emptyRetrieval(): RetrievalSummary {
  return { usableChunkCount: 0, coverage: 0, topChunkScore: 0, conflicts: [], stale: [] }
}

function clarifyCountFromHistory(history: HistoryTurn[]): number {
  let n = 0
  for (const t of history) n += t.clarifyCount ?? 0
  return n
}

function readConversationId(raw: unknown): string {
  if (raw && typeof raw === 'object') {
    const c = (raw as Record<string, unknown>).conversationId
    if (typeof c === 'string') return c
  }
  return ''
}

export async function handleSupportMessage(raw: unknown, deps: PipelineDeps): Promise<SupportResponse> {
  const traceId = deps.ids.generate()
  let curState: State = 'RECEIVED'
  let curIntent: IntentResult | null = null
  let curRisk: RiskAssessment | null = null
  let curRole: Role | null = null
  let conversationId = ''
  let confidence: number | null = null

  const advance = (event: Parameters<typeof transition>[1]): void => {
    curState = transition(curState, event)
  }
  const emit = (state: string, codes: ReasonCode[]): void => {
    // A throwing audit sink must never crash the pipeline (or fail-safe).
    try {
      deps.audit.emit({
        traceId,
        state,
        reasonCodes: codes,
        intent: curIntent ? curIntent.intent : null,
        riskLevel: curRisk ? curRisk.level : null,
        role: curRole,
        redacted: true,
        conversationId,
        retrievalSources: [],
        confidence,
        timestamp: deps.clock.now(),
      })
    } catch {
      /* ignore */
    }
  }

  const failSafe = async (): Promise<SupportResponse> => {
    try {
      if (!isTerminal(curState)) curState = transition(curState, 'error')
    } catch {
      /* ignore */
    }
    emit('FAILED_SAFE', ['SYSTEM_ERROR'])
    // Best-effort escalation ticket (never throws out of fail-safe).
    try {
      await deps.escalation.escalate('SYSTEM_ERROR', 'general', 'normal', TEMPLATE_IDS.FAILED_SAFE)
    } catch {
      /* ignore */
    }
    return {
      action: 'ESCALATE',
      message: templateText(TEMPLATE_IDS.FAILED_SAFE),
      reasonCode: 'SYSTEM_ERROR',
      traceId,
      escalationTag: 'SYSTEM_ERROR',
    }
  }

  try {
    const conversationIdValue = readConversationId(raw)
    conversationId = conversationIdValue
    const history = deps.loadHistory ? deps.loadHistory(conversationIdValue) : []
    const validation = validateInput(raw, history)

    if (!validation.valid || !validation.normalized) {
      advance('input_invalid') // -> REFUSED
      const reason = (validation.reasonCode ?? 'INVALID_INPUT_NOT_STRING') as ReasonCode
      emit('REFUSED', [reason])
      return { action: 'REFUSE', message: INVALID_INPUT_MESSAGE, reasonCode: reason, traceId }
    }

    const normalized = validation.normalized

    // --- Sanitize: redact (fail closed on error) ---
    let redacted
    try {
      redacted = redact(normalized.text)
    } catch {
      return failSafe()
    }

    advance('input_valid') // RECEIVED -> SANITIZED
    emit('SANITIZED', [])
    advance('redacted') // SANITIZED -> ROLE_RESOLVED

    // --- Identity + security scan (on the folded scan copy only) ---
    const session = deps.session.getSession()
    const actor: Actor = resolveRole(session)
    curRole = actor.role

    const security = scan(normalized.text, normalized.foldedText, actor)
    if (security.block) {
      // A security block is a high-risk event, so the audit event must show it:
      // risk high with the SECURITY_BLOCK reason, not a missing risk.
      curRisk = assessRisk({
        intent: {
          intent: 'unknown',
          confidence: 0,
          source: 'rules',
          policyDependent: false,
          personalCase: false,
          signals: [],
        },
        security,
        secretExposed: redacted.secretExposed,
        text: redacted.text,
        actor,
      })
      advance('security_block') // ROLE_RESOLVED -> REFUSED
      emit('REFUSED', ['SECURITY_BLOCK'])
      return {
        action: 'REFUSE',
        message: templateText(TEMPLATE_IDS.REFUSED_SECURITY),
        reasonCode: 'SECURITY_BLOCK',
        traceId,
      }
    }

    advance('classified') // ROLE_RESOLVED -> CLASSIFIED

    // --- Classify + risk ---
    // A secret exposed in the chat routes the case to the security queue,
    // whatever else the message says.
    const intent = applySecretRouting(classifyIntent(redacted.text), redacted.findings)
    curIntent = intent
    const risk0 = assessRisk({
      intent,
      security,
      secretExposed: redacted.secretExposed,
      text: redacted.text,
      actor,
    })

    advance('security_cleared') // CLASSIFIED -> SECURITY_CHECKED

    // --- Scope ---
    const scope = checkScope(intent, actor)
    advance('scope_checked') // SECURITY_CHECKED -> SCOPE_CHECKED

    // --- Retrieval (only if in scope) ---
    let retrieval = emptyRetrieval()
    if (scope.inScope) {
      try {
        retrieval = deps.retriever
          ? await deps.retriever.retrieve(intent.intent, redacted.text, actor)
          : emptyRetrieval()
      } catch {
        return failSafe()
      }
      advance('retrieved') // SCOPE_CHECKED -> RETRIEVED
    } else {
      advance('decided') // SCOPE_CHECKED -> DECIDED
    }

    // --- Raise risk for retrieval gaps (monotonic, only when we retrieved) ---
    const risk = scope.inScope ? raiseForRetrieval(risk0, intent, retrieval) : risk0
    curRisk = risk
    if (scope.inScope) advance('decided') // RETRIEVED -> DECIDED

    // --- Confidence + decision ---
    const roleFit = roleAllowed(intent.intent, actor.role) ? 1 : 0
    const breakdown = computeConfidence({
      intentConfidence: intent.confidence,
      coverage: retrieval.coverage,
      topChunkScore: retrieval.topChunkScore,
      roleFit,
    })
    confidence = breakdown.score
    const clarifyCount = clarifyCountFromHistory(history)
    const decision = decide({ security, risk, scope, intent, retrieval, confidence: breakdown, clarifyCount })
    emit('DECIDED', [decision.reason])

    switch (decision.action) {
      case 'REFUSE': {
        advance('refused') // DECIDED -> REFUSED
        emit('REFUSED', [decision.reason])
        return {
          action: 'REFUSE',
          message: templateText(decision.templateId ?? TEMPLATE_IDS.REFUSED_OUT_OF_SCOPE),
          reasonCode: decision.reason,
          traceId,
        }
      }

      case 'CLARIFY': {
        advance('clarified') // DECIDED -> CLARIFYING
        emit('CLARIFYING', ['CLARIFY'])
        return {
          action: 'CLARIFY',
          message: templateText(decision.templateId ?? TEMPLATE_IDS.CLARIFY_GENERIC),
          reasonCode: 'CLARIFY',
          traceId,
        }
      }

      case 'ESCALATE': {
        advance('escalated') // DECIDED -> ESCALATED
        const plan = buildEscalationPlan(decision, intent, risk, actor.role)
        await deps.escalation.escalate(plan.tag, plan.queueCategory, plan.priority, plan.templateId)
        emit('ESCALATED', [decision.reason])
        return {
          action: 'ESCALATE',
          message: templateText(plan.templateId),
          reasonCode: decision.reason,
          traceId,
          escalationTag: plan.tag,
        }
      }

      case 'ANSWER': {
        advance('generate') // DECIDED -> GENERATING
        let attempt = 0
        for (;;) {
          const draft = await deps.generator.generate(intent.intent, redacted.text, retrieval, actor)
          advance('validated') // GENERATING -> VALIDATING
          const result = await deps.validator.validate(draft, intent.intent, risk, retrieval, actor)

          if (result.ok) {
            advance('answered') // VALIDATING -> ANSWERED
            emit('ANSWERED', ['ANSWERED'])
            return { action: 'ANSWER', message: draft.text, reasonCode: 'ANSWERED', traceId }
          }

          if (attempt === 0) {
            attempt = 1
            advance('validation_failed') // VALIDATING -> GENERATING (retry once)
            continue
          }

          // Validation failed twice -> escalate.
          advance('escalated') // VALIDATING -> ESCALATED
          const decision2: Decision = { action: 'ESCALATE', reason: 'VALIDATION_FAILURE' }
          const plan = buildEscalationPlan(decision2, intent, risk, actor.role)
          await deps.escalation.escalate(plan.tag, plan.queueCategory, plan.priority, plan.templateId)
          emit('ESCALATED', ['VALIDATION_FAILURE'])
          return {
            action: 'ESCALATE',
            message: templateText(plan.templateId),
            reasonCode: 'VALIDATION_FAILURE',
            traceId,
            escalationTag: plan.tag,
          }
        }
      }

      default: {
        return failSafe()
      }
    }
  } catch {
    return failSafe()
  }
}
