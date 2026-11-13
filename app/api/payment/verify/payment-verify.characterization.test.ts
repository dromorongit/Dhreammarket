import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { NextResponse } from 'next/server'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: vi.fn() }))
vi.mock('@/lib/paystack', () => ({ verifyPaystackPayment: vi.fn() }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/stock-reservation', () => ({ reserveStock: vi.fn(() => Promise.resolve()), releaseStock: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/notification-preferences', () => ({
  canSendCustomerEmail: vi.fn(() => Promise.resolve(true)),
  shouldSendNotification: vi.fn(() => Promise.resolve(true)),
}))
vi.mock('@/lib/email', () => ({
  sendPaymentConfirmationEmail: vi.fn(() => Promise.resolve()),
  sendPaymentFailedEmail: vi.fn(() => Promise.resolve()),
}))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: () => () => ({ success: true }) }))
vi.mock('@/lib/revenue', () => ({
  calculateFinancialBreakdown: vi.fn(() => Promise.resolve({
    grossAmount: 100,
    processorFee: 0,
    netAmount: 100,
    platformCommission: 2.5,
    vendorEarnings: 97.5,
    commissionRate: 0.025,
  })),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { verifyPaystackPayment } from '@/lib/paystack'
import { createAuditLog } from '@/lib/audit-log'
import { releaseStock } from '@/lib/stock-reservation'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)
const mockVerifyPaystack = vi.mocked(verifyPaystackPayment)

function buildMockPrisma() {
  const payments: any[] = []
  const orders: any[] = []
  const orderItems: any[] = []
  const users: any[] = []
  const stores: any[] = []
  const carts: any[] = []

  const mockPrisma: any = {
    payment: {
      findUnique: vi.fn(async ({ where }: any) => {
        const p = payments.find((x) => x.reference === where.reference || x.id === where.id) || null
        if (!p) return null
        const order = orders.find((o) => o.id === p.orderId) || null
        return { ...p, order: order ? { status: order.status } : null }
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = payments.findIndex((x) => x.id === where.id)
        if (idx === -1) return null
        payments[idx] = { ...payments[idx], ...data }
        return payments[idx]
      }),
    },
    order: {
      findUnique: vi.fn(async ({ where, select }: any) => {
        const o = orders.find((x) => x.id === where.id) || null
        if (!o) return null
        if (select) {
          const out: any = {}
          for (const k of Object.keys(select)) {
            if (k === 'orderType') out.orderType = o.orderType
            if (k === 'userId') out.userId = o.userId
            if (k === 'status') out.status = o.status
          }
          return out
        }
        return { ...o }
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = orders.findIndex((x) => x.id === where.id)
        if (idx === -1) return null
        orders[idx] = { ...orders[idx], ...data }
        return orders[idx]
      }),
    },
    orderItem: {
      findMany: vi.fn(async ({ where }: any) => {
        return orderItems.filter((x) => x.orderId === where.orderId).map((x) => ({ ...x }))
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = orderItems.findIndex((x) => x.id === where.id)
        if (idx === -1) return null
        orderItems[idx] = { ...orderItems[idx], ...data }
        return orderItems[idx]
      }),
    },
    cart: {
      findUnique: vi.fn(async ({ where }: any) => carts.find((x) => x.userId === where.userId) || null),
    },
    cartItem: {
      deleteMany: vi.fn(async () => ({})),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.find((x) => x.id === where.id) || null),
    },
    store: {
      findUnique: vi.fn(async ({ where }: any) => stores.find((x) => x.id === where.id) || null),
    },
    notification: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: any) => ({ id: 'notif-' + Date.now(), ...data })),
    },
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
  }

  return { mockPrisma, payments, orders, orderItems, users, stores, carts }
}

