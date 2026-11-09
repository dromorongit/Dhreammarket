/**
 * Normalization for inbound messages.
 *
 * Produces a `text` copy (shown to users / stored, NFKC-normalized) and a
 * SEPARATE `foldedText` copy used ONLY for security/intent scanning.
 * The folded copy lowercases, folds Unicode lookalikes and common leetspeak,
 * and is never shown to users or stored.
 */

export const MAX_TEXT_LENGTH = 2000

// Control chars we drop entirely from the user-facing copy. \t, \n, \r are
// left in place here and later collapsed to single spaces by the whitespace
// collapse step.
const ZERO_WIDTH_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u034F]/g
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g

// Common Unicode homoglyphs that NFKD does not fold to Latin letters.
// Keys are unique by construction; this list intentionally stays curated so
// false positives in scanning stay low.
const CONFUSABLES: Record<string, string> = {
  // Cyrillic lowercase (classic confusables)
  '\u0430': 'a', // а
  '\u0435': 'e', // е
  '\u043E': 'o', // о
  '\u0440': 'p', // р
  '\u0441': 'c', // с
  '\u0445': 'x', // х
  '\u0443': 'y', // у
  '\u0456': 'i', // і
  '\u0455': 's', // ѕ
  // Cyrillic uppercase
  '\u0410': 'A', // А
  '\u0412': 'B', // В
  '\u0415': 'E', // Е
  '\u041D': 'H', // Н
  '\u041A': 'K', // К
  '\u041C': 'M', // М
  '\u041E': 'O', // О
  '\u0420': 'P', // Р
  '\u0421': 'C', // С
  '\u0422': 'T', // Т
  '\u0423': 'Y', // У
  '\u0425': 'X', // Х
  // Greek lowercase
  '\u03B1': 'a', // α
  '\u03B5': 'e', // ε
  '\u03B9': 'i', // ι
  '\u03BA': 'k', // κ
  '\u03BC': 'm', // μ
  '\u03BD': 'v', // ν
  '\u03BF': 'o', // ο
  '\u03C1': 'p', // ρ
  '\u03C2': 's', // ς
  '\u03C4': 't', // τ
  '\u03C5': 'u', // υ
  '\u03C3': 's', // σ
  '\u03C9': 'w', // ω
  '\u03C7': 'x', // χ
  // Greek uppercase
  '\u0391': 'A', // Α
  '\u0395': 'E', // Ε
  '\u0397': 'H', // Η
  '\u0399': 'I', // Ι
  '\u039A': 'K', // Κ
  '\u039C': 'M', // Μ
  '\u039D': 'N', // Ν
  '\u039F': 'O', // Ο
  '\u03A1': 'P', // Ρ
  '\u03A4': 'T', // Τ
  '\u03A5': 'Y', // Υ
  '\u03A7': 'X', // Χ
  // IPA / misc
  '\u0251': 'a', // ɑ
  '\u0261': 'g', // ɡ
}

// Leetspeak folds for the scan-only copy (per spec).
const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
}

export interface NormalizedResult {
  text: string
  foldedText: string
}

export function normalize(text: string): NormalizedResult {
  if (typeof text !== 'string') {
    throw new Error('normalize expects a string')
  }

  // Strip control + zero-width characters from the user-facing copy.
  let cleaned = text.replace(CONTROL_CHARS, '').replace(ZERO_WIDTH_CHARS, '')

  // NFKC normalization on the user-facing copy.
  cleaned = cleaned.normalize('NFKC')

  // Collapse whitespace and trim.
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  // Build the folded copy for scanning only.
  const folded = foldString(cleaned)
  return { text: cleaned, foldedText: folded }
}

/** Fold a string for scanning: lowercase + Unicode/leetspeak folding. */
export function foldString(input: string): string {
  // NFKD + strip combining marks (handles accented Latin, fullwidth, etc.)
  let s = input.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')

  // Apply homoglyph map.
  let out = ''
  for (const ch of s) {
    out += CONFUSABLES[ch] ?? ch
  }

  // Apply leetspeak folds.
  let out2 = ''
  for (const ch of out) {
    out2 += LEET_MAP[ch] ?? ch
  }

  return out2
}

export function foldForScan(text: string): string {
  return normalize(text).foldedText
}
