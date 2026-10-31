import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const DIR = path.join(process.cwd(), 'app', 'vendor', '[id]', 'trust')

function source(file: string): string {
  return fs.readFileSync(path.join(DIR, file), 'utf8')
}

describe('trust profile page gating', () => {
  const src = source('page.tsx')
  it('calls notFound when flag off before data fetch', () => {
    expect(src).toContain('notFound')
    expect(src).toContain('isTrustProfileEnabled()')
    const flagIndex = src.indexOf('isTrustProfileEnabled()')
    const prismaIndex = src.indexOf('getPrisma()')
    expect(flagIndex).toBeGreaterThan(-1)
    expect(prismaIndex).toBeGreaterThan(flagIndex)
  })
  it('is server component', () => {
    expect(src).not.toContain("'use client'")
  })
  it('contains no customer identifiers', () => {
    expect(src).not.toContain('customerEmail')
    expect(src).not.toContain('customerPhone')
  })
})
