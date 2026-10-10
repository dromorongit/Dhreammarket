import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { RefundError } from '@/lib/refunds'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => ({ payment: {} })) }))

vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: vi.fn(),
  requireSuperAdmin: vi.fn(),
}))

vi.mock('@/lib/refunds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/refunds')>()
  return {
    ...actual,
    createRefund: vi.fn(),
    getRefundHistory: vi.fn(),
    checkRefundStatus: vi.fn(),
  }
})

import { POST, GET } from '@/app/api/admin/refunds/route'
import { requireAdmin, requireSuperAdmin } from '@/lib/adminAuth'
import { createRefund, getRefundHistory } from '@/lib/refunds'

const mockRequireAdmin = vi.mocked(requireAdmin)
const mockRequireSuperAdmin = vi.mocked(requireSuperAdmin)

const UUID = 'f0a1b2c3-d4e5-4f67-8899-aabbccddeeff'

function buildRequest(body: unknown, url = 'http://localhost/api/admin/refunds'): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function refundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'refund_1',
    idempotencyKey: UUID,
    orderItemId: 'item_1',
    amount: 100,
    status: 'PROCESSED',
    paystackRefundId: '724',
    paystackStatus: 'success',
    failureReason: null,
    alreadyExisted: false,
    ...overrides,
  }
}

describe('POST /api/admin/refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ userId: 'admin_1', role: 'SUPER_ADMIN' } as never)
    mockRequireSuperAdmin.mockResolvedValue({ userId: 'admin_1', role: 'SUPER_ADMIN' } as never)
    vi.mocked(createRefund).mockResolvedValue({
      orderId: 'order_1',
      refunds: [refundRow()],
      orderRefunded: true,
      alreadyProcessed: false,
    } as never)
  })

  it('returns the auth failure when the caller is not an admin', async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) as never
    )

    const response = await POST(
      buildRequest({ orderId: 'order_1', requestId: UUID, confirmRefund: true })
    )

    expect(response.status).toBe(401)
    expect(createRefund).not.toHaveBeenCalled()
  })

  it('processes a refund keyed by the client requestId when confirmed', async () => {
    const response = await POST(
      buildRequest({ orderId: 'order_1', requestId: UUID, confirmRefund: true, reason: 'damaged' })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toBe('Refund processed successfully')
    expect(body.orderRefunded).toBe(true)

    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_1',
        source: 'MANUAL',
        // The client UUID is used verbatim as the idempotency key.
        reference: UUID,
        reason: 'damaged',
        actor: { triggeredByUserId: 'admin_1', triggeredByRole: 'SUPER_ADMIN' },
      })
    )
  })

  it('passes an explicit item list through', async () => {
    await POST(
      buildRequest({
        orderId: 'order_1',
        requestId: UUID,
        confirmRefund: true,
        items: [{ orderItemId: 'item_9', amount: 12.5 }, { orderItemId: 'item_8' }],
      })
    )

    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ orderItemId: 'item_9', amount: 12.5 }, { orderItemId: 'item_8', amount: undefined }],
      })
    )
  })

  it('accepts the single-item convenience form', async () => {
    await POST(
      buildRequest({
        orderId: 'order_1',
        requestId: UUID,
        confirmRefund: true,
        orderItemId: 'item_9',
        amount: 5,
      })
    )

    expect(createRefund).toHaveBeenCalledWith(
      expect.objectContaining({ items: [{ orderItemId: 'item_9', amount: 5 }] })
    )
  })

  it('requires confirmRefund to be true', async () => {
    const response = await POST(
      buildRequest({ orderId: 'order_1', requestId: UUID, confirmRefund: false })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toMatch(/not confirmed/i)
    expect(createRefund).not.toHaveBeenCalled()
  })

  it('requires a requestId', async () => {
    const response = await POST(
      buildRequest({ orderId: 'order_1', confirmRefund: true })
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error).toBe('requestId is required')
    expect(createRefund).not.toHaveBeenCalled()
  })

  it('requires an orderId', async () => {
    const response = await POST(
      buildRequest({ requestId: UUID, confirmRefund: true })
    )

    expect(response.status).toBe(400)
    expect(createRefund).not.toHaveBeenCalled()
  })

  it('maps a RefundError to its own status and keeps the other fields returned', async () => {
    vi.mocked(createRefund).mockRejectedValue(
      new RefundError(409, 'paid partly or fully with wallet; refund manually', 'WALLET_PAYMENT')
    )

    const response = await POST(
      buildRequest({ orderId: 'order_1', requestId: UUID, confirmRefund: true })
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.error).toBe('paid partly or fully with wallet; refund manually')
    expect(body.code).toBe('WALLET_PAYMENT')
  })

  it('reports an already processed refund as idempotent', async () => {
    vi.mocked(createRefund).mockResolvedValue({
      orderId: 'order_1',
      refunds: [refundRow({ alreadyExisted: true })],
      orderRefunded: false,
      alreadyProcessed: true,
    } as never)

    const response = await POST(
      buildRequest({ orderId: 'order_1', requestId: UUID, confirmRefund: true })
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.message).toBe('This refund was already processed.')
    expect(body.alreadyProcessed).toBe(true)
  })
})

describe('GET /api/admin/refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAdmin.mockResolvedValue({ userId: 'admin_1', role: 'SUPER_ADMIN' } as never)
  })

  it('requires orderId', async () => {
    const response = await GET(new NextRequest('http://localhost/api/admin/refunds'))
    expect(response.status).toBe(400)
  })

  it('returns the refund history for the order', async () => {
    vi.mocked(getRefundHistory).mockResolvedValue([{ id: 'refund_1' }] as never)

    const response = await GET(
      new NextRequest('http://localhost/api/admin/refunds?orderId=order_1')
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.refunds).toEqual([{ id: 'refund_1' }])
    expect(getRefundHistory).toHaveBeenCalledWith('order_1')
  })
})
