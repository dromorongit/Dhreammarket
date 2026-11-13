/**
 * Off-topic chat detection.
 *
 * Off-topic chat is detected POSITIVELY: a message must match one of the
 * explicit off-topic families below. The absence of marketplace vocabulary is
 * NEVER enough on its own, because a short vague message ("help", "it is not
 * working", "?") must stay one clarifying question, never a refusal.
 *
 * A message is out of scope only when BOTH are true:
 *
 *   1. an off-topic family matches, AND
 *   2. the message contains no marketplace vocabulary.
 *
 * The marketplace vocabulary is exported so it can be extended. The off-topic
 * families are exported for the same reason.
 */

/** A family of clearly off-topic requests. */
export interface OffTopicFamily {
  name: string
  patterns: RegExp[]
}

/**
 * The marketplace vocabulary. A message that contains one of these words is
 * talking about the marketplace, so it is never off-topic, whatever else it
 * says ("weather delay on my delivery" is a delivery question).
 *
 * Extend this list when a new word turns out to be clearly marketplace.
 */
export const MARKETPLACE_VOCABULARY: string[] = [
  'account',
  'accounts',
  'buyer',
  'buyers',
  'cart',
  'checkout',
  'commission',
  'coupon',
  'delivery',
  'dhream',
  'discount',
  'fees',
  'item',
  'items',
  'kyc',
  'listing',
  'listings',
  'login',
  'momo',
  'momo money',
  'mobile money',
  'order',
  'orders',
  'package',
  'parcel',
  'password',
  'pay',
  'payment',
  'payments',
  'payout',
  'payouts',
  'price',
  'prices',
  'product',
  'products',
  'refund',
  'refunds',
  'return',
  'returns',
  'seller',
  'sellers',
  'shipping',
  'shop',
  'shops',
  'store',
  'stores',
  'vendor',
  'vendors',
  'verification',
  'wallet',
]

/** The clearly off-topic request families. */
export const OFF_TOPIC_FAMILIES: OffTopicFamily[] = [
  {
    name: 'sports and match scores',
    patterns: [
      /\b(who won|what was the score|final score|match result|full time score)\b/i,
      /\b(league table|standings|next match|hat trick|goal scorer|fixture)\b/i,
      /\bwho (is|are) the better (player|team)\b/i,
    ],
  },
  {
    name: 'jokes',
    patterns: [
      /\b(tell me a joke|make me laugh|say something funny|give me a joke)\b/i,
      /\b(funny|joke) (about|jokes? about)\b/i,
    ],
  },
  {
    name: 'poems and stories',
    patterns: [
      /\bwrite (me )?(a |an )?(short |little )?(poem|story|song|rap|essay)\b/i,
      /\b(poem|story) (about|on) (the |a |my )?\w+/i,
    ],
  },
  {
    name: 'recipes',
    patterns: [
      /\b(recipe for|recipes? for)\b/i,
      /\b(how do i|how to) (cook|bake|make) (a |some |the )?\w+/i,
      /\bingredients for\b/i,
    ],
  },
  {
    name: 'weather',
    patterns: [
      /\b(weather|temperature|forecast|rain|sunny)\b[^.?!]{0,24}\b(in|at|for|today|tomorrow|tonight)\b/i,
      /\bwill it rain\b/i,
      /\bis it (raining|sunny|hot|cold|cloudy)\b/i,
    ],
  },
  {
    name: 'homework and exam help',
    patterns: [
      /\b(homework|assignment|classwork)\b/i,
      /\b(exam|test|quiz) (question|questions|answers|help|paper|revision)\b/i,
      /\bsolve this (equation|problem|sum)\b/i,
      /\b(maths?|math|algebra|calculus|geometry) (problem|question|sum|exercise)\b/i,
    ],
  },
  {
    name: 'translation',
    patterns: [
      /\btranslate (this|that|it|my)\b/i,
      /\btranslation of\b/i,
      /\bin (spanish|french|german|italian|portuguese|arabic|chinese|japanese|twi|twiga)\b/i,
    ],
  },
  {
    name: 'coding help',
    patterns: [
      /\b(write|create) (me )?(a |an )?(python|java|javascript|typescript|html|css|sql|shell) (code|function|script|program|query)\b/i,
      /\b(code|debug|refactor) (this|my) (code|function|script|program)\b/i,
      /\bwhy does my (code|function|script) (not )?(work|compile|run)\b/i,
    ],
  },
  {
    name: 'politics and celebrity gossip',
    patterns: [
      /\b(who should (be|become) (the )?(\w+ )?president|election results?|voting results?|who won the election|who is the prime minister)\b/i,
      /\b(celebrity|gossip) (news|gossip|rumou?r)\b/i,
      /\bwho is (dating|marrying|engaged to)\b/i,
    ],
  },
  {
    name: 'general knowledge',
    patterns: [
      /\bwhat (is|are) the capital(s)? of\b/i,
      /\bwho is (the |a )?(president|prime minister|ceo|chancellor) of\b/i,
      /\bwhen (was|did) (he|she|they|it) (born|die|died)\b/i,
      /\bhow (many|much) (people|continents|planets|states|countries)\b/i,
      /\bwhat year (did|was|were)\b/i,
      /\bhow far is .+ from\b/i,
    ],
  },
]

/** True when the text contains a marketplace word. */
export function hasMarketplaceVocabulary(text: string): boolean {
  const lower = text.toLowerCase()
  return MARKETPLACE_VOCABULARY.some((word) => lower.includes(word))
}

/** The name of the off-topic family that matches, or null. */
export function offTopicFamily(text: string): string | null {
  for (const family of OFF_TOPIC_FAMILIES) {
    for (const re of family.patterns) {
      if (re.test(text)) return family.name
    }
  }
  return null
}

/**
 * True when the text is clearly off-topic chat: an off-topic family matches
 * AND the text contains no marketplace vocabulary.
 */
export function isOffTopic(text: string): boolean {
  if (hasMarketplaceVocabulary(text)) return false
  return offTopicFamily(text) !== null
}
