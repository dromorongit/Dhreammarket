import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  order: { findUnique: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
  product: { update: vi.fn().mockResolvedValue({}) },
  $queryRaw: vi.fn().mockResolvedValue([]),
  $transaction: vi.fn(async (cb) => cb(prismaMock)),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: vi.fn() }))
vi.mock('@/lib/fulfillment-events', () => ({ recordFulfillmentEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/stock-reservation', () => ({ releaseStock: vi.fn().mockResolvedValue({ success: true }), restoreManualSaleStock: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/influencer/order-cashback', () => ({ reverseInfluencerOrderCashback: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/refunds/admin-notify', () => ({ notifySuperAdminsRefundRequested: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/order-source', () => ({ isManualOrder: vi.fn() }))

import { verifyToken } from '@/lib/auth-middleware'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { createAuditLog } from '@/lib/audit-log'
import { restoreManualSaleStock } from '@/lib/stock-reservation'
import { notifySuperAdminsRefundRequested } from '@/lib/refunds/admin-notify'
import { isManualOrder } from '@/lib/order-source'
import { PATCH } from '@/app/api/orders/[orderId]/cancel/route'

const mockVerifyToken = vi.mocked(verifyToken)
const mockRecordFulfillmentEvent = vi.mocked(recordFulfillmentEvent)
const mockCreateAuditLog = vi.mocked(createAuditLog)
const mockRestore = vi.mocked(restoreManualSaleStock)
const mockNotify = vi.mocked(notifySuperAdminsRefundRequested)
const mockIsManualOrder = vi.mocked(isManualOrder)

beforeEach(() => {
  vi.clearAllMocks()
  mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'user-1', role: 'CUSTOMER' } as any)
  mockIsManualOrder.mockReturnValue(true)
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock))
  prismaMock.order.findFirst.mockResolvedValue({
    id: 'order-1',
    userId: 'user-1',
    status: 'PROCESSING',
    fulfillmentStatus: 'PROCESSING',
    orderType: 'NORMAL',
    paymentStatus: 'PAID',
    deletedAt: null,
    items: [{ product: { store: { name: 'Store', userId: 'vendor-1', storeId: 'store-1' } } }],
  })
  prismaMock.order.findUnique.mockResolvedValue({
    id: 'order-1',
    userId: 'user-1',
    status: 'PROCESSING',
    fulfillmentStatus: 'PROCESSING',
    orderType: 'NORMAL',
    paymentStatus: 'PAID',
    deletedAt: null,
    items: [{ product: { store: { name: 'Store', userId: 'vendor-1', storeId: 'store-1' } } }],
  })
  prismaMock.order.updateMany.mockResolvedValue({ count: 1 })
})

describe('customer cancel manual order', () => {
  it('restores stock but creates no refund request', async () => {
    const request = new NextRequest('http://localhost/api/orders/order-1/cancel', {
      method: 'POST',
      headers: { cookie: 'token=test' },
      body: JSON.stringify({ reason: 'changed mind' }),
    })
    const response = await PATCH(request, { params: { orderId: 'order-1' } } as any)
    expect(response.status).toBe(200)
    expect(mockRestore).toHaveBeenCalled()
    expect(mockNotify).not.toHaveBeenCalled()
    const refundRequestedCalls = mockRecordFulfillmentEvent.mock.calls.filter((c) => c[1] === 'REFUND_REQUESTED')
    expect(refundRequestedCalls).toHaveLength(0)
  })
})
