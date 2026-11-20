import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

const mockPrisma = {
  $transaction: vi.fn(async (fn: any) => fn(mockPrisma)),
  auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  store: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  user: {
    update: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({
  getPrisma: () => mockPrisma,
}))

vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' }),
}))

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

const { PATCH } = await import('@/app/api/admin/vendors/[id]/route')

function buildRequest(body: any, url = 'http://localhost/api/admin/vendors/vendor-1') {
  return new NextRequest(url, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/admin/vendors/[id] verify action', () => {
  beforeEach(() => {
    mockPrisma.store.findUnique.mockReset()
    mockPrisma.store.update.mockReset()
    mockPrisma.user.update.mockReset()
    vi.mocked(requireAdmin).mockResolvedValue({ userId: 'admin-1', role: 'ADMIN' })
    mockPrisma.store.findUnique.mockResolvedValue({
      id: 'vendor-1',
      name: 'Test Store',
      isVerified: false,
      isFeatured: false,
      badgeTier: null,
      user: { id: 'user-1', email: 'vendor@test.com', role: 'VENDOR', createdAt: new Date() },
    })
    mockPrisma.store.update.mockResolvedValue({
      id: 'vendor-1',
      name: 'Test Store',
       isVerified: true,
       isFeatured: false,
       badgeTier: null,
       user: { id: 'user-1', email: 'vendor@test.com', role: 'VENDOR', createdAt: new Date() },
       products: [],
       _count: { products: 1 },
     })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('rejects verify with empty justification', async () => {
    const res = await PATCH(buildRequest({ action: 'verify', value: true, justification: '' }), {
      params: Promise.resolve({ id: 'vendor-1' }),
    } as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Justification required')
  })

  it('rejects verify with whitespace-only justification', async () => {
    const res = await PATCH(buildRequest({ action: 'verify', value: true, justification: '   ' }), {
      params: Promise.resolve({ id: 'vendor-1' }),
    } as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Justification required')
  })

  it('rejects verify with missing justification', async () => {
    const res = await PATCH(buildRequest({ action: 'verify', value: true }), {
      params: Promise.resolve({ id: 'vendor-1' }),
    } as any)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Justification required')
  })

  it('accepts verify with non-empty justification', async () => {
    const res = await PATCH(
      buildRequest({ action: 'verify', value: true, justification: 'Verified documents reviewed' }),
      { params: Promise.resolve({ id: 'vendor-1' }) } as any
    )
    expect(res.status).toBe(200)
    expect(mockPrisma.store.update).toHaveBeenCalled()
  })

  it('does not require justification for non-verify actions', async () => {
    const res = await PATCH(
      buildRequest({ action: 'disable' }),
      { params: Promise.resolve({ id: 'vendor-1' }) } as any
    )
    expect(res.status).not.toBe(400)
  })
})
