import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  order: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  product: { update: vi.fn().mockResolvedValue({}) },
  $queryRaw: vi.fn().mockResolvedValue([]),
  $transaction: vi.fn(async (cb) => cb(prismaMock)),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOrderStatusUpdateEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/notification-preferences', () => ({ canSendCustomerEmail: vi.fn().mockResolvedValue(false) }))
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: vi.fn() }))
vi.mock('@/lib/fulfillment-events', () => ({ recordFulfillmentEvent: vi.fn().mockResolvedValue(undefined), FulfillmentEventType: {} }))
vi.mock('@/lib/stock-reservation', () => ({ consumeInventory: vi.fn(), releaseStock: vi.fn().mockResolvedValue({ success: true }), restoreManualSaleStock: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/influencer/order-cashback', () => ({ creditInfluencerOrderCashback: vi.fn(), reverseInfluencerOrderCashback: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/refunds/admin-notify', () => ({ notifySuperAdminsRefundRequested: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/order-delivery-stamps', () => ({ stampOrderItems: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/order-source', () => ({ isManualOrder: vi.fn() }))

import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { isManualOrder } from '@/lib/order-source'
import { notifySuperAdminsRefundRequested } from '@/lib/refunds/admin-notify'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { PATCH } from '@/app/api/vendor/orders/[orderId]/route'

const mockVerifyToken = vi.mocked(verifyToken)
const mockIsVendorOnboarded = vi.mocked(isVendorOnboarded)
const mockIsManualOrder = vi.mocked(isManualOrder)
const mockNotify = vi.mocked(notifySuperAdminsRefundRequested)
const mockRecordFulfillmentEvent = vi.mocked(recordFulfillmentEvent)

beforeEach(() => {
  vi.clearAllMocks()
  mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'vendor-user-1', role: 'VENDOR' } as any)
  mockIsVendorOnboarded.mockResolvedValue(true)
  mockIsManualOrder.mockReturnValue(true)
  prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1', userId: 'vendor-user-1', products: [{ id: 'prod-1' }] })
  prismaMock.order.findFirst.mockResolvedValue({
    id: 'order-1',
    paymentStatus: 'PAID',
    vendorRejected: false,
    vendorAccepted: false,
    status: 'PROCESSING',
    fulfillmentStatus: 'PROCESSING',
    items: [{ productId: 'prod-1', product: { storeId: 'store-1', store: { userId: 'vendor-user-1', name: 'Store' } } }],
  })
  prismaMock.order.update.mockResolvedValue({ id: 'order-1' })
  prismaMock.order.findUnique.mockResolvedValue({ id: 'order-1', user: null })
})

describe('vendor reject manual order', () => {
  it('does not create a refund request', async () => {
    const request = new NextRequest('http://localhost/api/vendor/orders/order-1', {
      method: 'PATCH',
      headers: { cookie: 'token=test' },
      body: JSON.stringify({ action: 'reject', rejectionReason: 'out of stock' }),
    })
    const response = await PATCH(request, { params: { orderId: 'order-1' } } as any)
    console.log('REJECT STATUS', response.status); console.log('REJECT BODY', await response.clone().json());
    expect(response.status).toBe(200)
    expect(mockNotify).not.toHaveBeenCalled()
    const refundRequestedCalls = mockRecordFulfillmentEvent.mock.calls.filter((c) => c[1] === 'REFUND_REQUESTED')
    expect(refundRequestedCalls).toHaveLength(0)
  })
})
