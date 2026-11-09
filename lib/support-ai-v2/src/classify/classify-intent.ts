/**
 * Deterministic, rules-only intent classifier.
 *
 * No LLM. Runs on the NORMALIZED (redacted) user text. Each high-risk intent
 * is matched by multiple phrasings so a single missed wording does not drop
 * the risk.
 *
 * The MATCHERS table is exported so it is easy to extend. English only, plus
 * the reviewed typo map. (Pidgin and Twi are known gaps - see README.)
 *
 * MATCHER ORDER (earlier families win):
 *
 *   1. prompt injection / jailbreak         -> refuse
 *   2. unauthorized access to other data     -> refuse
 *   3. exfiltration of platform internals    -> refuse
 *   4. action request                        -> escalate to a human, never act
 *   5. fraud / scam
 *   6. account takeover / compromise
 *   7. payment security / card misuse
 *   8. agent-only content (internal docs)    -> support_agent only
 *   9. about the platform / system status
 *  10. greeting
 *  11. payout (vendor)
 *  12. kyc (vendor)
 *  13. terms, privacy and cancellation policy
 *  14. refund / returns
 *  15. chargeback / payment dispute
 *  16. order tracking (informational) and order lookup (personal)
 *  17. privacy / legal request
 *  18. suspension / ban
 *  19. account self service (password, settings, two factor)
 *  20. cancellation of an order
 *  21. store admin, team members and permissions
 *  22. payment methods
 *  23. delivery / shipping
 *  24. vendor onboarding
 *  25. vendor listing
 *  26. fees and plans
 *  27. how to order
 *  28. abuse without a threat
 *
 * The agent-only and about-the-platform families run BEFORE the refund,
 * chargeback and payout families on purpose: "what is the internal escalation
 * procedure for chargebacks" is an agent question, not a refund question.
 * Likewise, mild abuse is LAST, so a message that also contains a recognised
 * answerable intent is classified by that intent and the tone is ignored.
 */

import type { IntentResult, Intent } from '../types'
import { intentDef } from './intents'
import {
  detectPersonalCase,
  detectInformational,
  detectUnclear,
  isBareTopicMessage,
  stripPleasantries,
} from '../risk/keywords'
import { normalizeTypoCopy } from '../sanitize/fuzzy'
import { hasMarketplaceVocabulary, offTopicFamily } from './off-topic'
import {
  ABUSE,
  ACTION_REQUEST,
  EXFILTRATION,
  PROMPT_INJECTION,
  UNAUTHORIZED_ACCESS,
} from '../security/patterns'

export interface ClassifierFamily {
  patterns: RegExp[]
  // Intent for an informational/general phrasing.
  infoIntent: Intent
  // Intent when a personal case is detected; null => never split to personal.
  personalIntent?: Intent
}

/**
 * The words that make "internal" mean "internal agent material" instead of
 * "internal to the platform" (an internal server error, an internal note).
 */
const AGENT_CONTEXT_WORDS =
  'procedure|process|script|policy|guide|guideline|escalation|handbook|runbook|sop|playbook'

