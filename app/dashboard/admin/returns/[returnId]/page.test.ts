import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ADMIN_DIR = path.join(process.cwd(), 'app', 'dashboard', 'admin', 'returns')

function source(file: string): string {
  return fs.readFileSync(path.join(ADMIN_DIR, file), 'utf8')
}

describe('admin returns detail page gating', () => {
  const src = source('[returnId]/page.tsx')

  it('calls notFound when the returns flag is off before any data fetch', () => {
    expect(src).toContain('notFound')
    expect(src).toContain('isReturnsFlowEnabled()')
    const flagIndex = src.indexOf('isReturnsFlowEnabled()')
    const prismaIndex = src.indexOf('getPrisma()')
    expect(flagIndex).toBeGreaterThan(-1)
    expect(prismaIndex).toBeGreaterThan(flagIndex)
  })

  it('authenticates as a super admin', () => {
    expect(src).toContain('getSuperAdminSession()')
  })

  it('is a server component', () => {
    expect(src).not.toContain("'use client'")
  })

  it('selects refunds, events and order reference', () => {
    expect(src).toContain('refunds: { select')
    expect(src).toContain('events: {')
    expect(src).toContain('order: { select: { id: true } }')
  })

  it('selects no customer or contact fields', () => {
    expect(src).not.toContain('customerId')
    expect(src).not.toContain('email')
    expect(src).not.toContain('phone')
  })
})
