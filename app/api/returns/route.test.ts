import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  orderItem: { findUnique: vi.fn() },
  returnRequest: { findMany: vi.fn(), findFirst: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: verifyTokenMock }))

const flagsMock = vi.hoisted(() => ({
  isReturnsFlowEnabled: vi.fn(() => false),
}))
vi.mock('@/lib/feature-flags', () => flagsMock)

const openReturnMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/returns/return-service', () => ({ openReturn: openReturnMock }))

import { POST, GET } from '@/app/api/returns/route'

const CUSTOMER = { authenticated: true, userId: 'cust_1', role: 'CUSTOMER', sessionId: 's' }
const VENDOR = { authenticated: true, userId: 'vend_1', role: 'VENDOR', sessionId: 's' }

function buildRequest(method: 'GET' | 'POST', body: any = null, cookie: string | null = 'tok'): NextRequest {
  const init: any = { method }
  if (body !== null) init.body = JSON.stringify(body)
  if (cookie !== null) init.headers = { cookie: `token=${cookie}` }
  return new NextRequest('http://localhost/api/returns', init)
}

describe('POST /api/returns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    verifyTokenMock.mockResolvedValue(CUSTOMER as any)
    prismaMock.orderItem.findUnique.mockResolvedValue({ order: { userId: 'cust_1' } })
    openReturnMock.mockResolvedValue({ id: 'rr_1', status: 'PENDING', customerId: 'cust_1' })
  })

  it('returns 404 and makes zero database calls when the flag is unset', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    const res = await POST(buildRequest('POST', { orderItemId: 'oi_1', reason: 'DAMAGED' }))
    expect(res.status).toBe(404)
    expect(prismaMock.orderItem.findUnique).not.toHaveBeenCalled()
    expect(openReturnMock).not.toHaveBeenCalled()
  })

  it('returns 401 when unauthenticated', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    verifyTokenMock.mockResolvedValue({ authenticated: false } as any)
    const res = await POST(buildRequest('POST', { orderItemId: 'oi_1', reason: 'DAMAGED' }, 'tok'))
    expect(res.status).toBe(401)
    expect(prismaMock.orderItem.findUnique).not.toHaveBeenCalled()
  })

  it('returns 403 for a non-customer', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    verifyTokenMock.mockResolvedValue(VENDOR as any)
    const res = await POST(buildRequest('POST', { orderItemId: 'oi_1', reason: 'DAMAGED' }))
    expect(res.status).toBe(403)
  })

  it('rejects unknown body fields', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const res = await POST(buildRequest('POST', { orderItemId: 'oi_1', bogus: 1 }))
    expect(res.status).toBe(400)
    expect(prismaMock.orderItem.findUnique).not.toHaveBeenCalled()
  })

  it('returns 400 when orderItemId is missing', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const res = await POST(buildRequest('POST', { reason: 'DAMAGED' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an invalid reason', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    const res = await POST(buildRequest('POST', { orderItemId: 'oi_1', reason: 'NOT_A_REASON' }))
    expect(res.status).toBe(400)
  })

  it('returns 404 when the item belongs to another customer', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    prismaMock.orderItem.findUnique.mockResolvedValue({ order: { userId: 'other' } })
    const res = await POST(buildRequest('POST', { orderItemId: 'oi_1', reason: 'DAMAGED' }))
    expect(res.status).toBe(404)
  })

  it('returns 201 with the return request on success', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    openReturnMock.mockResolvedValue({ id: 'rr_1', status: 'PENDING', customerId: 'cust_1' })
    const res = await POST(buildRequest('POST', { orderItemId: 'oi_1', reason: 'DAMAGED', quantity: 1 }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.returnRequest.id).toBe('rr_1')
    expect(openReturnMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ customerId: 'cust_1', orderItemId: 'oi_1' }))
  })
})

describe('GET /api/returns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    verifyTokenMock.mockResolvedValue(CUSTOMER as any)
  })

  it('returns 404 and makes zero database calls when the flag is unset', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(false)
    const res = await GET(buildRequest('GET'))
    expect(res.status).toBe(404)
    expect(prismaMock.returnRequest.findMany).not.toHaveBeenCalled()
  })

  it('returns the customer\'s requests when flag is set', async () => {
    flagsMock.isReturnsFlowEnabled.mockReturnValue(true)
    prismaMock.returnRequest.findMany.mockResolvedValue([{ id: 'rr_1', status: 'PENDING' }])
    const res = await GET(buildRequest('GET'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.returnRequests.length).toBe(1)
    expect(prismaMock.returnRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { customerId: 'cust_1' } })
    )
  })
})
