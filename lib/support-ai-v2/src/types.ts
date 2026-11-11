/**
 * Dhream Market Support AI core — deterministic safety pipeline.
 *
 * This module is a pure-function TypeScript library with ZERO runtime
 * dependencies. It is designed to be copied unchanged into the Dhream
 * Market Next.js codebase as lib/support-ai-v2/.
 *
 * Nothing in this module may approve refunds, change payouts, modify
 * accounts, approve KYC, suspend users or access another user's data.
 */

// --- Roles ---------------------------------------------------------------

export type Role = 'visitor' | 'buyer' | 'vendor' | 'support_agent'

// --- Risk ----------------------------------------------------------------

export type RiskLevel = 'low' | 'medium' | 'high'

// --- Actions -------------------------------------------------------------

export type Action = 'ANSWER' | 'CLARIFY' | 'ESCALATE' | 'REFUSE'

// --- Intent taxonomy -----------------------------------------------------

export type Intent =
  | 'general.greeting'
  | 'general.about_platform'
  | 'buyer.how_to_order'
  | 'buyer.payment_methods_info'
  | 'buyer.delivery_info'
  | 'buyer.returns_policy_info'
  | 'buyer.order_status'
  | 'buyer.track_order_info'
  | 'buyer.cancellation_info'
  | 'vendor.onboarding_guide'
  | 'vendor.listing_guide'
  | 'vendor.store_management_guide'
  | 'vendor.fees_plans_info'
  | 'vendor.payout_info_general'
  | 'vendor.kyc_info_general'
  | 'agent.procedure_lookup'
  | 'account.help_general'
  | 'dispute.refund_request'
  | 'dispute.chargeback_or_payment'
  | 'risk.fraud_report'
  | 'risk.account_takeover'
  | 'risk.payment_security'
  | 'vendor.payout_problem'
  | 'vendor.kyc_failure'
  | 'account.suspension_reinstatement'
  | 'legal.privacy_data_request'
  | 'security.prompt_injection'
  | 'security.unauthorized_access'
  | 'abuse.harassment'
  | 'out_of_scope'
  | 'unknown'

// --- Inbound / normalized -------------------------------------------------

export interface RawInbound {
  text: string
  conversationId: string
  history?: HistoryTurn[]
  attachments?: string[]
}

export interface NormalizedInbound {
  text: string
  foldedText: string
  hasUrl: boolean
  conversationId: string
  history: HistoryTurn[]
  attachments: string[]
}

export interface HistoryTurn {
  role: 'user' | 'agent'
  text: string
  clarifyCount?: number
}

// --- Redaction ------------------------------------------------------------

export type SensitiveKind =
  | 'card_number'
  | 'otp'
  | 'pin'
  | 'password'
  | 'cvv'
  | 'phone'
  | 'email'
  | 'national_id'
  | 'momo_number'

export interface RedactionFinding {
  kind: SensitiveKind
  start: number
  end: number
}

export interface RedactedMessage {
  text: string
  findings: RedactionFinding[]
  secretExposed: boolean
}

// --- Identity -------------------------------------------------------------

export interface Actor {
  role: Role
  userId?: string
  authenticated: boolean
}

/** Already-verified session data supplied by the caller (never decoded here). */
export interface Session {
  authenticated: boolean
  role?: string
  userId?: string
}

// --- Classification -------------------------------------------------------

export interface IntentResult {
  intent: Intent
  confidence: number
  source: 'rules' | 'llm'
  policyDependent: boolean
  personalCase: boolean
  signals: string[]
  /**
   * True when the answer can only come from an approved document. A missing,
   * conflicting or stale document is then a POLICY_GAP.
   */
  needsApprovedContent?: boolean
  /**
   * How to clarify a message we understand but that is too vague.
   *   'topic'  - the message is a bare topic word ("refund", "my account"):
   *               ask whether the user wants general information or help with
   *               a specific order or account.
   *   'generic'- ask for more detail.
   * Undefined means the message is a clear personal or informational case.
   */
  clarifyMode?: 'topic' | 'generic'
}

// --- Security -------------------------------------------------------------

export type SecurityFlagType =
  | 'prompt_injection'
  | 'unauthorized_access'
  | 'role_spoofing'
  | 'abuse'
  | 'threat'
  | 'exfiltration'
  | 'action_request'

export interface SecurityFlags {
  flags: SecurityFlagType[]
  block: boolean
}

