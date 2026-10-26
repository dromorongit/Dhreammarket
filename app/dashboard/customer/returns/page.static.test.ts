import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const RETURNS_DIR = path.join(process.cwd(), 'app', 'dashboard', 'customer', 'returns')

function source(file: string): string {
  return fs.readFileSync(path.join(RETURNS_DIR, file), 'utf8')
}

describe('returns list page gating', () => {
  const src = source('page.tsx')

  it('calls notFound when the returns flag is off before any data fetch', () => {
    expect(src).toContain("import { notFound } from 'next/navigation'")
    expect(src).toContain('isReturnsFlowEnabled()')
    expect(src).toContain('notFound()')
    const flagIndex = src.indexOf('isReturnsFlowEnabled()')
    const prismaIndex = src.indexOf('getPrisma()')
    expect(flagIndex).toBeGreaterThan(-1)
    expect(prismaIndex).toBeGreaterThan(flagIndex)
  })

  it('scopes the request list to the logged-in customer', () => {
    expect(src).toContain('getCustomerSession()')
    expect(src).toContain('where: { customerId: session.userId }')
  })

  it('does not render client return components server-side', () => {
    expect(src).not.toContain("'use client'")
  })
})

describe('returns new page gating', () => {
  const src = source('new/page.tsx')

  it('calls notFound when the returns flag is off before any data fetch', () => {
    expect(src).toContain("import { notFound } from 'next/navigation'")
    expect(src).toContain('isReturnsFlowEnabled()')
    expect(src).toContain('notFound()')
    const flagIndex = src.indexOf('isReturnsFlowEnabled()')
    const prismaIndex = src.indexOf('getOrderItemEligibility(')
    expect(flagIndex).toBeGreaterThan(-1)
    expect(prismaIndex).toBeGreaterThan(flagIndex)
  })

  it('requires an orderItemId and treats a missing one as not found', () => {
    expect(src).toContain("if (!orderItemId) {")
    expect(src).toContain('notFound()')
  })

  it('is a server component', () => {
    expect(src).not.toContain("'use client'")
  })
})

describe('returns detail page gating', () => {
  const src = source('[returnId]/page.tsx')

  it('calls notFound when the returns flag is off before any data fetch', () => {
    expect(src).toContain("import { notFound } from 'next/navigation'")
    expect(src).toContain('isReturnsFlowEnabled()')
    expect(src).toContain('notFound()')
    const flagIndex = src.indexOf('isReturnsFlowEnabled()')
    const prismaIndex = src.indexOf('getPrisma()')
    expect(flagIndex).toBeGreaterThan(-1)
    expect(prismaIndex).toBeGreaterThan(flagIndex)
  })

  it('enforces ownership by customerId in the query', () => {
    expect(src).toContain('where: { id: params.returnId, customerId: session.userId }')
  })

  it('returns not found when the request is missing or not the customer\'s', () => {
    expect(src).toContain('if (!request) {')
    expect(src).toContain('notFound()')
  })

  it('is a server component', () => {
    expect(src).not.toContain("'use client'")
  })
})

