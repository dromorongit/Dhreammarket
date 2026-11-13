/**
 * Typo tolerance for the scanning copy.
 *
 * Pure. These helpers build a SCANNING COPY of a message; they never alter the
 * displayed or stored text and they never feed a generator. The original text
 * is the only text that is stored, logged or shown.
 *
 * Two mechanisms, in this order:
 *
 *  1. TYPO_MAP - an explicit, reviewed list of common misspellings. Always
 *     wins, so a word like "bak" is corrected even though it is too short for
 *     the fuzzy matcher.
 *  2. A small Damerau-Levenshtein matcher against a CLOSED lexicon of key
 *     terms. Distance 1 for words of 5 to 6 letters, distance 2 for words of 7
 *     or more, and never for words under 5 letters. A four-letter word is
 *     matched exactly, or through the typo map only: one letter can turn it
 *     into a completely different word.
 *
 * Ordinary words that sit within distance 1 of a lexicon term are on the
 * COLLISION_GUARD and are never fuzzy-mapped, so "lost" never becomes "list"
 * and "honey" never becomes "money".
 *
 * The lexicon is deliberately small. Every word in it can turn a harmless
 * sentence into a security signal, so it only holds terms that matter for
 * money, account safety or instruction override.
 */

/**
 * Key terms for typo-tolerant scanning.
 *
 * NEEDS OWNER REVIEW. A word here can raise a security signal, so the list
 * should stay short and obvious.
 */
export const FUZZY_LEXICON: string[] = [
  // Override / jailbreak verbs and the nouns they target.
  'ignore',
  'disregard',
  'forget',
  'bypass',
  'override',
  'disable',
  'skip',
  'safety',
  'security',
  'rules',
  'restrictions',
  'instructions',
  'guidelines',
  'policies',
  'filters',
  'limits',
  'protections',
  // Bulk-data verbs.
  'show',
  'list',
  'dump',
  'export',
  'give',
  'send',
  'print',
  'reveal',
  // Bulk-data nouns.
  'customers',
  'users',
  'vendors',
  'sellers',
  'buyers',
  'data',
  'orders',
  'payouts',
  'accounts',
  'emails',
  'phone',
  'numbers',
  'kyc',
  'documents',
  'records',
  // Money / loss / compromise vocabulary.
  'refund',
  'money',
  'back',
  'payout',
  'charged',
  'deducted',
  'received',
  'receive',
  'order',
  'account',
  'hacked',
  'stolen',
  'scam',
  'fraud',
  'password',
  'otp',
  'pin',
  'customer',
  'vendors',
]

/**
 * Explicit, reviewed misspellings. Applied before the fuzzy matcher so that
 * short words (which the fuzzy matcher skips) are still corrected.
 *
 * A NAME IS NEVER A TYPO. "Don" was removed from this map: it is a person's
 * name, and rewriting it to "do not" turned "Don asked about payouts" into a
 * question. The reviewed contractions (dont, didnt, wont, cant) stay.
 */
export const TYPO_MAP: Record<string, string> = {
  monei: 'money',
  moneys: 'money',
  bak: 'back',
  neva: 'never',
  recieve: 'receive',
  recieved: 'received',
  dont: 'do not',
  didnt: 'did not',
  wont: 'will not',
  cant: 'cannot',
  acct: 'account',
  pls: 'please',
  plz: 'please',
}

/**
 * Ordinary words that sit within the fuzzy distance of a lexicon term.
 *
 * These are never fuzzy-mapped, so an ordinary word can never turn into a
 * security term: "lost" must not become "list", "bank" must not become
 * "back" and "honey" must not become "money".
 *
 * The four-letter examples (lost, list, last, cost, post, most, mist, bank,
 * back) are already protected by the five-letter rule below; they are kept
 * here so the intent survives a change to that rule. "list" and "back" are
 * lexicon terms themselves, so they are still matched exactly.
 */
export const COLLISION_GUARD: ReadonlySet<string> = new Set([
  // Four-letter ordinary words near a lexicon term.
  'lost',
  'list',
  'last',
  'cost',
  'post',
  'most',
  'mist',
  'bank',
  'back',
  // Five-letter and longer ordinary words near a lexicon term.
  'black',
  'border',
  'charge',
  'expert',
  'honey',
  'limit',
  'monkey',
  'paint',
  'point',
  'spend',
])

