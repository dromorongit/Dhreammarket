import { describe, it, expect } from 'vitest'
import { computeConfidence, CONF } from './confidence'

describe('computeConfidence', () => {
  it('has starting thresholds', () => {
    expect(CONF.answerAt).toBe(0.75)
    expect(CONF.escalateBelow).toBe(0.5)
  })

  it('score is 0 when roleFit is 0 (hard gate)', () => {
    const b = computeConfidence({ intentConfidence: 0.9, coverage: 1, topChunkScore: 1, roleFit: 0 })
    expect(b.score).toBe(0)
  })

  it('applies the weighted formula when roleFit is 1', () => {
    const b = computeConfidence({ intentConfidence: 0.5, coverage: 1, topChunkScore: 1, roleFit: 1 })
    expect(b.retrieval).toBeCloseTo(1)
    expect(b.score).toBeCloseTo(0.4 * 0.5 + 0.5 * 1 + 0.1 * 1)
  })

  it('computes retrieval from coverage and topChunkScore, capped at 1', () => {
    const b = computeConfidence({ intentConfidence: 1, coverage: 0, topChunkScore: 0, roleFit: 1 })
    expect(b.retrieval).toBe(0)
    const capped = computeConfidence({ intentConfidence: 1, coverage: 10, topChunkScore: 10, roleFit: 1 })
    expect(capped.retrieval).toBe(1)
    const half = computeConfidence({ intentConfidence: 1, coverage: 0.5, topChunkScore: 0.5, roleFit: 1 })
    expect(half.retrieval).toBeCloseTo(0.5)
  })
})

describe('computeConfidence: retrieval can never answer an unknown intent', () => {
  it('caps the score of an unknown intent below the clarify band', () => {
    // The "0.58 dead zone": an unknown intent (confidence 0) with a perfect
    // retrieval result used to land inside the clarify band.
    const b = computeConfidence({ intentConfidence: 0, coverage: 1, topChunkScore: 0.9, roleFit: 1 })
    expect(b.score).toBeLessThan(CONF.escalateBelow)
    expect(b.score).toBeLessThan(CONF.answerAt)
  })

  it('never lets a strong retrieval lift an unknown intent into the answer band', () => {
    for (const coverage of [0, 0.5, 1]) {
      for (const topChunkScore of [0, 0.5, 0.9, 1]) {
        const b = computeConfidence({ intentConfidence: 0, coverage, topChunkScore, roleFit: 1 })
        expect(b.score).toBeLessThan(CONF.answerAt)
      }
    }
  })

  it('caps a weak intent confidence as well', () => {
    const b = computeConfidence({ intentConfidence: 0.2, coverage: 1, topChunkScore: 1, roleFit: 1 })
    expect(b.score).toBeLessThan(CONF.escalateBelow)
  })

  it('does not cap a trusted intent', () => {
    const b = computeConfidence({ intentConfidence: 0.8, coverage: 1, topChunkScore: 1, roleFit: 1 })
    expect(b.score).toBeGreaterThanOrEqual(CONF.answerAt)
  })
})
