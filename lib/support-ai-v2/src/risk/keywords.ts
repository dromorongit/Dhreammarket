/**
 * Keyword families and detectors shared by the classifier and the risk
 * engine. Kept in one place so the two never drift apart.
 *
 * All patterns run on the NORMALIZED user text (never the folded scan copy,
 * unless noted). Everything here is deterministic and extendable.
 */

import type { ReasonCode } from '../types'
import { normalizeScanCopy } from '../sanitize/fuzzy'

// --- Personal-case vs informational ------------------------------------
//
// A "personal case" means the user is talking about THEIR OWN order, money,
// account, etc. An "informational" question is about how the platform works
// in general. This split drives both classification and the risk level.
//
// A bare "I" or "my" is NOT a case fact. "How do I reset my password" and
// "how do I change my phone number in settings" are ordinary self-service
// questions, not personal cases, so they must not be escalated.
//
// NOTE FOR THE OWNER: these wordlists need review/tuning against a labelled
// set. They are intentionally conservative.

/** Money that moved, or did not move, in the user's own case. */
const CASE_FACT_MONEY = /\b(paid|charged|deducted|debited|taken|withdrawn)\b/i
/** A transaction that did not go through. */
const CASE_FACT_FAILURE = /\b(failed|declined|rejected|reversed)\b/i
/** The state of the user's own account. */
const CASE_FACT_ACCOUNT =
  /\bmy account\b[^.?!]{0,24}\b(suspend\w*|lock\w*|ban\w*|disabled|closed|blocked)\b|\b(suspend\w*|lock\w*|ban\w*|disabled|closed|blocked)\b[^.?!]{0,24}\bmy account\b/i
/** Somebody else has the account. */
const CASE_FACT_COMPROMISE = /\b(hacked|stolen|taken over|compromised)\b/i
/** Something the user is waiting for is missing or late. */
const CASE_FACT_LOSS = /\b(lost|missing|delayed|never (came|arrived|showed up|credited))\b/i
/** "has not arrived", "did not receive", "never received", "do not arrive".
 *
 * "don" is the Pidgin negation ("don arrive" = "does not arrive"). It is
 * listed here, and NOT in the typo map, because the typo map must never
 * rewrite a person's name. The case fact is a word family, not a message.
 */