/**
 * The minimum length of a token that may be fuzzy-matched.
 *
 * Four-letter words are matched exactly, or through the reviewed typo map
 * only. A one-letter mistake in a four-letter word is usually a different
 * word, not a typo.
 */
export const MIN_FUZZY_LENGTH = 5

/**
 * Minimal Pidgin marker list.
 *
 * NEEDS NATIVE-SPEAKER REVIEW before use with real users. These markers are
 * used ONLY to raise a signal (so a message we may not fully understand is
 * never answered). They are never used to answer, and they are never used to
 * guess an intent. No Twi phrases are listed here on purpose: inventing them
 * would be worse than admitting the gap.
 */
export const PIDGIN_TERMS: string[] = [
  'dey',
  'no enter',
  'don enter',
  'wahala',
  'abeg',
  'my money',
]

/** Damerau-Levenshtein distance (optimal string alignment). */
export function damerauLevenshtein(a: string, b: string): number {
  const lenA = a.length
  const lenB = b.length
  const dp: number[][] = Array.from({ length: lenA + 1 }, () =>
    Array.from({ length: lenB + 1 }, (_, j) => j),
  )
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1)
      }
    }
  }
  return dp[lenA][lenB]
}

/** Maximum fuzzy distance allowed for a token of this length. */
function maxDistanceFor(token: string): number {
  if (token.length < MIN_FUZZY_LENGTH) return 0
  if (token.length <= 6) return 1
  return 2
}

/** The lexicon as a lookup, for the exact match. */
const LEXICON = new Set(FUZZY_LEXICON)

/**
 * Maps a single token to a lexicon term, or to null.
 *
 * The explicit typo map wins; then an exact lexicon hit; then the fuzzy
 * match. Ordinary words on the collision guard are never fuzzy-mapped.
 */
export function fuzzyMatch(token: string): string | null {
  const t = token.toLowerCase()
  const mapped = TYPO_MAP[t]
  if (mapped) return mapped
  if (t.length < MIN_FUZZY_LENGTH) return null
  // An exact lexicon hit always wins, even for a guarded word.
  if (LEXICON.has(t)) return t
  // An ordinary word that sits within distance 1 of a lexicon term is never
  // rewritten into that term.
  if (COLLISION_GUARD.has(t)) return null
  const maxDist = maxDistanceFor(t)
  let best: string | null = null
  let bestDistance = maxDist + 1
  for (const term of FUZZY_LEXICON) {
    if (term.length < 4) continue
    if (t === term) return term
    const d = damerauLevenshtein(t, term)
    if (d <= maxDist && d < bestDistance) {
      best = term
      bestDistance = d
    }
  }
  return best
}

/** Applies only the explicit typo map to a token. */
export function applyTypoMap(token: string): string {
  const t = token.toLowerCase()
  return TYPO_MAP[t] ?? t
}

/**
 * Builds a typo-tolerant copy of a text for SCANNING only.
 * Whitespace and punctuation are preserved so offsets stay meaningful.
 */
export function normalizeScanCopy(text: string): string {
  return text
    .split(/(\s+)/)
    .map((part) => {
      if (part === '' || /^\s+$/.test(part)) return part
      const stripped = part.replace(/[^A-Za-z0-9]/g, '')
      if (stripped.length === 0) return part
      const match = fuzzyMatch(stripped)
      return match ?? part
    })
    .join('')
}

/**
 * Builds a typo-tolerant copy of a text using ONLY the explicit typo map.
 *
 * Used where a wrong correction is worse than a missed one (classification),
 * so the copy can only change a word we have explicitly reviewed.
 */
export function normalizeTypoCopy(text: string): string {
  return text
    .split(/(\s+)/)
    .map((part) => {
      if (part === '' || /^\s+$/.test(part)) return part
      const stripped = part.replace(/[^A-Za-z0-9]/g, '')
      if (stripped.length === 0) return part
      const mapped = applyTypoMap(stripped)
      return mapped === stripped ? part : part.replace(stripped, mapped)
    })
    .join('')
}

/** True when the text contains one of the documented Pidgin markers. */
export function hasPidginMarker(text: string): boolean {
  const lower = text.toLowerCase()
  return PIDGIN_TERMS.some((term) => lower.includes(term))
}
