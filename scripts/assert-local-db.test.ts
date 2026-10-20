import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import path from 'path'
import { assertLocalDatabaseUrl, LocalDatabaseGuardError } from './assert-local-db.mjs'

const SCRIPT = path.join(process.cwd(), 'scripts', 'assert-local-db.mjs')
const LOCAL_URL = 'postgresql://dhream_dev:dhream_dev@localhost:5433/dhream_dev?schema=public'
const REMOTE_URL = 'postgresql://someuser:s3cr3t@db.example.com:5432/production_db'

function runGuard(url: string) {
  return spawnSync(process.execPath, [SCRIPT, url], { encoding: 'utf8' })
}

describe('assertLocalDatabaseUrl', () => {
  it('accepts the local development database', () => {
    expect(assertLocalDatabaseUrl(LOCAL_URL)).toBe(true)
    expect(assertLocalDatabaseUrl('postgresql://u:p@127.0.0.1:5433/dhream_dev')).toBe(true)
    expect(assertLocalDatabaseUrl('postgresql://u:p@[::1]:5433/dhream_dev')).toBe(true)
    expect(assertLocalDatabaseUrl('postgres://u:p@localhost:5433/dhream_dev')).toBe(true)
  })

  it('rejects a remote host', () => {
    expect(() => assertLocalDatabaseUrl(REMOTE_URL)).toThrow(LocalDatabaseGuardError)
  })

  it('rejects a local host on the wrong port', () => {
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@localhost:5432/dhream_dev')).toThrow(LocalDatabaseGuardError)
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@localhost/dhream_dev')).toThrow(LocalDatabaseGuardError)
  })

  it('rejects the wrong database name', () => {
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@localhost:5433/other_db')).toThrow(LocalDatabaseGuardError)
  })

  it('rejects a host that merely looks local', () => {
    expect(() => assertLocalDatabaseUrl('postgresql://u:p@localhost.evil.com:5433/dhream_dev')).toThrow(
      LocalDatabaseGuardError
    )
  })

  it('rejects values that are not PostgreSQL URLs', () => {
    expect(() => assertLocalDatabaseUrl('definitely-not-a-url')).toThrow(LocalDatabaseGuardError)
    expect(() => assertLocalDatabaseUrl('file:./dev.db')).toThrow(LocalDatabaseGuardError)
    expect(() => assertLocalDatabaseUrl('')).toThrow(LocalDatabaseGuardError)
  })
})

describe('assert-local-db command', () => {
  it('exits zero for the local development database', () => {
    const result = runGuard(LOCAL_URL)
    expect(result.status).toBe(0)
  })

  it('exits non-zero for a remote database', () => {
    const result = runGuard(REMOTE_URL)
    expect(result.status).not.toBe(0)
  })

  it('never prints the URL it rejected', () => {
    const result = runGuard(REMOTE_URL)
    const output = `${result.stdout}${result.stderr}`
    expect(output).not.toContain('s3cr3t')
    expect(output).not.toContain('db.example.com')
    expect(output).not.toContain('production_db')
    expect(output).not.toContain('someuser')
  })
})
