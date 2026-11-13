import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { checkMigrationEncoding } from './check-migration-encoding'

const SOURCE_DIRS = [path.join(process.cwd(), 'app'), path.join(process.cwd(), 'components'), path.join(process.cwd(), 'lib')]

function collectTsFiles(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectTsFiles(full, out)
    else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) out.push(full)
  }
}

describe('checkSourceEncoding', () => {
  it('accepts a clean UTF-8 buffer', () => {
    const result = checkMigrationEncoding(Buffer.from('export const x = 1;\n', 'utf8'))
    expect(result.ok).toBe(true)
    expect(result.problems).toEqual([])
  })

  it('rejects a buffer with a UTF-8 BOM', () => {
    const result = checkMigrationEncoding(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('export const x = 1;\n', 'utf8')]))
    expect(result.ok).toBe(false)
    expect(result.problems.some((problem) => problem.kind === 'bom')).toBe(true)
  })

  it('rejects invalid UTF-8', () => {
    const result = checkMigrationEncoding(Buffer.from([0x41, 0xc3, 0x28, 0x42]))
    expect(result.ok).toBe(false)
    expect(result.problems.some((problem) => problem.kind === 'invalid-utf8')).toBe(true)
  })
})

describe('source files', () => {
  it('contains no encoding problems in any .ts/.tsx under app/, components/, lib/', () => {
    const files: string[] = []
    for (const dir of SOURCE_DIRS) {
      if (!fs.existsSync(dir)) continue
      collectTsFiles(dir, files)
    }
    files.sort()

    const offenders: string[] = []
    for (const file of files) {
      const result = checkMigrationEncoding(fs.readFileSync(file))
      for (const problem of result.problems) {
        offenders.push(`${path.relative(process.cwd(), file)}: ${problem.kind} - ${problem.detail}`)
      }
    }

    expect(offenders).toEqual([])
  })
})
