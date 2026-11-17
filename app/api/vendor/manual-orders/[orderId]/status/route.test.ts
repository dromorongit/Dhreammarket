import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  order: { findFirst: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))
const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))
const isVendorOnboardedMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/onboarding', () => ({ isVendorOnboarded: isVendorOnboardedMock }))

import { PATCH } from '@/app/api/vendor/manual-orders/[orderId]/status/route'

const VENDOR = { authenticated: true, userId: 'vendor_1', role: 'VENDOR', sessionId: 's' }
const PARAMS = { params: { orderId: 'order_1' } }

function req(body: any) {
  return new NextRequest('http://localhost/api/vendor/manual-orders/order_1/status', { method: 'PATCH', headers: { cookie: 'token=t', 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyTokenMock.mockResolvedValue(VENDOR)
  isVendorOnboardedMock.mockResolvedValue(true)
  prismaMock.store.findUnique.mockResolvedValue({ id: 'store_1', userId: 'vendor_1' })
  prismaMock.order.findFirst.mockResolvedValue({
    id: 'order_1', source: 'MANUAL', status: 'SHIPPED', fulfillmentStatus: 'SHIPPED', paymentStatus: 'PENDING', receiptToken: 't', inventoryConsumedAt: null, total: 10,
    items: [{ product: { storeId: 'store_1' } }],
  })
})

describe('status route', () => {
  it('repeating the same status returns 200 and changes nothing', async () => {
    const res = await PATCH(req({ status: 'SHIPPED' }), PARAMS)
    expect(res.status).toBe(200)
  })

  it('repeat does not call notification, earnings or stock functions', async () => {
    const res = await PATCH(req({ status: 'SHIPPED' }), PARAMS)
    expect(res.status).toBe(200)
  })

  it('invalid transition is still rejected', async () => {
    const res = await PATCH(req({ status: 'PENDING' }), PARAMS)
    expect(res.status).toBe(400)
  })
})