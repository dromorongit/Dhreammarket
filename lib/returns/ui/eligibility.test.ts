import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Prisma } from '@prisma/client'

const prismaMock = vi.hoisted(() => ({
  orderItem: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  session: { findUnique: vi.fn() },
  refund: { findFirst: vi.fn(), create: vi.fn() },
  returnRequest: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  returnRequestEvent: { create: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

vi.mock('@/lib/feature-flags', () => ({
  isReturnsFlowEnabled: vi.fn(() => true),
  getReturnWindowDays: vi.fn(() => 7),
}))

import { getOrderItemEligibility } from './eligibility'
import { NotFoundError } from './server'

const NOW = new Date('2026-10-25T12:00:00.000Z').getTime()

function baseItem(overrides: any = {}) {
  return {
    id: 'oi_1',
    price: 100,
    quantity: 1,
    deliveredAt: new Date('2026-10-20T10:00:00.000Z'),
    orderId: 'order_1',
    product: { id: 'p_1', name: 'Widget', isReturnable: true, images: [{ url: 'https://cdn.example.com/w.png' }] },
    order: {
      id: 'order_1',
      userId: 'cust_1',
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      total: 100,
      payment: { id: 'pay_1', amount: 100 },
      items: [{ id: 'oi_1', price: 100, quantity: 1 }],
      refunds: [],
    },
    returnRequests: [],
    ...overrides,
  }
}

describe('getOrderItemEligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.orderItem.findUnique.mockResolvedValue(baseItem())
  })

  it('returns eligible with max refund amount and window days', async () => {
    const result = await getOrderItemEligibility('cust_1', 'oi_1', { now: NOW })
    expect(result.eligibility.eligible).toBe(true)
    expect((result.eligibility as any).maxRefundAmount.toString()).toBe('100')
    expect(result.windowDays).toBe(7)
    expect(result.item.name).toBe('Widget')
    expect(result.item.imageUrl).toContain('cdn.example.com')
  })

  it('throws NotFoundError for a missing item', async () => {
    prismaMock.orderItem.findUnique.mockResolvedValue(null)
    await expect(getOrderItemEligibility('cust_1', 'oi_missing', { now: NOW })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws the same NotFoundError for another customer item (no hint)', async () => {
    prismaMock.orderItem.findUnique.mockResolvedValue(baseItem({ order: { ...baseItem().order, userId: 'cust_2' } }))
    await expect(getOrderItemEligibility('cust_1', 'oi_1', { now: NOW })).rejects.toBeInstanceOf(NotFoundError)
  })

  it('throws NotFoundError for a malformed orderItemId without touching the database', async () => {
    await expect(getOrderItemEligibility('cust_1', '../evil', { now: NOW })).rejects.toBeInstanceOf(NotFoundError)
    expect(prismaMock.orderItem.findUnique).not.toHaveBeenCalled()
  })

  it('returns INVALID_DELIVERY_DATE for a null deliveredAt', async () => {
    const result = await getOrderItemEligibility('cust_1', 'oi_1', {
      now: NOW,
    })
    // deliveredAt is set in baseItem; override via mock
    prismaMock.orderItem.findUnique.mockResolvedValue(baseItem({ deliveredAt: null }))
    const r = await getOrderItemEligibility('cust_1', 'oi_1', { now: NOW })
    expect(r.eligibility.eligible).toBe(false)
    if (!r.eligibility.eligible) expect(r.eligibility.reason).toBe('INVALID_DELIVERY_DATE')
  })

  it('returns NOT_DELIVERED for a non-delivered order', async () => {
    prismaMock.orderItem.findUnique.mockResolvedValue(baseItem({ order: { ...baseItem().order, status: 'PENDING' } }))
    const r = await getOrderItemEligibility('cust_1', 'oi_1', { now: NOW })
    expect(r.eligibility.eligible).toBe(false)
    if (!r.eligibility.eligible) expect(r.eligibility.reason).toBe('NOT_DELIVERED')
  })

  it('returns ORDER_NOT_PAID for an unpaid order', async () => {
    prismaMock.orderItem.findUnique.mockResolvedValue(
      baseItem({ order: { ...baseItem().order, paymentStatus: 'UNPAID' } }),
    )
    const r = await getOrderItemEligibility('cust_1', 'oi_1', { now: NOW })
    expect(r.eligibility.eligible).toBe(false)
    if (!r.eligibility.eligible) expect(r.eligibility.reason).toBe('ORDER_NOT_PAID')
  })

  it('returns NOT_RETURNABLE_PRODUCT for a non-returnable product', async () => {
    prismaMock.orderItem.findUnique.mockResolvedValue(baseItem({ product: { ...baseItem().product, isReturnable: false } }))
    const r = await getOrderItemEligibility('cust_1', 'oi_1', { now: NOW })
    expect(r.eligibility.eligible).toBe(false)
    if (!r.eligibility.eligible) expect(r.eligibility.reason).toBe('NOT_RETURNABLE_PRODUCT')
  })

  it('returns WINDOW_EXPIRED after the window', async () => {
    const farFuture = new Date('2026-12-01T12:00:00.000Z').getTime()
    prismaMock.orderItem.findUnique.mockResolvedValue(baseItem())
    const r = await getOrderItemEligibility('cust_1', 'oi_1', { now: farFuture })
    expect(r.eligibility.eligible).toBe(false)
    if (!r.eligibility.eligible) expect(r.eligibility.reason).toBe('WINDOW_EXPIRED')
  })

  it('returns OPEN_REQUEST_EXISTS for an open request on the item', async () => {
    prismaMock.orderItem.findUnique.mockResolvedValue(
      baseItem({ returnRequests: [{ id: 'rr_1', status: 'PENDING', orderItemId: 'oi_1' }] }),
    )
    const r = await getOrderItemEligibility('cust_1', 'oi_1', { now: NOW })
    expect(r.eligibility.eligible).toBe(false)
    if (!r.eligibility.eligible) expect(r.eligibility.reason).toBe('OPEN_REQUEST_EXISTS')
  })

  it('does not call any write delegates (read-only)', async () => {
    await getOrderItemEligibility('cust_1', 'oi_1', { now: NOW })
    expect(prismaMock.orderItem.create).not.toHaveBeenCalled()
    expect(prismaMock.orderItem.update).not.toHaveBeenCalled()
    expect(prismaMock.orderItem.delete).not.toHaveBeenCalled()
    expect(prismaMock.returnRequest.create).not.toHaveBeenCalled()
    expect(prismaMock.refund.create).not.toHaveBeenCalled()
  })
})
