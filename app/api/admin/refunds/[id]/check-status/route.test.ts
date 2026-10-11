import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))

const auth = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  requireSuperAdmin: vi.fn(),
}))

vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: auth.requireAdmin,
  requireSuperAdmin: auth.requireSuperAdmin,
}))

const service = vi.hoisted(() => ({ checkRefundStatus: vi.fn() }))

vi.mock('@/lib/refunds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/refunds')>()
  return { ...actual, checkRefundStatus: service.checkRefundStatus }
})

import { POST } from '@/app/api/admin/refunds/[id]/check-status/route'

const SUPER_ADMIN = { userId: 'sa_1', role: 'SUPER_ADMIN' }
const ADMIN = { userId: 'admin_1', role: 'ADMIN' }

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/admin/refunds/refund_1/check-status', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function checked(overrides: Record<string, unknown> = {}) {
  return {
    refundId: 'refund_1',
    status: 'ATTACHED',
    paystackRefundId: '9001',
    paystackStatus: 'processed',
    outcome: 'ATTACHED',
    message: 'Matched the Paystack refund and attached it to this record.',
    eligibleForManualResolution: false,
    eligibleAt: new Date(),
    ...overrides,
  }
}

const ctx = { params: { id: 'refund_1' } }

const UNAUTH = () => NextResponse.json({ error: 'Authentication required' }, { status: 401 })
const FORBIDDEN = () => NextResponse.json({ error: 'SUPER_ADMIN access required' }, { status: 403 })

describe('POST /api/admin/refunds/[id]/check-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.requireSuperAdmin.mockResolvedValue(SUPER_ADMIN)
    auth.requireAdmin.mockResolvedValue(ADMIN)
    service.checkRefundStatus.mockResolvedValue(checked())
  })

  it('reconciles for a super admin when no action is requested', async () => {
    const response = await POST(buildRequest({}), ctx)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.outcome).toBe('ATTACHED')
    expect(service.checkRefundStatus).toHaveBeenCalledTimes(1)
    // Role comes from the verified session. No action is supplied.
    expect(vi.mocked(service.checkRefundStatus).mock.calls[0]).toEqual([
      'refund_1',
      { triggeredByUserId: 'sa_1', triggeredByRole: 'SUPER_ADMIN' },
      undefined,
    ])
  })

  it('requires a super admin for the plain reconcile too, not just the actions', async () => {
    auth.requireSuperAdmin.mockResolvedValue(FORBIDDEN() as never)

    const response = await POST(buildRequest({}), ctx)
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.requiresSuperAdmin).toBe(true)
    expect(service.checkRefundStatus).not.toHaveBeenCalled()
  })

  it('returns 401 when the caller is not authenticated', async () => {
    auth.requireSuperAdmin.mockResolvedValue(UNAUTH() as never)

    const response = await POST(buildRequest({}), ctx)

    expect(response.status).toBe(401)
    expect(service.checkRefundStatus).not.toHaveBeenCalled()
  })

  it('returns 403 for a plain ADMIN on every action', async () => {
    auth.requireSuperAdmin.mockResolvedValue(FORBIDDEN() as never)

    for (const action of ['MARK_FAILED', 'RESUBMIT']) {
      vi.clearAllMocks()
      auth.requireSuperAdmin.mockResolvedValue(FORBIDDEN() as never)

      const response = await POST(buildRequest({ action }), ctx)
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.requiresSuperAdmin).toBe(true)
      expect(service.checkRefundStatus).not.toHaveBeenCalled()
    }
  })

  it('returns 403 for a CUSTOMER and a VENDOR', async () => {
    for (const role of ['CUSTOMER', 'VENDOR']) {
      vi.clearAllMocks()
      auth.requireSuperAdmin.mockResolvedValue(FORBIDDEN() as never)

      const response = await POST(buildRequest({ action: 'MARK_FAILED' }), ctx)

      expect(response.status).toBe(403)
      expect(service.checkRefundStatus).not.toHaveBeenCalled()
    }
  })

  it('marks a stuck refund failed for a super admin', async () => {
    service.checkRefundStatus.mockResolvedValue(checked({ status: 'FAILED', outcome: 'MARKED_FAILED' }))

    const response = await POST(buildRequest({ action: 'MARK_FAILED' }), ctx)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.outcome).toBe('MARKED_FAILED')
    expect(service.checkRefundStatus).toHaveBeenCalledWith(
      'refund_1',
      expect.objectContaining({ triggeredByRole: 'SUPER_ADMIN' }),
      'MARK_FAILED'
    )
  })

  it('resubmits a stuck refund for a super admin', async () => {
    service.checkRefundStatus.mockResolvedValue(
      checked({ status: 'PROCESSING', outcome: 'RESUBMITTED' })
    )

    const response = await POST(buildRequest({ action: 'RESUBMIT' }), ctx)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.outcome).toBe('RESUBMITTED')
    expect(service.checkRefundStatus).toHaveBeenCalledWith(
      'refund_1',
      expect.objectContaining({ triggeredByRole: 'SUPER_ADMIN' }),
      'RESUBMIT'
    )
  })

  it('rejects an unknown action', async () => {
    const response = await POST(buildRequest({ action: 'DELETE' }), ctx)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toContain("'MARK_FAILED' or 'RESUBMIT'")
  })

  it('accepts a lowercase action', async () => {
    service.checkRefundStatus.mockResolvedValue(
      checked({ status: 'FAILED', outcome: 'MARKED_FAILED' })
    )

    const response = await POST(buildRequest({ action: 'mark_failed' }), ctx)

    expect(response.status).toBe(200)
    expect(service.checkRefundStatus).toHaveBeenCalledWith(
      'refund_1',
      expect.anything(),
      'MARK_FAILED'
    )
  })

  it('maps a RefundError status from the service', async () => {
    const { RefundError } = await import('@/lib/refunds')
    service.checkRefundStatus.mockRejectedValue(
      new RefundError(409, 'not old enough yet', 'TOO_EARLY_FOR_MANUAL_RESOLUTION')
    )

    const response = await POST(buildRequest({ action: 'MARK_FAILED' }), ctx)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('TOO_EARLY_FOR_MANUAL_RESOLUTION')
  })

  it('returns 400 when the refund id is missing', async () => {
    const response = await POST(buildRequest({}), { params: { id: '' } })

    expect(response.status).toBe(400)
    expect(service.checkRefundStatus).not.toHaveBeenCalled()
  })
})
