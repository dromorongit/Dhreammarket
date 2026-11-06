import { describe, it, expect } from 'vitest'
import { parseMigrationArgs, requireConfirmHost, targetDatabase } from './migrate-verification-documents'

describe('parseMigrationArgs', () => {
  it('defaults to dry run with no flags', () => {
    expect(parseMigrationArgs([])).toEqual({ dryRun: true, execute: false, confirmHost: null })
  })

  it('--execute enables writes and deletes', () => {
    expect(parseMigrationArgs(['--execute'])).toEqual({ dryRun: false, execute: true, confirmHost: null })
  })

  it('parses --confirm-host alongside --execute', () => {
    expect(parseMigrationArgs(['--execute', '--confirm-host=localhost'])).toEqual({
      dryRun: false,
      execute: true,
      confirmHost: 'localhost',
    })
  })
})

describe('targetDatabase', () => {
  it('parses the host and database name from DATABASE_URL', () => {
    expect(targetDatabase('postgresql://dhream_dev:dhream_dev@localhost:5433/dhream_dev?schema=public')).toEqual({
      host: 'localhost',
      database: 'dhream_dev',
    })
  })
})

describe('requireConfirmHost', () => {
  const url = 'postgresql://dhream_dev:dhream_dev@localhost:5433/dhream_dev'

  it('returns the host and database when --confirm-host matches DATABASE_URL', () => {
    expect(requireConfirmHost(url, 'localhost')).toEqual({ host: 'localhost', database: 'dhream_dev' })
  })

  it('throws when --confirm-host is missing', () => {
    expect(() => requireConfirmHost(url, null)).toThrow(/--confirm-host/)
  })

  it('throws when --confirm-host does not match the DATABASE_URL host', () => {
    expect(() => requireConfirmHost(url, 'db.example.com')).toThrow(/DATABASE_URL host \(localhost\)/)
  })

  it('throws when DATABASE_URL is not set', () => {
    expect(() => requireConfirmHost(undefined, 'localhost')).toThrow(/DATABASE_URL/)
  })
})
