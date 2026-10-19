// CSV helpers for the vendor money view.
//
// Two things matter here:
//
//  1. Excel on Windows needs a UTF-8 BOM to read a .csv as UTF-8 instead of
//     the local code page, so every export starts with one.
//  2. A CSV cell that begins with = + - @ is executed as a formula by Excel,
//     Sheets and LibreOffice. A vendor's customer names are attacker
//     controlled, so such a cell is prefixed with a single quote, which
//     spreadsheets read as "this is text".
//
// Numbers stay numbers: a cell that holds a finite number (or a string that
// is exactly a number) is never prefixed, so a negative profit still sums in
// Excel.

/** The UTF-8 byte order mark Excel needs to detect UTF-8 in a .csv file. */
export const CSV_BOM = '\uFEFF'

const FORMULA_PREFIXES = ['=', '+', '-', '@']

/**
 * True when the cell is a plain number (or a string that is exactly a
 * number). Numbers are not formulas, so they are never escaped.
 */
export function isNumericCell(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (trimmed === '') return false
  return Number.isFinite(Number(trimmed))
}

/**
 * Escape one CSV cell: guard against formula injection, then quote it when
 * it contains a comma, a quote or a line break.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return ''

  const raw = typeof value === 'string' ? value : String(value)
  if (raw === '') return ''

  const firstChar = raw[0]
  const needsFormulaGuard =
    !isNumericCell(value) &&
    (FORMULA_PREFIXES.includes(firstChar) || firstChar === '\t' || firstChar === '\r')

  const guarded = needsFormulaGuard ? `'${raw}` : raw

  if (/[",\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`
  }
  return guarded
}

/**
 * Build one CSV row from raw values.
 */
export function buildCsvRow(values: unknown[]): string {
  return values.map(escapeCsvCell).join(',')
}

/**
 * Build a whole CSV document (RFC 4180 line endings).
 */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [buildCsvRow(headers), ...rows.map(buildCsvRow)]
  return `${lines.join('\r\n')}\r\n`
}

/**
 * A safe download file name: letters, digits and dashes only.
 */
export function csvFileName(base: string, from: string, to: string): string {
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, '-')
  const safeFrom = from.replace(/[^0-9]/g, '')
  const safeTo = to.replace(/[^0-9]/g, '')
  return `${safeBase}-${safeFrom}-${safeTo}.csv`
}