describe('payment verify characterization', () => {
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'customer-1', role: 'CUSTOMER', sessionId: 's' } as any)
    ctx = buildMockPrisma()
    mockGetPrisma.mockReturnValue(ctx.mockPrisma as any)
    mockVerifyPaystack.mockResolvedValue({ data: { status: 'success', amount: 10000 } } as any)
  })

  const baseRequest = (body: any) => ({
    cookies: { get: () => ({ value: 'token' }) },
    headers: { get: () => null },
    json: async () => body,
  } as any)

  it('success: processes and stores PAID/PROCESSING', async () => {
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: 'customer-1' })
    ctx.orderItems.push({ id: 'i1', orderId: 'o1', productId: 'prod1', productVariantId: null, quantity: 1, price: 100, availabilityType: 'IN_STOCK', product: { storeId: 'store1' } })
    ctx.users.push({ id: 'customer-1', email: 'c@test.com', profile: null })

    const { POST } = await import('@/app/api/payment/verify/route')
    const res = await POST(baseRequest({ reference: 'DHV-1' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(ctx.payments[0].status).toBe('PAID')
    expect(ctx.orders[0].status).toBe('PROCESSING')
    expect(ctx.orders[0].paymentStatus).toBe('PAID')
  })

  it('repeated success: idempotent, no reprocessing', async () => {
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PAID' })
    ctx.orders.push({ id: 'o1', status: 'PROCESSING', paymentStatus: 'PAID', orderType: 'NORMAL', userId: 'customer-1' })

    const { POST } = await import('@/app/api/payment/verify/route')
    const res1 = await POST(baseRequest({ reference: 'DHV-1' }))
    const res2 = await POST(baseRequest({ reference: 'DHV-1' }))
    expect(res1.status).toBe(200)
    expect((await res1.json()).alreadyProcessed).toBe(true)
    expect(res2.status).toBe(200)
    expect((await res2.json()).alreadyProcessed).toBe(true)
  })

  it('failed: marks FAILED/CANCELLED', async () => {
    mockVerifyPaystack.mockResolvedValue({ data: { status: 'failed', amount: 10000 } } as any)
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: 'customer-1' })

    const { POST } = await import('@/app/api/payment/verify/route')
    const res = await POST(baseRequest({ reference: 'DHV-1' }))
    expect(res.status).toBe(400)
    expect(ctx.payments[0].status).toBe('FAILED')
    expect(ctx.orders[0].status).toBe('CANCELLED')
    expect(ctx.orders[0].paymentStatus).toBe('FAILED')
  })

  it('abandoned: marks CANCELLED', async () => {
    mockVerifyPaystack.mockResolvedValue({ data: { status: 'abandoned', amount: 10000 } } as any)
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: 'customer-1' })

    const { POST } = await import('@/app/api/payment/verify/route')
    const res = await POST(baseRequest({ reference: 'DHV-1' }))
    expect(res.status).toBe(400)
    expect(ctx.payments[0].status).toBe('CANCELLED')
    expect(ctx.orders[0].status).toBe('CANCELLED')
  })

  it('amount mismatch: still succeeds and writes audit log (CHARACTERIZATION: known gap? audit swallowed on some paths)', async () => {
    mockVerifyPaystack.mockResolvedValue({ data: { status: 'success', amount: 10500 } } as any)
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: 'customer-1' })
    ctx.orderItems.push({ id: 'i1', orderId: 'o1', productId: 'prod1', productVariantId: null, quantity: 1, price: 100, availabilityType: 'IN_STOCK', product: { storeId: 'store1' } })
    ctx.users.push({ id: 'customer-1', email: 'c@test.com', profile: null })

    const { POST } = await import('@/app/api/payment/verify/route')
    const res = await POST(baseRequest({ reference: 'DHV-1' }))
    expect(res.status).toBe(200)
    expect(createAuditLog).toHaveBeenCalled()
  })

  it('late success after CANCELLED: ignored (CHARACTERIZATION: known gap)', async () => {
    mockVerifyPaystack.mockResolvedValue({ data: { status: 'success', amount: 10000 } } as any)
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'CANCELLED', paymentStatus: 'CANCELLED', orderType: 'NORMAL', userId: 'customer-1' })

    const { POST } = await import('@/app/api/payment/verify/route')
    const res = await POST(baseRequest({ reference: 'DHV-1' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.alreadyProcessed).toBe(true)
    expect(ctx.payments[0].status).toBe('PENDING')
  })

  it('Order.userId null: completes when payment.userId matches auth user', async () => {
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: null })
    ctx.orderItems.push({ id: 'i1', orderId: 'o1', productId: 'prod1', productVariantId: null, quantity: 1, price: 100, availabilityType: 'IN_STOCK', product: { storeId: 'store1' } })
    ctx.users.push({ id: 'customer-1', email: 'c@test.com', profile: null })

    const { POST } = await import('@/app/api/payment/verify/route')
    const res = await POST(baseRequest({ reference: 'DHV-1' }))
    expect(res.status).toBe(200)
  })

  it('Payment.userId null: 404 for an authenticated user (payment belongs to no one)', async () => {
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: null, orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: 'customer-1' })

    const { POST } = await import('@/app/api/payment/verify/route')
    const res = await POST(baseRequest({ reference: 'DHV-1' }))
    expect(res.status).toBe(404)
  })
})
