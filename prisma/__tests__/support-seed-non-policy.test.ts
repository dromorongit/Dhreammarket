import { describe, it, expect } from 'vitest'
import { supportSeedDocuments } from '../seed'

const FORBIDDEN_WORDS = ['refund', 'commission', 'payout', 'cancellation fee', 'return window']
const FORBIDDEN_CHARS = ['%', 'GHS']
const ALLOWLIST: string[] = []

describe('support AI v2 non-policy seed documents', () => {
  it('never produces a non-DRAFT document and no two documents share an intent and version', () => {
    for (const doc of supportSeedDocuments) {
      expect(doc.status).toBe('DRAFT')
      expect(doc.version).toBe(1)
    }
    const keys = supportSeedDocuments.map((d) => `${d.intent}::${d.version}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('fails if any non-policy seed document contains forbidden policy/financial terms', () => {
    for (const doc of supportSeedDocuments) {
      if (ALLOWLIST.includes(doc.slug)) continue
      const text = `${doc.title}\n${doc.content}`.toLowerCase()
      for (const word of FORBIDDEN_WORDS) {
        expect(text, `forbidden word "${word}" in ${doc.slug}`).not.toContain(word)
      }
      const raw = `${doc.title}\n${doc.content}`
      for (const ch of FORBIDDEN_CHARS) {
        expect(raw, `forbidden char "${ch}" in ${doc.slug}`).not.toContain(ch)
      }
    }
  })

  it('all seeded documents include required metadata for review', () => {
    for (const doc of supportSeedDocuments) {
      expect(doc.slug.length).toBeGreaterThan(0)
      expect(doc.title.length).toBeGreaterThan(0)
      expect(doc.intent.length).toBeGreaterThan(0)
      expect(doc.content.length).toBeGreaterThan(0)
      expect(doc.sourceNote.length).toBeGreaterThan(0)
      expect(doc.status).toBe('DRAFT')
      expect(doc.version).toBe(1)
    }
  })
})
