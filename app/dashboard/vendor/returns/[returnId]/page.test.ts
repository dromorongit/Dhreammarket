import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const VENDOR_DIR = path.join(process.cwd(), 'app', 'dashboard', 'vendor', 'returns')

function source(file: string): string {
  return fs.readFileSync(path.join(VENDOR_DIR, file), 'utf8')
}

describe('vendor returns respond page gating', () => {
  const src = source('[returnId]/page.tsx')

  it('calls notFound when the returns flag is off before any data fetch', () => {
    expect(src).toContain('notFound')
    expect(src).toContain('isReturnsFlowEnabled()')
    const flagIndex = src.indexOf('isReturnsFlowEnabled()')
    const prismaIndex = src.indexOf('getPrisma()')
    expect(flagIndex).toBeGreaterThan(-1)
    expect(prismaIndex).toBeGreaterThan(flagIndex)
  })

  it('authenticates as a vendor', () => {
    expect(src).toContain('getVendorSession()')
  })

  it('enforces ownership by store', () => {
    expect(src).toContain('storeIds.includes(request.orderItem.product.store.id)')
  })

  it('is a server component', () => {
    expect(src).not.toContain("'use client'")
  })

  it('selects no customer or contact fields', () => {
    expect(src).not.toContain('customerId')
    expect(src).not.toContain('email')
    expect(src).not.toContain('phone')
  })
})
