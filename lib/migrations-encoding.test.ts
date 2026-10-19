import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { checkMigrationEncoding } from './check-migration-encoding'

const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations')

describe('checkMigrationEncoding', () => {
  it('accepts a clean SQL buffer', () => {
    const result = checkMigrationEncoding(
      Buffer.from('CREATE TABLE "Order" (id TEXT PRIMARY KEY);\n', 'utf8')
    )
    expect(result.ok).toBe(true)
    expect(result.problems).toEqual([])
  })

  it('rejects a UTF-16LE buffer with a BOM', () => {
    const buffer = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('CREATE TABLE "Order" (id TEXT PRIMARY KEY);\n', 'utf16le'),
    ])
    const result = checkMigrationEncoding(buffer)
    expect(result.ok).toBe(false)
    expect(result.problems.some((problem) => problem.kind === 'bom')).toBe(true)
  })

  it('rejects a buffer containing a NUL byte', () => {
    const buffer = Buffer.from('CREATE TABLE "Order" (id TEXT PRIMARY KEY);\n', 'utf8')
    buffer[12] = 0x00
    const result = checkMigrationEncoding(buffer)
    expect(result.ok).toBe(false)
    expect(result.problems.some((problem) => problem.kind === 'nul-byte')).toBe(true)
  })

  it('rejects invalid UTF-8', () => {
    const result = checkMigrationEncoding(Buffer.from([0x41, 0xc3, 0x28, 0x42]))
    expect(result.ok).toBe(false)
    expect(result.problems.some((problem) => problem.kind === 'invalid-utf8')).toBe(true)
  })
})

describe('prisma migration files', () => {
  it('contains no encoding problems in any migration.sql', () => {
    const directories = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()

    const offenders: string[] = []
    for (const directory of directories) {
      const file = path.join(MIGRATIONS_DIR, directory, 'migration.sql')
      if (!fs.existsSync(file)) continue
      const result = checkMigrationEncoding(fs.readFileSync(file))
      for (const problem of result.problems) {
        offenders.push(`${directory}/migration.sql: ${problem.kind} - ${problem.detail}`)
      }
    }

    expect(offenders).toEqual([])
  })
})