const CASE_FACT_NOT_RECEIVED =
  /\b(has|have|had) not (arrived|received|come|shown up|credited|resolved)\b|\b(do not|does not|did not|didn'?t|didnt|never|don) (receive|arrive|get|see|credit|refund|show|come)\w*/i
/** "not working" - only a case fact when it is about money or access. */
const CASE_FACT_NOT_WORKING = /\b(not working|doesn'?t work|is not working|stopped working)\b/i
/** "I want / need / demand my money back". */
const CASE_FACT_MONEY_BACK =
  /\b(i|we)\s+(want|need|demand|require)\b[^.?!]{0,24}\b(a |my |the )?(refund|money|order|payout)\b|\bmy money back\b/i
/** A personal order lookup: the user's own order, not a how-to question. */
const CASE_FACT_ORDER_LOOKUP =
  /\b(where|when)('| i)?s (my|the) order\b|\bstatus of (my |the )?order\b|\bhas my order shipped\b/i
/** Somebody is using the user's own payment instrument. */
const CASE_FACT_CARD_MISUSE = /\bsomeone (is )?using my (card|account|details|money)\b/i
/** A request about the user's own personal data (legal / privacy). */
const CASE_FACT_LEGAL =
  /\b(delete|erase|export|remove|forget|withdraw|port)\b[^.?!]{0,24}\bmy (personal )?(data|information|details)\b/i
/** A dispute about the user's own transaction. */
const CASE_FACT_DISPUTE =
  /\b(dispute|charge ?back)\b[^.?!]{0,24}\b(transaction|payment|charge|order|refund)\b/i
/** The user's own order, payout, account, refund or money plus a state word. */
const POSSESSIVE_SUBJECT = /\bmy (order|payout|account|refund|money)\b/i
/** An active request about the user's own order, payout or money. */
const REQUEST_POSSESSIVE =
  /\b(refund|payout|charge ?back|chargeback)\b[^.?!]{0,12}\bmy (order|payout|account|refund|money)\b/i
const COMPLAINT_WORD =
  /\b(failed|missing|late|delay\w*|lost|stolen|hacked|charged|deducted|taken|not arrived|never|did not receive|want|need|demand|wait\w*|still|pending|finish\w*|complete\w*|process\w*|wrong|reversed|declined|rejected|suspended|locked|dispute\w*)\b/i

/**
 * HARD case facts: money that moved or did not move, a failed transaction,
 * an account state, a compromise, a personal data request, a personal
 * transaction dispute, a personal order lookup.
 *
 * A hard case fact makes the message a personal case even in a question form.
 */
const HARD_CASE_FACTS = new RegExp(
  [
    CASE_FACT_MONEY.source,
    CASE_FACT_FAILURE.source,
    CASE_FACT_ACCOUNT.source,
    CASE_FACT_COMPROMISE.source,
    CASE_FACT_LOSS.source,
    CASE_FACT_NOT_RECEIVED.source,
    CASE_FACT_MONEY_BACK.source,
    CASE_FACT_ORDER_LOOKUP.source,
    CASE_FACT_CARD_MISUSE.source,
    CASE_FACT_LEGAL.source,
    CASE_FACT_DISPUTE.source,
    // "not working" only counts when money or access is involved.
    `(?:${CASE_FACT_NOT_WORKING.source})(?=[^.?!]{0,40}(money|payment|order|payout|refund|account|login|app|website))`,
  ].join('|'),
  'i',
)

/**
 * A question form. A question with no hard case fact is INFORMATIONAL, even
 * when it contains "I", "my" or "me".
 */
export const QUESTION_FORM =
  /^(\s*)(what|whats|what'?s|how|why|when|where|which|who|whose|do|does|did|can|could|would|should|is|are|was|were|may|will)\b/i

/**
 * Personal-case signals: CASE FACTS only.
 *
 * A bare first person pronoun is deliberately NOT enough. The list is a
 * union of word families, never a memorised message.
 */
export const PERSONAL_SIGNALS = HARD_CASE_FACTS

/** The complaint/state word that turns "my order" into a personal case. */
export const COMPLAINT_SIGNAL = COMPLAINT_WORD

// Informational question forms. Start-anchored interrogatives (plus policy
// words) so first-person questions can be separated from general ones.
export const INFORMATIONAL_SIGNALS = new RegExp(
  `${QUESTION_FORM.source}|\\?|\\bpolicy\\b|\\bpolicies\\b|\\bis it possible\\b|\\bguide\\b|\\bfaq\\b`,
  'i',
)

export function detectPersonalCase(text: string): boolean {
  if (HARD_CASE_FACTS.test(text)) return true
  // A SOFT case fact: "my order ... missing", "refund my order". A question
  // form stays informational in that case ("how do I get a refund for my
  // order" is a question, not a case).
  if (
    (POSSESSIVE_SUBJECT.test(text) && COMPLAINT_WORD.test(text)) ||
    REQUEST_POSSESSIVE.test(text)
  ) {
    return !QUESTION_FORM.test(text)
  }
  return false
}

// Informational = a question/general form AND no personal-case signal.
export function detectInformational(text: string): boolean {
  return INFORMATIONAL_SIGNALS.test(text) && !detectPersonalCase(text)
}

/**
 * A message we understand but that is too vague: neither a personal case nor
 * an informational question. Such a message is clarified, never answered.
 */
export function detectUnclear(text: string): boolean {
  return !detectPersonalCase(text) && !detectInformational(text)
}

/**
 * A leading greeting or pleasantry. Stripped before the message is
 * classified, so "hello, how do I add products" is classified by the request
 * and not by the greeting.
 */
const PLEASANTRY_PREFIX =
  /^\s*(good\s+(morning|afternoon|evening|day)|hi|hello|hey|hiya|greetings|please|pls|thanks|thank\s+you)\b[\s,.!]*/i

/** Removes leading greetings and pleasantries. */
export function stripPleasantries(text: string): string {
  let out = text.trim()
  for (;;) {
    const m = out.match(PLEASANTRY_PREFIX)
    if (!m) break
    const rest = out.slice(m[0].length).trim()
    if (rest.length === 0) return ''
    out = rest
  }
  return out
}

// --- Bare topic words ----------------------------------------------------
//
// "refund", "payout", "my account": the user named a topic and nothing else.
// There is no case fact and nothing to answer yet, so the assistant asks ONE
// clarifying question (D1).
const TOPIC_WORD =
  /^(refund|refunds|payout|payouts|order|orders|account|accounts|money|payment|payments|charge|charges|chargeback|delivery|shipping|kyc|verification|seller|vendors?|buyers?|listing|listings|product|products|shipment|dispute|disputes|complaint|complaints|returns?|fees?)$/i

export function isBareTopicMessage(text: string): boolean {
  const cleaned = text.trim().replace(/[?!.]+$/, '').trim()
  if (cleaned.length === 0) return false
  const words = cleaned.split(/\s+/)
  if (words.length > 3) return false
  return words.every((w) => TOPIC_WORD.test(w) || /^(my|your|the|a|an)$/i.test(w))
}

// --- High-risk keyword families (H2a: no exemption) ----------------------

export interface KeywordRule {
  code: ReasonCode
  test: RegExp
}

export const HIGH_RISK_KEYWORDS: KeywordRule[] = [
  { code: 'FRAUD_OR_SCAM', test: /\b(scam|scammed|fraud|fraudulent|defraud\w*|phishing|phished)\b/i },
  {
    code: 'ACCOUNT_TAKEOVER',
    test: /\b(hacked|hacked my|account takeover|took over my account|taken over my account|my account (was |has been )?(taken over|hijacked|compromised)|someone logged in|someone is logged in|logged me out|logged out of my account)\b/i,
  },
  {
    code: 'UNAUTHORIZED_ACTIVITY',
    test: /\b(unauthori[sz]ed (transaction|login|access|charge|payment)|stolen|stole)\b/i,
  },
  { code: 'FAKE_PARTY', test: /\bfake (seller|buyer|vendor|product|listing|store)\b/i },
  { code: 'SUSPICIOUS_PAYMENT', test: /\bsuspicious (payment|link|email|activity|charge)\b/i },
  {
    code: 'SHARED_SECRET',
    test: /\b(shared|gave|told|sent|gave out)\b[^.?!]{0,25}\b(my\s+)?(otp|pin|password|card)\b/i,
  },
  { code: 'CARD_MISUSE', test: /\bsomeone (is )?using my (card|account|details|money)\b/i },
  { code: 'I_WAS_SCAMMED', test: /\bi (was )?(scammed|cheated|defrauded)\b/i },
]

// --- Severe distress / threats (H6) — CONSERVATIVE, NEEDS OWNER REVIEW ---
// These are carried as risk-reason DETAIL (the reason code is always
// DISTRESS), so their codes are free-form labels.
export interface DistressPattern {
  code: string
  test: RegExp
}

export const DISTRESS_PATTERNS: DistressPattern[] = [
  {
    code: 'THREAT_OF_HARM',
    test: /\b(i will|i'?ll|i'?m going to|im going to|gonna)\s+(kill|hurt|stab|shoot|beat|find|attack|come for)\b/i,
  },
  { code: 'THREAT_TARGET', test: /\b(kill|hurt|stab|shoot|beat)\s+(you|your family|him|her|them|myself|myself)\b/i },
  { code: 'SELF_HARM', test: /\b(kill myself|suicide|suicidal|end my life|end it all|self[ -]?harm|want to die|harm myself)\b/i },
  {
    code: 'SEVERE_DISTRESS',
    // Deliberately narrow; broad distress wording risks false positives and
    // MUST be reviewed by the owner before use.
    test: /\b(terrified|in danger|threatened (me|my))\b/i,
  },
]

// --- Sensitive money/identity/account words (H5) -------------------------
//
// RESTRICTED to money, loss and compromise vocabulary. Password, account,
// verify and two-factor wording used to live here, which escalated ordinary
// self-service questions ("how do I reset my password", "how do I verify my
// account") for no safety gain. Those are handled by the secret-exposure
// rules instead.
export const SENSITIVE_WORDS =
  /\b(money|payment|paid|charge|charged|deducted|refund|payout|balance|hacked|stolen|scam|fraud|unauthori[sz]ed|locked out|lost access)\b/i

/**
 * The groups a sensitive signal can belong to.
 *
 * money   - money in, money out, money missing
 * access  - the user cannot get into their own account
 * compromise - somebody else has the account, or is impersonating the user
 * other   - sensitive, but neither money nor access nor compromise
 */
export type SignalGroup = 'money' | 'access' | 'compromise' | 'other'

const MONEY_SIGNAL =
  /\b(money|payment|paid|charge|charged|deducted|refund|payout|balance)\b/i
const ACCESS_SIGNAL = /\b(locked out|lost access)\b/i
const COMPROMISE_SIGNAL = /\b(hacked|stolen|scam|fraud|unauthori[sz]ed)\b/i

/**
 * Which group a sensitive signal belongs to, or null when there is none.
 *
 * Runs on the typo-tolerant copy as well, so "monei" and "bak" still count.
 */
export function sensitiveSignalGroup(text: string): SignalGroup | null {
  const copies = [text, normalizeScanCopy(text.toLowerCase())]
  for (const copy of copies) {
    if (MONEY_SIGNAL.test(copy)) return 'money'
    if (ACCESS_SIGNAL.test(copy)) return 'access'
    if (COMPROMISE_SIGNAL.test(copy)) return 'compromise'
  }
  return null
}

// --- Topic families for the "unclear/personal/informational" risk rule ----
// (H2b: personal -> high; informational -> medium; unclear -> high.)
export interface RuleTopicFamily {
  code: string
  patterns: RegExp[]
}

export const RULE_TOPIC_FAMILIES: RuleTopicFamily[] = [
  {
    code: 'REFUND',
    patterns: [/\brefund\w*/i, /\bmoney back\b/i, /\breturn (my )?money\b/i, /\bget (a |my )?refund\b/i],
  },
  {
    code: 'PAYMENT_ISSUE',
    patterns: [
      /\bcharge ?back\b/i,
      /\bdispute\b/i,
      /\bdouble[ -]?charg\w*/i,
      /\bcharged twice\b/i,
      /\bpayment (failed|problem|error|issue)\b/i,
      /\bdeduct\w*/i,
      /\bwas charged\b/i,
      /\bpayment (did n'?t|didn'?t|did not) (go through|work)\b/i,
    ],
  },
  {
    code: 'PAYOUT',
    patterns: [
      /\bpayout\w*/i,
      /\bwithdraw\w*/i,
      /\bget paid\b/i,
      /\bwhen (will|do) i get paid\b/i,
      /\bpayout (missing|delayed|wrong)\b/i,
    ],
  },
  {
    code: 'KYC',
    patterns: [/\bkyc\b/i, /\bverif(ication|ied)\b[^.?!]{0,20}(fail\w*|reject\w*|stuck|denied|problem)/i, /\bmy kyc\b/i],
  },
  {
    code: 'ACCOUNT_STATE',
    patterns: [/\bsuspend\w*/i, /\bban(ned)?\b/i, /\breinstate\w*/i, /\baccount (is )?(locked|disabled|closed)\b/i],
  },
  {
    code: 'LEGAL_PRIVACY',
    patterns: [
      /\bdelete my (data|account|information)\b/i,
      /\bexport my data\b/i,
      /\bmy (personal )?data\b/i,
      /\bprivacy\b/i,
      /\bgdpr\b/i,
      /\blawyer\b/i,
      /\bcourt\b/i,
      /\bpolice\b/i,
      /\bsue\b/i,
      /\blegal (action|threat)\b/i,
    ],
  },
]

export function matchedRuleFamily(families: { code: string; patterns: RegExp[] }[], text: string): string | null {
  for (const fam of families) {
    if (fam.patterns.some((re) => re.test(text))) return fam.code
  }
  return null
}

/**
 * The topic of an action request, used to route the escalation to the right
 * queue (refund / payment, payout, kyc, suspension, deletion).
 *
 * The module never performs the action; the topic only decides which human
 * queue picks it up.
 */
export function actionRequestTopic(text: string): string {
  const t = text.toLowerCase()
  if (/\b(refund|money|charge|payment)\w*/.test(t)) return 'refund'
  if (/\b(payout|withdraw)\w*/.test(t)) return 'payout'
  if (/\bkyc\b|\bverif\w*/.test(t)) return 'kyc'
  if (/\b(suspend|unsuspend|ban|lock)\w*/.test(t)) return 'suspension'
  if (/\b(delete|erase)\w*/.test(t)) return 'deletion'
  return 'general'
}
