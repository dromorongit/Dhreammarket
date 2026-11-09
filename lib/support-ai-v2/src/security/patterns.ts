/**
 * The ONE source of truth for the security pattern families.
 *
 * The security scan, the intent classifier and the risk keyword lists all
 * import from here, so a pattern can never exist in one place and be missing
 * in another. Adding a pattern here adds it everywhere.
 *
 * Rules these patterns follow:
 *  - They match a WORD FAMILY or a STRUCTURE, never a whole message. No
 *    message from the labelled sets may be embedded here.
 *  - A pattern that blocks must not fire on a legitimate self-service
 *    question. The false-positive list is asserted in src/security/scan.test.ts.
 */

/**
 * Instruction override / jailbreak. Blocking.
 *
 * Two shapes:
 *  - an override verb (ignore, disregard, ...) next to a safety noun
 *    (rules, restrictions, instructions, ...);
 *  - a request to reveal the system prompt or the initial instructions.
 */
export const PROMPT_INJECTION: RegExp[] = [
  /ignore (the )?(previous|above|earlier|prior|all) (instruction|instructions|prompt|prompts|rule|rules|message|messages|everything)/i,
  /(ignore|disregard|forget|bypass|override|disable|turn off|skip)\s+((the|all|your|any|every|these|those|my)\s+){0,2}(safety|security|rules|restrictions|instructions|guidelines|policies|filters|limits|protections)\b/i,
  /(reveal|print|repeat|show|display|expose|dump)\s+(me )?(your |the )?(system prompt|instructions?|prompt|everything above|initial (prompt|instructions|message))/i,
  /you are now\b/i,
  /developer mode/i,
  /dan mode/i,
  /no restrictions/i,
  /jailbreak/i,
  /pretend (you are|to be|you'?re|your)/i,
  /act as (a |an |the )?\w* ?(admin|administrator|system|developer|mode)/i,
  /\[system\]|\[\/system\]|\[instruction\]|<\/?system>|\bsystem:|###+ ?instruction/i,
]

/** Role spoofing. Flagged; blocks only together with data access. */
export const ROLE_SPOOFING: RegExp[] = [
  /\bi(?:'m| am)\s+(a |an |the )?(admin|administrator|support agent|staff|moderator|employee|owner)/i,
  /\bas (a |an |the )?(admin|administrator|support agent|moderator)\b/i,
  /\bi work for (dhream|you|this (company|platform|site|marketplace))/i,
]

/**
 * Access to somebody else's data. Blocking.
 *
 * The bulk-data shape is a data verb plus "all" or "every" plus a data noun.
 * "all my own <noun>" is deliberately excluded: asking for your own orders is
 * not a security event, it is an out-of-scope request.
 */
export const UNAUTHORIZED_ACCESS: RegExp[] = [
  /(show|give|list|see|provide|display|tell)\s+(me |us )?[\w' ]{0,24}(phone|email|address|kyc|identit\w+|orders?|payouts?|details|personal data|account details)[\w' ]{0,24}(of|for|belonging to|about) (another|other|the|a|some|someone else'?s?) ?(user|seller|buyer|vendor|order|customer)/i,
  /(show|list|dump|export|give|send|print|reveal)\s+(me |us )?(all|every)\s+(?!my\b|our\b)[\w' ]{0,20}?(customers?|users?|vendors?|sellers?|buyers?|data|orders?|payouts?|accounts?|emails?|phone numbers?|kyc|documents?|records?)\b/i,
  /(another|other|someone else'?s?) (user|seller|buyer|vendor|customer|order)('s)? ?(phone|email|kyc|details|orders?|payouts?|account)/i,
]

/** Exfiltration of platform internals. Blocking. */
export const EXFILTRATION: RegExp[] = [
  /\b(api key|secret key|secret token|access token|bearer token|private key|auth token)\b/i,
  /\b(api keys|secret keys)\b/i,
  /\b(env(ironment)? (var|variable|file)|environment variable|environment variables)\b/i,
  /\b(connection string|database url|db password|database (password|credentials))\b/i,
]

/**
 * A request for the assistant to DO something. Flagged, never performed.
 *
 * The module never cancels, refunds, releases, approves or deletes anything.
 * An action request is escalated to a human, never executed.
 */
export const ACTION_REQUEST: RegExp[] = [
  /cancel (the |this |my )?order (for me|on my behalf|manually|on my request)/i,
  /please cancel (it|my order|this)/i,
  /unsuspend (me|my account|my shop|my store)/i,
  /delete (my )?account/i,
  /refund me now/i,
  /release my payout/i,
  /send my payout now/i,
  /approve my kyc/i,
  /verify my account for me/i,
  /(change|update|edit) (my )?(account|payout|bank|payment) (details|info|account)/i,
  /(send|forward|write|email) (an? )?(email|message)/i,
  /message the vendor/i,
]

/** Mild abuse without a threat. Flagged; answered with a boundary message. */
export const ABUSE: RegExp[] = [
  /\b(idiot|idiot s|stupid|useless|trash|garbage|rubbish|moron|pathetic)\b/i,
  /\b(fuck|shit|asshole|bastard|bitch|damn you)\b/i,
]

/** An explicit threat. Flagged; escalated with the highest priority. */
export const THREAT: RegExp[] = [
  /\b(i will|i'?ll|i'?m going to|im going to|gonna)\s+(kill|hurt|stab|shoot|beat|find|attack|come for)\b/i,
  /\b(kill|hurt|stab|shoot|beat)\s+(you|your family|him|her|them)\b/i,
  /\bkill myself\b|\bsuicide\b|\bself[ -]?harm\b/i,
]

export function anyMatch(patterns: RegExp[], text: string): boolean {
  return patterns.some((re) => re.test(text))
}

export const SECURITY_PATTERNS = {
  PROMPT_INJECTION,
  ROLE_SPOOFING,
  UNAUTHORIZED_ACCESS,
  EXFILTRATION,
  ACTION_REQUEST,
  ABUSE,
  THREAT,
}