// --- Reason codes (string unions, never free text) -----------------------

export type ReasonCode =
  // Decision-level reasons
  | 'ANSWERED'
  | 'OUT_OF_SCOPE'
  | 'SECURITY_BLOCK'
  | 'HIGH_RISK'
  | 'POLICY_GAP'
  | 'LOW_CONFIDENCE'
  | 'UNRESOLVED'
  | 'VALIDATION_FAILURE'
  | 'SYSTEM_ERROR'
  | 'CLARIFY'
  // Input validation
  | 'INVALID_INPUT_NOT_STRING'
  | 'INVALID_INPUT_EMPTY'
  | 'INVALID_INPUT_TOO_LONG'
  | 'INVALID_CONVERSATION_ID'
  | 'INVALID_HISTORY'
  // Risk reasons
  | 'HIGH_RISK_INTENT'
  | 'FRAUD_OR_SCAM'
  | 'ACCOUNT_TAKEOVER'
  | 'UNAUTHORIZED_ACTIVITY'
  | 'FAKE_PARTY'
  | 'SUSPICIOUS_PAYMENT'
  | 'SHARED_SECRET'
  | 'CARD_MISUSE'
  | 'I_WAS_SCAMMED'
  | 'HIGH_KEYWORD'
  | 'POLICY_DEPENDENT'
  | 'SECRET_EXPOSED'
  | 'LOW_CONF_SENSITIVE'
  | 'DISTRESS'
  | 'SECURITY_THREAT'
  | 'ABUSE'
  | 'ACTION_REQUEST'
  | 'PRIVATE_DATA_NEEDED'
  | 'ROLE_MISMATCH'

// --- Risk -----------------------------------------------------------------

export interface RiskReason {
  code: ReasonCode
  detail?: string
}

export interface RiskAssessment {
  level: RiskLevel
  reasons: RiskReason[]
}

// --- Retrieval ------------------------------------------------------------

export interface RetrievalSummary {
  usableChunkCount: number
  coverage: number
  topChunkScore: number
  conflicts: string[]
  stale: string[]
}

// --- Confidence -----------------------------------------------------------

export interface ConfidenceBreakdown {
  intent: number
  retrieval: number
  roleFit: number
  score: number
}

// --- Decision -------------------------------------------------------------

export interface Decision {
  action: Action
  reason: ReasonCode
  templateId?: string
  escalationTag?: string
}

// --- Generation -----------------------------------------------------------

export interface DraftAnswer {
  text: string
}

export interface Violation {
  code: string
  detail?: string
}

// --- Response -------------------------------------------------------------

export interface SupportResponse {
  action: Action
  message: string
  reasonCode: ReasonCode
  traceId: string
  escalationTag?: string
}

// --- Audit ----------------------------------------------------------------

export interface AuditEvent {
  traceId: string
  state: string
  reasonCodes: ReasonCode[]
  intent: Intent | null
  riskLevel: RiskLevel | null
  role: Role | null
  redacted: boolean
  timestamp: number
  /** Server-side conversation id; never taken from the client. */
  conversationId: string
  /** Documents used to answer, cited by id, title and version. No free-form user text. */
  retrievalSources: RetrievalSource[]
  confidence: number | null
  escalationReasonCode?: ReasonCode
  ticketId?: string
  feedback?: {
    helpful: boolean
    reason?: string
  }
}

export interface RetrievalSource {
  documentId: string
  title: string
  version: number
}

// --- Ports (interfaces) ---------------------------------------------------

export interface SessionPort {
  getSession(): Session | null
}

export interface RetrieverPort {
  retrieve(intent: Intent, redactedText: string, actor: Actor): Promise<RetrievalSummary>
}

export interface GeneratorPort {
  generate(intent: Intent, redactedText: string, retrieval: RetrievalSummary, actor: Actor): Promise<DraftAnswer>
}

export interface ValidatorPort {
  validate(
    draft: DraftAnswer,
    intent: Intent,
    risk: RiskAssessment,
    retrieval: RetrievalSummary,
    actor: Actor,
  ): Promise<{ ok: boolean; violations: Violation[] }>
}

export interface EscalationPort {
  escalate(tag: string, queueCategory: string, priority: string, templateId: string, conversationRef?: string, escalationReason?: string): Promise<string>
}

export interface AuditSink {
  emit(event: AuditEvent): void
}

export interface Clock {
  now(): number
}

export interface IdGenerator {
  generate(): string
}