export const MATCHERS: ClassifierFamily[] = [
  {
    // Prompt injection / jailbreak (also caught by the security scan).
    patterns: PROMPT_INJECTION,
    infoIntent: 'security.prompt_injection',
  },
  {
    // Unauthorized access to other users' data.
    patterns: UNAUTHORIZED_ACCESS,
    infoIntent: 'security.unauthorized_access',
  },
  {
    // Exfiltration of platform internals.
    patterns: EXFILTRATION,
    infoIntent: 'security.prompt_injection',
  },
  {
    // Action request: the module NEVER performs the action. It is escalated to
    // a human with the ACTION_REQUEST tag.
    patterns: ACTION_REQUEST,
    infoIntent: 'unknown',
  },
  {
    // Fraud / misuse.
    patterns: [
      /\b(scam|scammed|scammer|fraud|fraudulent|defrauded|phishing|phished)\b/i,
      /\bfake (seller|buyer|vendor|product|listing|store)\b/i,
      /\bsuspicious (payment|link|email|activity|charge)\b/i,
      /\bi (was )?(scammed|cheated|defrauded)\b/i,
    ],
    infoIntent: 'risk.fraud_report',
    personalIntent: 'risk.fraud_report',
  },
  {
    // Account takeover / unauthorized activity.
    patterns: [
      /\bhacked\b/i,
      /\baccount takeover\b/i,
      /\bsomeone (is )?logged into my account\b/i,
      /\bsomeone logged in\b/i,
      /\blogged me out\b/i,
      /\b(took over|taken over|takes over|hijack\w*)\s+(my|our)\s+account\b/i,
      /\b(my|our) account (was |is |has been |been )?(taken over|hijacked|compromised)\b/i,
      /\bunauthori[sz]ed (transaction|login|access|charge|payment)\b/i,
    ],
    infoIntent: 'risk.account_takeover',
    personalIntent: 'risk.account_takeover',
  },
  {
    // Payment security / card misuse.
    patterns: [
      /\bsafe to pay\b/i,
      /\bis (it|this|your site|payment) safe\b/i,
      /\bsecure (payment|to pay|checkout)\b/i,
      /\bcard security\b/i,
      /\bsomeone (is )?using my (card|account|details|money)\b/i,
    ],
    infoIntent: 'buyer.payment_methods_info',
    personalIntent: 'risk.payment_security',
  },
  {
    // Agent-only content. A non-agent asking for this is refused with the
    // role-mismatch scope result, never answered a buyer FAQ.
    //
    // The word "internal" only counts when it is used in an AGENT context:
    // within three words of a procedure/process/script/policy/guide/
    // guideline/escalation/handbook/runbook/sop/playbook, or in one of the
    // explicit agent phrases. "I get an internal server error at checkout" is
    // a normal support question, not agent-only content.
    patterns: [
      /\b(procedure|sop|playbook)\b/i,
      /\bagent (script|procedure|guide|playbook|handbook)\b/i,
      /\b(escalation procedure|support script|standard operating procedure)\b/i,
      /\b(support agent procedure|agent guide|agent handbook)\b/i,
      new RegExp(
        `\\binternal\\b(?:\\s+\\S+){0,3}\\s+\\b(${AGENT_CONTEXT_WORDS})\\b`,
        'i',
      ),
      new RegExp(
        `\\b(${AGENT_CONTEXT_WORDS})\\b(?:\\s+\\S+){0,3}\\s+\\binternal\\b`,
        'i',
      ),
      /\bhow do i (handle|process) (a|an|this)\b/i,
    ],
    infoIntent: 'agent.procedure_lookup',
  },
  {
    // About the platform / system status.
    patterns: [
      /\bwhat is dhream\b/i,
      /\babout (dhream|this (platform|site|marketplace))\b/i,
      /\bhow does (dhream|this (site|platform|marketplace)) work\b/i,
      /\bwhat is [\w ]+ about\b/i,
      /\b(system|service|platform|site) status\b/i,
    ],
    infoIntent: 'general.about_platform',
  },
  {
    // Greetings. A greeting plus a request is classified by the request: the
    // greeting is stripped before the families are matched.
    patterns: [
      /^\s*(hi|hello|hey|hiya|greetings)\b[\s,.!]*(there|everyone|everybody|team|all|folks)?[\s,.!]*$/i,
      /^\s*good (morning|afternoon|evening)\b[\s,.!]*$/i,
      /^\s*(there|everyone|everybody|team|all|folks)\b[\s,.!]*$/i,
    ],
    infoIntent: 'general.greeting',
  },
  {
    // Payout (vendor). Personal only with a case fact; "how do I withdraw"
    // and "when are payouts paid" stay informational.
    patterns: [
      /\bpayout\w*/i,
      /\bwithdraw\w*/i,
      /\bget paid\b/i,
      /\bwhen (will|do) i get paid\b/i,
      /\bhow (do|can) i (withdraw|set up payouts|get paid)\b/i,
      /\bpayout (is )?(missing|delayed|wrong|not arrived|has not arrived)\b/i,
    ],
    infoIntent: 'vendor.payout_info_general',
    personalIntent: 'vendor.payout_problem',
  },
  {
    // KYC (vendor).
    patterns: [
      /\bkyc\b/i,
      /\bverif(ication|ied)\b[^.?!]{0,24}(fail\w*|reject\w*|stuck|denied|problem|not approved)/i,
      /\bverif(ication|ied)\b[^.?!]{0,24}(require\w*|needed|document\w*|checklist)/i,
      /\bverif\w+\b[^.?!]{0,30}\b(take|takes|taking|need|needs|required|require|process|steps?)\b/i,
      /\bmy (kyc|verification)\b/i,
    ],
    infoIntent: 'vendor.kyc_info_general',
    personalIntent: 'vendor.kyc_failure',
  },
  {
    // Terms, privacy policy and cancellation policy - general platform
    // information, answered from the FAQ.
    patterns: [
      /\b(terms of service|terms and conditions|privacy policy|cancellation policy)\b/i,
    ],
    infoIntent: 'account.help_general',
  },
  {
    // Refund / return money.
    patterns: [
      /\brefund\w*/i,
      /\bmoney back\b/i,
      /\breturn (my |the )?money\b/i,
      /\bget (a |my )?refund\b/i,
      /\bsend (it|this|my order) back\b/i,
      /\b(want|need|demand|request)\b[^.?!]{0,20}\bback\b/i,
      /\breturns? policy\b/i,
    ],
    infoIntent: 'buyer.returns_policy_info',
    personalIntent: 'dispute.refund_request',
  },
  {
    // Chargeback / payment dispute.
    patterns: [
      /\bcharge ?back\w*/i,
      /\bdispute\b/i,
      /\bdouble[ -]?charg\w*/i,
      /\bcharged twice\b/i,
      /\bwas charged\b/i,
      /\bpayment (failed|problem|error|issue)\b/i,
      /\bdeduct\w*/i,
    ],
    infoIntent: 'account.help_general',
    personalIntent: 'dispute.chargeback_or_payment',
  },
  {
    // Order tracking. Informational tracking is answerable from the FAQ; a
    // personal lookup stays out of scope in Phase 1.
    patterns: [
      /\btrack(ing)? (my )?order\b/i,
      /\b(track|follow|monitor|check)\b[^.?!]{0,24}\bmy order\b/i,
      /\b(where|when)('| i)?s (my|the) order\b/i,
      /\bstatus of (my |the )?order\b/i,
      /\bhas my order shipped\b/i,
      /\border status\b/i,
    ],
    infoIntent: 'buyer.track_order_info',
    personalIntent: 'buyer.order_status',
  },
  {
    // Privacy / legal.
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
    infoIntent: 'account.help_general',
    personalIntent: 'legal.privacy_data_request',
  },
  {
    // Suspension / ban.
    patterns: [
      /\bsuspend\w*/i,
      /\bban(ned)?\b/i,
      /\breinstate\w*/i,
      /\baccount (is )?(locked|disabled|closed)\b/i,
      /\block(ed|ing)? out\b/i,
      /\bcan'?t (log ?in|access) my account\b/i,
    ],
    infoIntent: 'account.help_general',
    personalIntent: 'account.suspension_reinstatement',
  },
  {
    // Account self service: password, settings, two factor.
    patterns: [
      /\b(reset|forgot|forgotten|change|recover|restore|update)\b[^.?!]{0,24}\bpassword\b/i,
      /\b(change|update|edit)\b[^.?!]{0,24}\b(phone|email|profile|settings|name)\b/i,
      /\b(two[ -]?factor|2fa|2-step|authenticator app)\b/i,
      /\b(verify|confirm|activate)\b[^.?!]{0,24}\b(my |the )?(account|email|phone|number)\b/i,
      /\bhow (do|can) i (verify|confirm|activate)\b/i,
    ],
    infoIntent: 'account.help_general',
  },
  {
    // Cancelling an order. The cancellation RULE is never stated here: the
    // answer comes from an approved document, or the case is a POLICY_GAP.
    patterns: [
      /\b(cancel|cancellation)\b[^.?!]{0,30}\b(my |the |an? |this )?(order|purchase|booking)\b/i,
      /\bhow (do|can) i cancel\b/i,
      /\bcancel my order\b/i,
    ],
    infoIntent: 'buyer.cancellation_info',
  },
  {
    // Store admin, team members and permissions for vendors.
    patterns: [
      /\b(admin|administrator|owner)\b[^.?!]{0,30}\b(permission|role|access|right)s?\b/i,
      /\bteam members?\b/i,
      /\bstaff\b/i,
      /\b(invite|add|remove) (a |another |my )?(admin|team member|colleague|staff)\b/i,
      /\bstore (admin|management|team|staff)\b/i,
      /\bbecome an? admin\b/i,
    ],
    infoIntent: 'vendor.store_management_guide',
  },
  {
    // Payment methods.
    patterns: [
      /\bpayment (method|methods|option|options)\b/i,
      /\bhow (can|do) i pay\b/i,
      /\bhow to pay\b/i,
      /\bcan i pay\b/i,
      /\b(momo|mobile money)\b/i,
      /\bpay on delivery\b/i,
      /\bwhat (ways|methods) (can|do) i pay\b/i,
      /\bcheckout\b/i,
      /\b(supported|accepted|available)\b[^.?!]{0,30}\b(payment|cash|transfer|wallet|checkout)\b/i,
    ],
    infoIntent: 'buyer.payment_methods_info',
  },
  {
    // Delivery / shipping.
    patterns: [
      /\bdelivery\b/i,
      /\bshipping\b/i,
      /\bhow long (does|will) .{0,24}(take|arrive|deliver)/i,
      /\bwhen will .{0,24}(arrive|deliver)\b/i,
      /\bdeliver\w*/i,
    ],
    infoIntent: 'buyer.delivery_info',
  },
  {
    // Vendor onboarding.
    patterns: [
      /\bbecome a (seller|vendor|merchant)\b/i,
      /\bsell on (dhream|your (platform|site|marketplace))\b/i,
      /\b(vendor|seller) onboarding\b/i,
      /\bopen a (shop|store)\b/i,
      /\bstart selling\b/i,
      /\bhow do i (become|start) (a )?(seller|vendor)\b/i,
    ],
    infoIntent: 'vendor.onboarding_guide',
  },
  {
    // Vendor listing.
    patterns: [
      /\b(create|add|upload|list|publish)\s+(a |an |new |my |the )*(products?|listings?|items?)\b/i,
      /\bproduct listings?\b/i,
      /\bhow to list\b/i,
      /\b(list|listing)\s+(a |my )?products?\b/i,
    ],
    infoIntent: 'vendor.listing_guide',
  },
  {
    // Fees & plans.
    patterns: [
      /\bfees?\b/i,
      /\bcommission\b/i,
      /\bsubscription (plan|plans)\b/i,
      /\bpricing plan\b/i,
      /\bhow much .{0,16}(cost|charge|fee)/i,
    ],
    infoIntent: 'vendor.fees_plans_info',
  },
  {
    // How to order.
    patterns: [
      /\bhow (do|can|to) i? ?(place|make|create|put in) (an? )?order\b/i,
      /\b(place|make|create) an? order\b/i,
      /\bplacing an order\b/i,
      /\bhow to order\b/i,
      /\bhow (do|can) i buy\b/i,
    ],
    infoIntent: 'buyer.how_to_order',
  },
  {
    // Abuse / harassment (no threat). LAST, so a message that also contains a
    // recognised answerable intent is classified by that intent.
    patterns: ABUSE,
    infoIntent: 'abuse.harassment',
  },
]

export interface ClassifyInput {
  text: string
}

export function classifyIntent(input: ClassifyInput | string): IntentResult {
  const text = typeof input === 'string' ? input : input.text
  const lower = text.toLowerCase()

  // The typo-tolerant copy uses ONLY the reviewed typo map, so a wrong
  // correction can never change the meaning of a message. The original text
  // is never altered.
  const typoText = normalizeTypoCopy(lower)

  // A leading greeting or pleasantry is stripped and the rest is classified.
  const stripped = stripPleasantries(typoText)
  const target = stripped.length > 0 ? stripped : typoText

  const personal = detectPersonalCase(target)
  const informational = detectInformational(target)
  const unclear = detectUnclear(target)
  const bareTopic = isBareTopicMessage(target)

  for (const family of MATCHERS) {
    const signals: string[] = []
    for (const re of family.patterns) {
      const m = target.match(re)
      if (m) signals.push(m[0].trim())
    }
    if (signals.length === 0) continue

    let intent: Intent
    let personalCase: boolean
    if (family.personalIntent && personal) {
      intent = family.personalIntent
      personalCase = true
    } else {
      intent = family.infoIntent
      personalCase = personal
    }

    // Confidence: a bit higher with more matched phrasings or a clear
    // personal/informational qualifier.
    let confidence = 0.6 + 0.1 * Math.min(signals.length - 1, 2)
    if (personal || informational) confidence += 0.1
    confidence = Math.min(confidence, 0.92)
    // A message we do not really understand never carries a high confidence.
    if (unclear) confidence = Math.min(confidence, 0.5)

    const def = intentDef(intent)
    const result: IntentResult = {
      intent,
      confidence,
      source: 'rules',
      policyDependent: def.policyDependent,
      needsApprovedContent: def.policyDependent || def.needsApprovedContent === true,
      personalCase,
      signals,
    }

    // A greeting is answered, not clarified.
    if (intent === 'general.greeting') return result

    // Too vague to answer: one clarifying question. A bare topic word gets
    // the topic question, anything else the generic one.
    if (unclear) {
      result.clarifyMode = bareTopic ? 'topic' : 'generic'
    }

    return result
  }

  // Off-topic chat (a joke, a poem, the weather, a general knowledge
  // question) is declined with the out-of-scope template. It is detected
  // POSITIVELY, and only when the message contains no marketplace
  // vocabulary, so a short vague message still gets one clarifying question.
  const offTopic = offTopicFamily(target)
  if (offTopic !== null && !hasMarketplaceVocabulary(target)) {
    return {
      intent: 'out_of_scope',
      confidence: 0.9,
      source: 'rules',
      policyDependent: false,
      needsApprovedContent: false,
      personalCase: false,
      signals: [`off-topic:${offTopic}`],
    }
  }

  return {
    intent: 'unknown',
    confidence: 0,
    source: 'rules',
    policyDependent: false,
    needsApprovedContent: false,
    personalCase: personal,
    signals: [],
    clarifyMode: bareTopic ? 'topic' : 'generic',
  }
}
