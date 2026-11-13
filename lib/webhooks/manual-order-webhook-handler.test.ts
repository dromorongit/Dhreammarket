import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import crypto from 'crypto'

const mocks = vi.hoisted(() => ({
  paymentFindUnique: vi.fn(),
  paymentUpdateMany: vi.fn(),
  paymentUpdate: vi.fn(),
  orderUpdateMany: vi.fn(),
  orderUpdate: vi.fn(),
  orderItemFindMany: vi.fn(),
  orderItemUpdate: vi.fn(),
  orderItemFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  createAuditLog: vi.fn(),
  invalidateSalesSummaryCache: vi.fn(),
  verifyPaystackPayment: vi.fn(),
  orderDisplayNumber: vi.fn(),
}))

const prismaMock = vi.hoisted(() => ({
  payment: {
    findUnique: mocks.paymentFindUnique,
    updateMany: mocks.paymentUpdateMany,
    update: mocks.paymentUpdate,
  },
  order: {
    updateMany: mocks.orderUpdateMany,
    update: mocks.orderUpdate,
  },
  orderItem: {
    findMany: mocks.orderItemFindMany,
    update: mocks.orderItemUpdate,
    findFirst: mocks.orderItemFindFirst,
  },
  user: {
    findMany: mocks.userFindMany,
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))
vi.mock('@/lib/paystack', () => ({ verifyPaystackPayment: mocks.verifyPaystackPayment }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }))
vi.mock('@/lib/notifications', () => ({ createNotification: mocks.notificationCreate }))
vi.mock('@/lib/sales-summary-cache', () => ({ invalidateSalesSummaryCache: mocks.invalidateSalesSummaryCache }))
vi.mock('@/lib/site-config', () => ({ PAYSTACK_FEE_PERCENTAGE: 0.0195 }))
vi.mock('@/lib/manual-orders', () => ({ orderDisplayNumber: mocks.orderDisplayNumber }))

const SECRET = 'sk_test_manual_webhook_key_0001'

let handleManualOrderWebhook: typeof import('@/lib/webhooks/manual-order-webhook-handler').handleManualOrderWebhook

beforeAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = SECRET
  const mod = await import('@/lib/webhooks/manual-order-webhook-handler')
  handleManualOrderWebhook = mod.handleManualOrderWebhook
})

function sign(body: string): string {
  return crypto.createHmac('sha512', SECRET).update(body).digest('hex')
}

function bodyWith(reference: string): string {
  return JSON.stringify({ event: 'charge.success', data: { reference } })
}

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pay_1',
    orderId: 'order_1',
    reference: 'MAN-REF',
    amount: 150,
    currency: 'GHS',
    status: 'PENDING',
    userId: null,
    paystackRef: null,
    ...overrides,
  }
}

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order_1',
    userId: null,
    total: 150,
    status: 'PENDING',
    paymentStatus: 'PENDING',
    source: 'MANUAL',
    customerFirstName: 'Ada',
    customerLastName: 'User',
    customerEmail: 'ada@example.com',
    ...overrides,
  }
}

function paystackData(overrides: Record<string, unknown> = {}) {
  return {
    status: true,
    message: 'success',
    data: {
      reference: 'MAN-REF',
      amount: 15000,
      currency: 'GHS',
      status: 'success',
      fees: 293,
      customer: { email: 'ada@example.com', first_name: 'Ada', last_name: 'User', phone: null },
      metadata: { orderId: 'order_1' },
    },
    ...overrides,
  }
}

function storeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'store_1',
    userId: 'vendor_1',
    name: 'Fake Store',
    ...overrides,
  }
}

function mockTx() {
  const tx = {
    order: {
      updateMany: mocks.orderUpdateMany,
      update: mocks.orderUpdate,
    },
    orderItem: {
      findMany: mocks.orderItemFindMany,
      update: mocks.orderItemUpdate,
    },
  }
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx))
  return tx
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.paymentFindUnique.mockResolvedValue({ ...paymentRow(), order: orderRow() })
  mocks.paymentUpdateMany.mockResolvedValue({ count: 1 })
  mocks.paymentUpdate.mockResolvedValue({})
  mocks.orderUpdateMany.mockResolvedValue({ count: 1 })
  mocks.orderUpdate.mockResolvedValue({})
  mocks.orderItemFindMany.mockResolvedValue([])
  mocks.orderItemUpdate.mockResolvedValue({})
  mocks.orderItemFindFirst.mockResolvedValue({
    product: { store: storeRow() },
  })
  mocks.userFindMany.mockResolvedValue([{ id: 'admin_1' }])
  mocks.notificationCreate.mockResolvedValue(undefined)
  mocks.createAuditLog.mockResolvedValue(undefined)
  mocks.invalidateSalesSummaryCache.mockResolvedValue(undefined)
  mocks.verifyPaystackPayment.mockResolvedValue(paystackData())
  mocks.orderDisplayNumber.mockImplementation((id: string) => id.slice(-8).toUpperCase())
  mockTx()
})

