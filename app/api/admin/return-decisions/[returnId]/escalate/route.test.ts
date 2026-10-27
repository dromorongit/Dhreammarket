import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  returnRequest: { findUnique: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const requireSuperAdminMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/adminAuth', () => ({ requireSuperAdmin: requireSuperAdminMock }))

const flagsMock = vi.hoisted(() => ({
  isReturnsFlowEnabled: vi.fn(() => false),
}))
vi.mock('@/lib/feature-flags', () => flagsMock)

const escalateMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/returns/return-service', () => ({ escalate: escalateMock }))

import { POST } from '@/app/api/admin/return-decisions/[returnId]/escalate/route'

const SUPER_ADMIN = { userId: 'sa_1', role: 'SUPER_ADMIN' }

function buildRequest(body: any = {}): NextRequest {
  const init: any = { method: 'POST', body: JSON.stringify(body) }
  return new NextRequest('http://localhost/api/admin/return-decisions/rr_1/escalate', init)
}

describe('POST /api/admin/return-decisions/[returnId]/escalate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    requireSuperAdminMock.mockResolvedValue(SUPER_ADMIN as any)
    escalateMock.mockResolvedValue({ id: 'rr_1', status: 'ESCALATED' })
  })

  it('returns 404 with zero database calls when the flag is unset', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(404)
    expect(requireSuperAdminMock).not.toHaveBeenCalled()
    expect(prismaMock.returnRequest.findUnique).not.toHaveBeenCalled()
    expect(escalateMock).not.toHaveBeenCalled()
  })

  it('requires super admin and rejects non-admin', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    requireSuperAdminMock.mockResolvedValue(
      new NextResponse('Forbidden', { status: 403 }) as any
    )
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(403)
    expect(escalateMock).not.toHaveBeenCalled()
  })

  it('rejects any non-empty request body with 400', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const res = await POST(buildRequest({ note: 'x' }), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(400)
    expect(escalateMock).not.toHaveBeenCalled()
  })

  it('returns 200 when the return is escalated', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ESCALATED')
    expect(escalateMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ returnRequestId: 'rr_1', actor: 'ADMIN', actorId: 'sa_1' })
    )
    expect(escalateMock.mock.calls[0][1]).not.toHaveProperty('amount')
    expect(escalateMock.mock.calls[0][1]).not.toHaveProperty('note')
  })

  it('returns 409 with the current status when escalation is not allowed', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const conflict = new Error('Return request is not pending') as any
    conflict.status = 409
    conflict.code = 'INVALID_STATUS'
    escalateMock.mockRejectedValue(conflict)
    prismaMock.returnRequest.findUnique.mockResolvedValue({ status: 'AWAITING_REFUND' })
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.code).toBe('INVALID_STATUS')
    expect(json.status).toBe('AWAITING_REFUND')
  })

  it('returns 404 when the return request is not found', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const notFound = new Error('Return request not found') as any
    notFound.status = 404
    notFound.code = 'NOT_FOUND'
    escalateMock.mockRejectedValue(notFound)
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(404)
  })

  it('returns 500 without internal details for unexpected errors', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    escalateMock.mockRejectedValue(new Error('boom'))
    const res = await POST(buildRequest({}), { params: { returnId: 'rr_1' } } as any)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Failed to escalate return')
    expect(json).not.toHaveProperty('message')
    expect(json).not.toHaveProperty('stack')
    expect(json).not.toHaveProperty('code')
  })
})
