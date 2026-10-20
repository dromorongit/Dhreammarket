export type MigrationEncodingProblemKind = 'nul-byte' | 'bom' | 'invalid-utf8'

export interface MigrationEncodingProblem {
  kind: MigrationEncodingProblemKind
  detail: string
  offset?: number
}

export interface MigrationEncodingResult {
  ok: boolean
  problems: MigrationEncodingProblem[]
}

function hasPrefix(buffer: Buffer, prefix: number[]): boolean {
  if (buffer.length < prefix.length) return false
  for (let i = 0; i < prefix.length; i += 1) {
    if (buffer[i] !== prefix[i]) return false
  }
  return true
}

export function detectByteOrderMark(buffer: Buffer): string | null {
  if (hasPrefix(buffer, [0xef, 0xbb, 0xbf])) return 'utf-8'
  if (hasPrefix(buffer, [0xff, 0xfe, 0x00, 0x00])) return 'utf-32le'
  if (hasPrefix(buffer, [0x00, 0x00, 0xfe, 0xff])) return 'utf-32be'
  if (hasPrefix(buffer, [0xff, 0xfe])) return 'utf-16le'
  if (hasPrefix(buffer, [0xfe, 0xff])) return 'utf-16be'
  return null
}

export function checkMigrationEncoding(buffer: Buffer): MigrationEncodingResult {
  const problems: MigrationEncodingProblem[] = []

  const nulIndex = buffer.indexOf(0)
  if (nulIndex !== -1) {
    problems.push({
      kind: 'nul-byte',
      detail: `NUL byte at byte offset ${nulIndex}`,
      offset: nulIndex,
    })
  }

  const bom = detectByteOrderMark(buffer)
  if (bom !== null) {
    problems.push({
      kind: 'bom',
      detail: `${bom} byte order mark at byte offset 0`,
      offset: 0,
    })
  }

  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown decoding error'
    problems.push({
      kind: 'invalid-utf8',
      detail: `Invalid UTF-8: ${message}`,
    })
  }

  return { ok: problems.length === 0, problems }
}
