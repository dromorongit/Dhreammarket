import { describe, it, expect } from 'vitest'
import { normalize, foldForScan, MAX_TEXT_LENGTH } from './normalize'

describe('normalize', () => {
  it('collapses whitespace and trims', () => {
    const r = normalize('  Hel\u200blo\t\tWorld  ')
    expect(r.text).toBe('Hello World')
  })

  it('strips control characters', () => {
    expect(normalize('a\u0000b\u0007c').text).toBe('abc')
  })

  it('NFKC-normalizes the user-facing copy', () => {
    expect(normalize('\uFF21BC').text).toBe('ABC') // full-width ABC
  })

  it('folds Unicode lookalikes for scanning only', () => {
    expect(normalize('\u0456gnore').foldedText).toBe('ignore') // Cyrillic і
    expect(normalize('ign\u03BFre').foldedText).toBe('ignore') // Greek ο
    expect(normalize('\u0456gn\u03BFr\u0435').foldedText).toBe('ignore') // mixed
  })

  it('folds leetspeak for scanning only', () => {
    expect(normalize('1gn0re').foldedText).toBe('ignore')
    expect(normalize('1GN0RE').foldedText).toBe('ignore')
    expect(normalize('s@v3 m3').foldedText).toBe('save me')
  })

  it('never folds the text shown to users or stored', () => {
    const r = normalize('1gn0re passw0rd')
    expect(r.text).toBe('1gn0re passw0rd')
    expect(r.foldedText).toBe('ignore password')
  })

  it('removes zero-width characters inside a word for the scan copy', () => {
    expect(normalize('ig\u200bnore').foldedText).toBe('ignore')
  })

  it('foldForScan matches normalize().foldedText', () => {
    expect(foldForScan('H3LL0')).toBe(normalize('H3LL0').foldedText)
  })

  it('exports the max text length', () => {
    expect(MAX_TEXT_LENGTH).toBe(2000)
  })
})
