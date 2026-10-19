import { describe, it, expect } from 'vitest'
import { CSV_BOM, buildCsv, buildCsvRow, csvFileName, escapeCsvCell, isNumericCell } from '@/lib/csv'

describe('lib/csv formula injection safety', () => {
  it('prefixes a text cell that starts with = + - @', () => {
    expect(escapeCsvCell('=1+1')).toBe("'=1+1")
    expect(escapeCsvCell('+cmd|calc')).toBe("'+cmd|calc")
    expect(escapeCsvCell('-2+3+cmd')).toBe("'-2+3+cmd")
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('escapes a cell that starts with a tab or a carriage return', () => {
    expect(escapeCsvCell('\t=1+1')).toBe("'\t=1+1")
    // A carriage return also forces the cell to be quoted.
    expect(escapeCsvCell('\r=1+1')).toBe('"\'\r=1+1"')
  })

  it('leaves plain numbers alone so they still sum in Excel', () => {
    expect(escapeCsvCell(12.5)).toBe('12.5')
    expect(escapeCsvCell(0)).toBe('0')
    expect(escapeCsvCell(-12.5)).toBe('-12.5')
    expect(escapeCsvCell('42')).toBe('42')
    expect(isNumericCell(-12.5)).toBe(true)
    expect(isNumericCell('=1+1')).toBe(false)
  })

  it('does not escape text that merely contains a dangerous character', () => {
    expect(escapeCsvCell('2 + 2')).toBe('2 + 2')
    expect(escapeCsvCell('Kofi Mensah')).toBe('Kofi Mensah')
  })

  it('quotes cells that contain a comma, a quote or a line break', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"')
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""')
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"')
  })

  it('renders empty cells as empty', () => {
    expect(escapeCsvCell(null)).toBe('')
    expect(escapeCsvCell(undefined)).toBe('')
    expect(escapeCsvCell('')).toBe('')
  })
})

describe('lib/csv document building', () => {
  it('joins a row with commas', () => {
    expect(buildCsvRow(['a', 'b', 1])).toBe('a,b,1')
  })

  it('writes a header row and CRLF line endings', () => {
    const csv = buildCsv(['date', 'total'], [['2026-10-10', 12.5]])
    expect(csv).toBe('date,total\r\n2026-10-10,12.5\r\n')
  })

  it('exports a UTF-8 BOM for Excel', () => {
    expect(CSV_BOM).toBe('\uFEFF')
    expect(`${CSV_BOM}${buildCsv(['a'], [['b']])}`.charCodeAt(0)).toBe(0xfeff)
  })

  it('builds a safe download file name', () => {
    expect(csvFileName('dhreamarket-sales', '2026-10-01', '2026-10-31')).toBe(
      'dhreamarket-sales-20261001-20261031.csv',
    )
    expect(csvFileName('../../etc/passwd', '2026-10-01', '2026-10-31')).not.toContain('/')
  })
})
