import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const SECRET = process.env.PAYSTACK_TEST_SECRET || 'sk_test_webhook_char_secret'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/paystack', () => ({ verifyPaystackPayment: vi.fn() }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/stock-reservation', () => ({ reserveStock: vi.fn(() => Promise.resolve()), releaseStock: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/fulfillment-events', () => ({ recordFulfillmentEvent: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/notifications', () => ({ createNotification: vi.fn(() => Promise.resolve()) }))
vi.mock('@/lib/email', () => ({ sendPaymentFailedEmail: vi.fn(() => Promise.resolve()) }))
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
import { verifyPaystackPayment } from '@/lib/paystack'
import { createAuditLog } from '@/lib/audit-log'

const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyPaystack = vi.mocked(verifyPaystackPayment)
let handleOrderWebhook: any

function sign(body: string) {
  return crypto.createHmac('sha512', SECRET).update(body).digest('hex')
}

function buildMockPrisma() {
  const payments: any[] = []
  const orders: any[] = []
  const orderItems: any[] = []
  const users: any[] = []
  const carts: any[] = []

  const mockPrisma: any = {
    payment: {
      findUnique: vi.fn(async ({ where, include }: any) => {
        const p = payments.find((x) => x.reference === where.reference) || null
        if (!p) return null
        const order = orders.find((o) => o.id === p.orderId) || null
        if (include?.order) return { ...p, order: order ? { ...order } : null }
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
      findUnique: vi.fn(async ({ where }: any) => {
        const o = orders.find((x) => x.id === where.id) || null
        return o ? { ...o } : null
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = orders.findIndex((x) => x.id === where.id)
        if (idx === -1) return null
        orders[idx] = { ...orders[idx], ...data }
        return orders[idx]
      }),
    },
    orderItem: {
      findMany: vi.fn(async ({ where, include }: any) => {
        return orderItems.filter((x) => x.orderId === where.orderId).map((x) => ({ ...x }))
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = orderItems.findIndex((x) => x.id === where.id)
        if (idx === -1) return null
        orderItems[idx] = { ...orderItems[idx], ...data }
        return orderItems[idx]
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where, select }: any) => {
        const u = users.find((x) => x.id === where.id) || null
        if (!u) return null
        if (select) {
          const out: any = {}
          if (select.id) out.id = u.id
          if (select.email) out.email = u.email
          if (select.profile) out.profile = u.profile
          return out
        }
        return { ...u }
      }),
      findMany: vi.fn(async () => []),
    },
    cart: {
      findUnique: vi.fn(async ({ where }: any) => carts.find((x) => x.userId === where.userId) || null),
    },
    cartItem: {
      deleteMany: vi.fn(async () => ({})),
    },
    customerLoyalty: {
      update: vi.fn(async () => ({})),
    },
    rewardRedemption: {
      create: vi.fn(async ({ data }: any) => ({ id: 'r-' + Date.now(), ...data })),
    },
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
  }

  return { mockPrisma, payments, orders, orderItems, users, carts }
}

describe('order webhook characterization', () => {
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeAll(async () => {
    process.env.PAYSTACK_SECRET_KEY = SECRET
    const mod = await import('@/lib/webhooks/order-webhook-handler')
    handleOrderWebhook = mod.handleOrderWebhook
  })

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockPrisma()
    mockGetPrisma.mockReturnValue(ctx.mockPrisma as any)
    mockVerifyPaystack.mockResolvedValue({ data: { status: 'success', amount: 10000 } } as any)
  })

  function makeBody(ref: string) {
    return JSON.stringify({ event: 'charge.success', data: { reference: ref } })
  }

  it('success: processes and stores PAID/PROCESSING', async () => {
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: 'customer-1' })
    ctx.orderItems.push({ id: 'i1', orderId: 'o1', productId: 'prod1', productVariantId: null, quantity: 1, price: 100, availabilityType: 'IN_STOCK' })
    const body = makeBody('DHV-1')
    const res = await handleOrderWebhook(body, sign(body))
    expect(res.status).toBe(200)
    expect(ctx.payments[0].status).toBe('PAID')
    expect(ctx.orders[0].status).toBe('PROCESSING')
  })

  it('repeated success: idempotent', async () => {
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PAID' })
    ctx.orders.push({ id: 'o1', status: 'PROCESSING', paymentStatus: 'PAID', orderType: 'NORMAL', userId: 'customer-1' })
    const body = makeBody('DHV-1')
    const res1 = await handleOrderWebhook(body, sign(body))
    const res2 = await handleOrderWebhook(body, sign(body))
    expect(res1.status).toBe(200)
    expect((await res1.json()).alreadyProcessed).toBe(true)
    expect(res2.status).toBe(200)
    expect((await res2.json()).alreadyProcessed).toBe(true)
  })

  it('failed: marks FAILED/CANCELLED and writes audit log', async () => {
    mockVerifyPaystack.mockResolvedValue({ data: { status: 'failed', amount: 10000 } } as any)
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: 'customer-1' })
    ctx.users.push({ id: 'customer-1', email: 'c@test.com', profile: { firstName: 'C', lastName: 'U' } })
    const body = makeBody('DHV-1')
    const res = await handleOrderWebhook(body, sign(body))
    expect(res.status).toBe(200)
    expect(ctx.payments[0].status).toBe('FAILED')
    expect(ctx.orders[0].status).toBe('CANCELLED')
    expect(createAuditLog).toHaveBeenCalled()
  })

  it('abandoned: marks CANCELLED', async () => {
    mockVerifyPaystack.mockResolvedValue({ data: { status: 'abandoned', amount: 10000 } } as any)
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: 'customer-1' })
    const body = makeBody('DHV-1')
    const res = await handleOrderWebhook(body, sign(body))
    expect(res.status).toBe(200)
    expect(ctx.payments[0].status).toBe('CANCELLED')
    expect(ctx.orders[0].status).toBe('CANCELLED')
  })

  it('amount mismatch: still succeeds and writes audit log', async () => {
    mockVerifyPaystack.mockResolvedValue({ data: { status: 'success', amount: 10500 } } as any)
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: 'customer-1' })
    ctx.orderItems.push({ id: 'i1', orderId: 'o1', productId: 'prod1', productVariantId: null, quantity: 1, price: 100, availabilityType: 'IN_STOCK' })
    const body = makeBody('DHV-1')
    const res = await handleOrderWebhook(body, sign(body))
    expect(res.status).toBe(200)
    expect(createAuditLog).toHaveBeenCalled()
  })

  it('late success after CANCELLED: ignored (CHARACTERIZATION: known gap)', async () => {
    mockVerifyPaystack.mockResolvedValue({ data: { status: 'success', amount: 10000 } } as any)
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'CANCELLED', paymentStatus: 'CANCELLED', orderType: 'NORMAL', userId: 'customer-1' })
    const body = makeBody('DHV-1')
    const res = await handleOrderWebhook(body, sign(body))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.alreadyProcessed).toBe(true)
    expect(ctx.payments[0].status).toBe('PENDING')
  })

  it('Order.userId null: completes', async () => {
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: 'customer-1', orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: null })
    ctx.orderItems.push({ id: 'i1', orderId: 'o1', productId: 'prod1', productVariantId: null, quantity: 1, price: 100, availabilityType: 'IN_STOCK' })
    const body = makeBody('DHV-1')
    const res = await handleOrderWebhook(body, sign(body))
    expect(res.status).toBe(200)
  })

  it('Payment.userId null: completes but audit log receives null (CHARACTERIZATION: swallowed audit error)', async () => {
    ctx.payments.push({ id: 'p1', reference: 'DHV-1', userId: null, orderId: 'o1', amount: 100, currency: 'GHS', status: 'PENDING' })
    ctx.orders.push({ id: 'o1', status: 'PENDING', paymentStatus: 'PENDING', orderType: 'NORMAL', userId: null })
    ctx.orderItems.push({ id: 'i1', orderId: 'o1', productId: 'prod1', productVariantId: null, quantity: 1, price: 100, availabilityType: 'IN_STOCK' })
    const body = makeBody('DHV-1')
    const res = await handleOrderWebhook(body, sign(body))
    expect(res.status).toBe(200)
    // audit log called with null userId
    expect(createAuditLog).toHaveBeenCalled()
  })
})
