import { describe, it, expect } from 'vitest'
import {
  MARKETPLACE_VOCABULARY,
  OFF_TOPIC_FAMILIES,
  hasMarketplaceVocabulary,
  isOffTopic,
  offTopicFamily,
} from './off-topic'
import { classifyIntent } from './classify-intent'

describe('offTopicFamily', () => {
  it('detects every off-topic family', () => {
    const samples: [string, string][] = [
      ['who won the match last night', 'sports and match scores'],
      ['tell me a joke', 'jokes'],
      ['write me a short poem about the rain', 'poems and stories'],
      ['what is the recipe for jollof rice', 'recipes'],
      ['what is the weather in Accra today', 'weather'],
      ['can you help me with my math homework', 'homework and exam help'],
      ['translate this into french please', 'translation'],
      ['write me a python function to sort a list', 'coding help'],
      ['who should be the next president', 'politics and celebrity gossip'],
      ['what is the capital of Japan', 'general knowledge'],
    ]
    for (const [text, family] of samples) {
      expect(offTopicFamily(text), text).toBe(family)
    }
  })

  it('does not fire on a marketplace question', () => {
    for (const t of [
      'how do I request a refund',
      'where is my order',
      'what are the payout terms',
      'can I pay with momo',
    ]) {
      expect(offTopicFamily(t), t).toBeNull()
    }
  })
})

describe('hasMarketplaceVocabulary', () => {
  it('sees the marketplace words', () => {
    for (const t of [
      'weather delay on my delivery',
      'I want a refund for my order',
      'how do I pay with momo',
      'what is my payout',
    ]) {
      expect(hasMarketplaceVocabulary(t), t).toBe(true)
    }
  })

  it('does not invent marketplace words', () => {
    expect(hasMarketplaceVocabulary('who won the match last night')).toBe(false)
    expect(hasMarketplaceVocabulary('tell me a joke')).toBe(false)
  })
})

describe('isOffTopic', () => {
  it('is true for clearly off-topic chat', () => {
    expect(isOffTopic('who won the match last night')).toBe(true)
    expect(isOffTopic('tell me a joke')).toBe(true)
  })

  it('is false when the message also talks about the marketplace', () => {
    expect(isOffTopic('weather delay on my delivery')).toBe(false)
    expect(isOffTopic('tell me a joke, my order is late')).toBe(false)
  })

  it('is false for a short vague message', () => {
    for (const t of ['help', 'it is not working', '?', 'urgent']) {
      expect(isOffTopic(t), t).toBe(false)
    }
  })
})

describe('classifyIntent: off-topic chat', () => {
  it('declines clearly off-topic chat with the out-of-scope intent', () => {
    for (const t of [
      'who won the match last night',
      'tell me a joke',
      'write me a short poem about the rain',
      'what is the weather in Accra today',
      'can you help me with my math homework',
      'what is the capital of Japan',
    ]) {
      const r = classifyIntent(t)
      expect(r.intent, t).toBe('out_of_scope')
      expect(r.clarifyMode, t).toBeUndefined()
    }
  })

  it('never declines a message that talks about the marketplace', () => {
    for (const t of [
      'weather delay on my delivery',
      'tell me a joke, where is my order',
      'what is the capital of Japan, my refund is late',
    ]) {
      expect(classifyIntent(t).intent, t).not.toBe('out_of_scope')
    }
  })

  it('keeps a short vague message as one clarifying question', () => {
    for (const t of ['help', 'it is not working', '?', 'urgent']) {
      const r = classifyIntent(t)
      expect(r.intent, t).toBe('unknown')
      expect(r.clarifyMode, t).toBe('generic')
    }
  })
})

describe('the off-topic lists stay maintainable', () => {
  it('exports the marketplace vocabulary in lower case', () => {
    for (const word of MARKETPLACE_VOCABULARY) {
      expect(word, word).toBe(word.toLowerCase())
      expect(word, word).toBe(word.trim())
    }
  })

  it('exports the off-topic families with a name and at least one pattern', () => {
    for (const family of OFF_TOPIC_FAMILIES) {
      expect(family.name.length, family.name).toBeGreaterThan(0)
      expect(family.patterns.length, family.name).toBeGreaterThan(0)
    }
  })
})
