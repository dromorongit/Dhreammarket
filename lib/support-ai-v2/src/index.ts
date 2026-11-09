/**
 * Dhream Market Support AI core — public exports.
 *
 * This folder is designed to be copied unchanged into the Dhream Market
 * Next.js codebase as lib/support-ai-v2/. Zero runtime dependencies, no
 * framework/DB/network/LLM imports.
 */

// Types
export type {
  Role,
  RiskLevel,
  Action,
  Intent,
  RawInbound,
  NormalizedInbound,
  HistoryTurn,
  SensitiveKind,
  RedactionFinding,
  RedactedMessage,
  Actor,
  Session,
  IntentResult,
  SecurityFlagType,
  SecurityFlags,
  RiskReason,
  RiskAssessment,
  RetrievalSummary,
  ConfidenceBreakdown,
  Decision,
  DraftAnswer,
  Violation,
  SupportResponse,
  AuditEvent,
  ReasonCode,
  SessionPort,
  RetrieverPort,
  GeneratorPort,
  ValidatorPort,
  EscalationPort,
  AuditSink,
  Clock,
  IdGenerator,
  RetrievalSource,
} from './types'

// Sanitize
export { normalize, foldForScan, MAX_TEXT_LENGTH } from './sanitize/normalize'
export { validateInput, VALIDATION_REASONS } from './sanitize/validate-input'
export { redact, redactForLog, PLACEHOLDERS } from './sanitize/redact'
export {
  COLLISION_GUARD,
  MIN_FUZZY_LENGTH,
  TYPO_MAP,
  FUZZY_LEXICON,
  fuzzyMatch,
  normalizeScanCopy,
  normalizeTypoCopy,
} from './sanitize/fuzzy'

// Identity
export { resolveRole, ROLE_MAP } from './identity/resolve-role'

// Classification
export { INTENTS, HIGH_RISK_INTENT_IDS, intentDef, roleAllowed } from './classify/intents'
export { classifyIntent, MATCHERS } from './classify/classify-intent'
export { applySecretRouting, secretExposureIntent } from './classify/secret-routing'
export {
  OFF_TOPIC_FAMILIES,
  MARKETPLACE_VOCABULARY,
  hasMarketplaceVocabulary,
  isOffTopic,
  offTopicFamily,
} from './classify/off-topic'

// Risk
export { assessRisk, raiseRisk, raiseForRetrieval } from './risk/assess-risk'
export {
  HIGH_RISK_KEYWORDS,
  DISTRESS_PATTERNS,
  RULE_TOPIC_FAMILIES,
  SENSITIVE_WORDS,
  detectPersonalCase,
  detectInformational,
} from './risk/keywords'

// Security
export { scan, scanRetrievedText } from './security/scan'
export { SECURITY_PATTERNS } from './security/patterns'

// Scope
export { checkScope } from './scope/check-scope'

// Decision
export { CONF, computeConfidence } from './decision/confidence'
export { decide } from './decision/decide'

// Escalation
export { templateText, TEMPLATES, TEMPLATE_IDS } from './escalation/templates'
export { buildEscalationPlan } from './escalation/plan'

// Pipeline
export { handleSupportMessage } from './pipeline/handle-message'
export type { PipelineDeps } from './pipeline/handle-message'

// State machine
export { transition, isTerminal } from './state-machine'
export type { State, Event } from './state-machine'
