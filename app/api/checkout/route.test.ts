import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  getCommissionRate: vi.fn(),
  initializePaystackPayment: vi.fn(),
  isPaystackConfigured: vi.fn(),
  rateLimit: vi.fn(),
  sendOrderConfirmationEmail: vi.fn(),
  canSendCustomerEmail: vi.fn(),
  createNotification: vi.fn(),
  recordFulfillmentEvent: vi.fn(),
  reserveStock: vi.fn(),
  getUnitPrice: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/auth-middleware', () => ({ verifyToken: mocks.verifyToken }))
vi.mock('@/lib/paystack', () => ({
  initializePaystackPayment: mocks.initializePaystackPayment,
  isPaystackConfigured: mocks.isPaystackConfigured,
}))
vi.mock('@/lib/revenue', () => ({ getCommissionRate: mocks.getCommissionRate }))
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit }))
vi.mock('@/lib/email', () => ({ sendOrderConfirmationEmail: mocks.sendOrderConfirmationEmail }))
vi.mock('@/lib/notification-preferences', () => ({ canSendCustomerEmail: mocks.canSendCustomerEmail }))
vi.mock('@/lib/notifications', () => ({ createNotification: mocks.createNotification }))
vi.mock('@/lib/fulfillment-events', () => ({ recordFulfillmentEvent: mocks.recordFulfillmentEvent }))
vi.mock('@/lib/stock-reservation', () => ({ reserveStock: mocks.reserveStock }))
vi.mock('@/lib/pricing', () => ({ getUnitPrice: mocks.getUnitPrice }))

import { getPrisma } from '@/lib/prisma'
import { POST } from '@/app/api/checkout/route'
import { GHANA_REGIONS } from '@/lib/cancellation-policy'

const mockGetPrisma = vi.mocked(getPrisma)
let ctx: any

const product = {
  id: 'p1',
  name: 'Widget',
  storeId: 's1',
  price: 50,
  stock: 10,
  reservedQuantity: 0,
  availabilityType: 'IN_STOCK',
  dealsPrice: null,
  salesPrice: null,
  expectedArrivalDate: null,
  expectedRestockDate: null,
  store: { id: 's1', name: 'Store', slug: 'store', mainPhoneNumber: null, whatsappNumber: null, location: null },
}
const variant = { id: 'v1', productId: 'p1', price: 50, stock: 10, reservedQuantity: 0, active: true }

const cart = {
  id: 'cart_1',
  userId: 'user_1',
  items: [{ id: 'ci_1', cartId: 'cart_1', productId: 'p1', productVariantId: 'v1', quantity: 1, product, productVariant: variant }],
}

function buildMockPrisma() {
  const orderCreate = vi.fn(async (args: any) => ({ id: 'order_1', ...args.data }))
  const paymentCreate = vi.fn(async (args: any) => ({ id: 'pay_1', ...args.data }))
  const orderItemCreate = vi.fn(async () => ({ id: 'oi_1' }))
  const mockPrisma = {
    cart: { findUnique: vi.fn(async () => cart) },
    order: { findFirst: vi.fn(async () => null), create: orderCreate },
    payment: { create: paymentCreate, update: vi.fn(async () => ({})) },
    user: { findUnique: vi.fn(async () => ({ id: 'user_1', email: 'ada@example.test' })) },
    customerLoyalty: { findUnique: vi.fn(async () => ({ walletBalance: 0 })) },
    store: { findMany: vi.fn(async () => [{ id: 's1', userId: 'vendor_1' }]) },
    profile: { findUnique: vi.fn(async () => null) },
    $transaction: vi.fn(async (callback: any) => {
      const tx = {
        order: { create: orderCreate },
        payment: { create: paymentCreate },
        orderItem: { create: orderItemCreate },
        customerLoyalty: { update: vi.fn(async () => ({})) },
        rewardRedemption: { create: vi.fn(async () => ({})) },
      }
      return callback(tx)
    }),
  }
  return { mockPrisma, orderCreate, paymentCreate }
}

function requestWithToken(body: any) {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { cookie: 'token=token_user_1', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

describe('POST /api/checkout region validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verifyToken.mockResolvedValue({ authenticated: true, userId: 'user_1', role: 'CUSTOMER', sessionId: 'sess_1' })
    mocks.isPaystackConfigured.mockReturnValue(true)
    mocks.initializePaystackPayment.mockResolvedValue({ data: { authorization_url: 'https://paystack.example/pay', reference: 'ref_1' } })
    mocks.getCommissionRate.mockResolvedValue(0.1)
    mocks.rateLimit.mockReturnValue(() => ({ success: true }))
    mocks.sendOrderConfirmationEmail.mockResolvedValue(undefined)
    mocks.canSendCustomerEmail.mockResolvedValue(true)
    mocks.createNotification.mockResolvedValue(undefined)
    mocks.recordFulfillmentEvent.mockResolvedValue(undefined)
    mocks.reserveStock.mockResolvedValue({ success: true })
    mocks.getUnitPrice.mockReturnValue(50)

    const c = buildMockPrisma()
    mockGetPrisma.mockReturnValue(c.mockPrisma as any)
    ctx = c
  })

  it('rejects an unknown region with 400 and does not create an order or call Paystack', async () => {
    const response = await POST(requestWithToken({
      customerInfo: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', phone: '0550000000', region: 'Nowhere', city: 'Accra', address: '123 Street', notes: '' },
      idempotencyKey: 'key_1',
    }) as any)
    expect(response.status).toBe(400)
    expect(ctx.orderCreate).not.toHaveBeenCalled()
    expect(mocks.initializePaystackPayment).not.toHaveBeenCalled()
  })

  it('accepts each of the 16 Ghana regions and stores the canonical name', async () => {
    for (const region of GHANA_REGIONS) {
      ctx.orderCreate.mockClear()
      mocks.initializePaystackPayment.mockClear()
      const response = await POST(requestWithToken({
        customerInfo: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', phone: '0550000000', region, city: 'Accra', address: '123 Street', notes: '' },
        idempotencyKey: `key_${region}`,
      }) as any)
      expect(response.status).toBe(200)
      expect(ctx.orderCreate).toHaveBeenCalledTimes(1)
      expect(ctx.orderCreate.mock.calls[0][0].data.customerRegion).toBe(region)
      expect(mocks.initializePaystackPayment).toHaveBeenCalledTimes(1)
    }
  })
})
