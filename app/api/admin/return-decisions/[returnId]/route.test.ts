import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const prismaMock = vi.hoisted(() => ({}))
vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const requireSuperAdminMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/adminAuth', () => ({ requireSuperAdmin: requireSuperAdminMock }))

const flagsMock = vi.hoisted(() => ({
  isReturnsFlowEnabled: vi.fn(() => false),
}))
vi.mock('@/lib/feature-flags', () => flagsMock)

const adminDecideMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/returns/return-service', () => ({ adminDecide: adminDecideMock }))

import { POST } from '@/app/api/admin/return-decisions/[returnId]/route'

const SUPER_ADMIN = { userId: 'sa_1', role: 'SUPER_ADMIN' }

function buildRequest(body: any = null): NextRequest {
  const init: any = { method: 'POST' }
  if (body !== null) init.body = JSON.stringify(body)
  return new NextRequest('http://localhost/api/admin/return-decisions/rr_1', init)
}

describe('POST /api/admin/return-decisions/[returnId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    requireSuperAdminMock.mockResolvedValue(SUPER_ADMIN as any)
    adminDecideMock.mockResolvedValue({ id: 'rr_1', status: 'REJECTED' })
  })

  it('returns 404 and makes zero database calls when the flag is unset', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    const res = await POST(buildRequest({ decision: 'DENY' }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(404)
    expect(requireSuperAdminMock).not.toHaveBeenCalled()
    expect(adminDecideMock).not.toHaveBeenCalled()
  })

  it('delegates to requireSuperAdmin and rejects non-super-admin', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    requireSuperAdminMock.mockResolvedValue(
      new NextResponse('Forbidden', { status: 403 }) as any
    )
    const res = await POST(buildRequest({ decision: 'DENY' }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(403)
    expect(adminDecideMock).not.toHaveBeenCalled()
  })

  it('rejects unknown body fields', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const res = await POST(buildRequest({ decision: 'DENY', bogus: 1 }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(400)
    expect(adminDecideMock).not.toHaveBeenCalled()
  })

  it('returns the decision result on success', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    adminDecideMock.mockResolvedValue({ id: 'rr_1', status: 'REJECTED' })
    const res = await POST(buildRequest({ decision: 'DENY', note: 'ineligible' }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.returnRequest.status).toBe('REJECTED')
    expect(adminDecideMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ returnRequestId: 'rr_1', actorId: 'sa_1' }))
  })
})