describe('handleManualOrderWebhook', () => {
  it('rejects a bad signature with 401', async () => {
    // A wrong signature of the same byte length as a real sha512 hex digest,
    // so timingSafeEqual compares equal-length buffers and returns false.
    const response = await handleManualOrderWebhook(bodyWith('MAN-REF'), '0'.repeat(128))
    const json = await response.json()
    expect(response.status).toBe(401)
    expect(json.error).toBe('Invalid signature')
  })

  it('rejects a missing signature', async () => {
    const response = await handleManualOrderWebhook(bodyWith('MAN-REF'), undefined)
    expect(response.status).toBe(401)
  })

  it('marks payment and order PAID on a successful webhook', async () => {
    const response = await handleManualOrderWebhook(bodyWith('MAN-REF'), sign(bodyWith('MAN-REF')))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json).toEqual({ received: true })
    expect(mocks.paymentUpdateMany).toHaveBeenCalledWith({
      where: { id: 'pay_1', status: 'PENDING' },
      data: { status: 'PAID', paystackRef: 'MAN-REF' },
    })
    expect(mocks.orderUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'order_1',
        paymentStatus: { not: 'PAID' },
        status: { not: 'CANCELLED' },
      },
      data: expect.objectContaining({ paymentStatus: 'PAID', status: 'PROCESSING' }),
    })
  })

  it('keeps the processor fee to 2 decimals (150 pesewas -> 1.5)', async () => {
    mocks.verifyPaystackPayment.mockResolvedValue(
      paystackData({ data: { ...paystackData().data, fees: 150 } })
    )
    await handleManualOrderWebhook(bodyWith('MAN-REF'), sign(bodyWith('MAN-REF')))
    expect(mocks.orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_1' },
        data: expect.objectContaining({ processorFee: 1.5 }),
      })
    )
  })

  it('is idempotent: a duplicate webhook returns alreadyProcessed', async () => {
    mocks.paymentUpdateMany.mockResolvedValue({ count: 0 })
    const response = await handleManualOrderWebhook(bodyWith('MAN-REF'), sign(bodyWith('MAN-REF')))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json).toEqual({ received: true, alreadyProcessed: true })
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled()
  })

  it('resets the payment to PENDING when underpaid', async () => {
    // Paystack charged 100 GHS but the stored payment is 150 GHS.
    mocks.verifyPaystackPayment.mockResolvedValue(
      paystackData({ data: { ...paystackData().data, amount: 10000 } })
    )
    const response = await handleManualOrderWebhook(bodyWith('MAN-REF'), sign(bodyWith('MAN-REF')))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.reason).toBe('amount-mismatch')
    expect(mocks.paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'pay_1' },
      data: expect.objectContaining({ status: 'PENDING' }),
    })
  })

  it('handles an overpaid payment without failing', async () => {
    // Paystack charged 200 GHS but the stored payment is 150 GHS.
    mocks.verifyPaystackPayment.mockResolvedValue(
      paystackData({ data: { ...paystackData().data, amount: 20000 } })
    )
    const response = await handleManualOrderWebhook(bodyWith('MAN-REF'), sign(bodyWith('MAN-REF')))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json).toEqual({ received: true })
    expect(mocks.orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order_1' },
        data: expect.objectContaining({ grossAmount: 150 }),
      })
    )
  })

  it('returns order-finalized for a cancelled order', async () => {
    mocks.paymentFindUnique.mockResolvedValue({
      ...paymentRow(),
      order: orderRow({ status: 'CANCELLED', paymentStatus: 'PENDING' }),
    })
    const response = await handleManualOrderWebhook(bodyWith('MAN-REF'), sign(bodyWith('MAN-REF')))
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.reason).toBe('order-finalized')
    expect(mocks.orderUpdateMany).not.toHaveBeenCalled()
  })

  it('notifies the vendor with order number, amount and customer name', async () => {
    await handleManualOrderWebhook(bodyWith('MAN-REF'), sign(bodyWith('MAN-REF')))
    expect(mocks.notificationCreate).toHaveBeenCalledWith(
      'vendor_1',
      'ORDER_STATUS_UPDATED',
      'Order paid - ORDER_1',
      'Order ORDER_1 for Ada User paid: GHS 150.00.'
    )
  })

  it('writes the audit log with the store owner userId, not payment.userId', async () => {
    await handleManualOrderWebhook(bodyWith('MAN-REF'), sign(bodyWith('MAN-REF')))
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'vendor_1', userRole: 'SYSTEM', action: 'PAYMENT_CONFIRMED' })
    )
  })

  it('skips the audit log with a console.warn when no store owner exists', async () => {
    mocks.orderItemFindFirst.mockResolvedValue({ product: { store: null } })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await handleManualOrderWebhook(bodyWith('MAN-REF'), sign(bodyWith('MAN-REF')))
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
