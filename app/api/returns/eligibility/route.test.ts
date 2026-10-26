import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

const prismaMock = vi.hoisted(() => ({
  orderItem: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  returnRequest: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const flagsMock = vi.hoisted(() => ({
  isReturnsFlowEnabled: vi.fn(() => false),
}))
vi.mock('@/lib/feature-flags', () => flagsMock)

const eligibilityMock = vi.hoisted(() => ({
  getOrderItemEligibility: vi.fn(),
}))
vi.mock('@/lib/returns/ui/eligibility', () => eligibilityMock)

import { NotFoundError } from '@/lib/returns/ui/server'
import { GET } from '@/app/api/returns/eligibility/route'

const CUSTOMER = { authenticated: true, userId: 'cust_1', role: 'CUSTOMER', sessionId: 's' }
const VENDOR = { authenticated: true, userId: 'vend_1', role: 'VENDOR', sessionId: 's' }

function buildRequest(orderItemId: string | null, cookie: string | null = 'tok', now: string | null = null): NextRequest {
  const url = new URL('http://localhost/api/returns/eligibility')
  if (orderItemId !== null) url.searchParams.set('orderItemId', orderItemId)
  if (now !== null) url.searchParams.set('now', now)
  const init: any = { method: 'GET' }
  if (cookie !== null) init.headers = { cookie: `token=${cookie}` }
  return new NextRequest(url.toString(), init)
}

describe('GET /api/returns/eligibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    verifyTokenMock.mockResolvedValue(CUSTOMER as any)
  })

  it('returns 404 and makes zero database or eligibility calls when the flag is unset', async () => {
    const res = await GET(buildRequest('oi_1'))
    expect(res.status).toBe(404)
    expect(prismaMock.orderItem.findUnique).not.toHaveBeenCalled()
    expect(eligibilityMock.getOrderItemEligibility).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    verifyTokenMock.mockResolvedValue({ authenticated: false } as any)
    const res = await GET(buildRequest('oi_1'))
    expect(res.status).toBe(401)
    expect(eligibilityMock.getOrderItemEligibility).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-customer', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    verifyTokenMock.mockResolvedValue(VENDOR as any)
    const res = await GET(buildRequest('oi_1'))
    expect(res.status).toBe(403)
  })

  it('returns 400 when orderItemId is missing', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const res = await GET(buildRequest(null))
    expect(res.status).toBe(400)
  })

  it('returns 404 for a malformed orderItemId without leaking validity', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    eligibilityMock.getOrderItemEligibility.mockRejectedValue(new NotFoundError())
    const res = await GET(buildRequest('../evil'))
    expect(res.status).toBe(404)
  })

  it('returns the same 404 for a missing item and for another customer item', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    eligibilityMock.getOrderItemEligibility.mockRejectedValue(new NotFoundError())
    const res = await GET(buildRequest('oi_1'))
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Not found')
  })

  it('returns eligible with maxRefundAmount as a two-decimal string', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    eligibilityMock.getOrderItemEligibility.mockResolvedValue({
      orderItemId: 'oi_1',
      item: { id: 'oi_1', name: 'Widget', price: 100, quantity: 1, imageUrl: null, deliveredAt: null },
      order: { id: 'order_1', status: 'DELIVERED', paymentStatus: 'PAID', total: 100 },
      windowDays: 7,
      eligibility: { eligible: true, maxRefundAmount: new Prisma.Decimal('45.50') },
    })
    const res = await GET(buildRequest('oi_1', 'tok', '2026-10-25T12:00:00.000Z'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.eligible).toBe(true)
    expect(json.maxRefundAmount).toBe('45.50')
    expect(json.windowDays).toBe(7)
    expect(eligibilityMock.getOrderItemEligibility).toHaveBeenCalledWith(
      'cust_1',
      'oi_1',
      expect.objectContaining({ now: new Date('2026-10-25T12:00:00.000Z').getTime() }),
    )
  })

  it('returns each ineligibility reason', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    eligibilityMock.getOrderItemEligibility.mockResolvedValue({
      orderItemId: 'oi_1',
      item: { id: 'oi_1', name: 'Widget', price: 100, quantity: 1, imageUrl: null, deliveredAt: null },
      order: { id: 'order_1', status: 'DELIVERED', paymentStatus: 'PAID', total: 100 },
      windowDays: 7,
      eligibility: { eligible: false, reason: 'WINDOW_EXPIRED' },
    })
    const res = await GET(buildRequest('oi_1'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.eligible).toBe(false)
    expect(json.reason).toBe('WINDOW_EXPIRED')
    expect(json.maxRefundAmount).toBeUndefined()
  })

  it('touches no write delegates', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    eligibilityMock.getOrderItemEligibility.mockResolvedValue({
      orderItemId: 'oi_1',
      item: { id: 'oi_1', name: 'Widget', price: 100, quantity: 1, imageUrl: null, deliveredAt: null },
      order: { id: 'order_1', status: 'DELIVERED', paymentStatus: 'PAID', total: 100 },
      windowDays: 7,
      eligibility: { eligible: true, maxRefundAmount: new Prisma.Decimal('10') },
    })
    await GET(buildRequest('oi_1'))
    expect(prismaMock.orderItem.create).not.toHaveBeenCalled()
    expect(prismaMock.orderItem.update).not.toHaveBeenCalled()
    expect(prismaMock.orderItem.delete).not.toHaveBeenCalled()
    expect(prismaMock.returnRequest.create).not.toHaveBeenCalled()
  })
})
