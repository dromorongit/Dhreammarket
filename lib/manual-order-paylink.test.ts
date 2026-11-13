import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  payment: { findUnique: vi.fn(), upsert: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

const initializePaystackPaymentMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/paystack', () => ({ initializePaystackPayment: initializePaystackPaymentMock }))

import { ensurePayLinkForOrder } from '@/lib/manual-order-paylink'

const baseOrder = {
  id: 'order_1',
  source: 'MANUAL',
  status: 'PROCESSING',
  paymentStatus: 'PENDING',
  total: 25,
  receiptToken: 'ab12cd34ef56gh78ij90kl12mn34op56qr',
  customerEmail: 'ada@example.com',
  storeId: 'store_1',
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.payment.findUnique.mockResolvedValue(null)
  prismaMock.payment.upsert.mockResolvedValue({
    authorizationUrl: 'https://paystack.co/pay/new',
    reference: 'MAN-NEW',
  })
  delete process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN
  initializePaystackPaymentMock.mockResolvedValue({
    status: true,
    message: 'success',
    data: { authorization_url: 'https://paystack.co/pay/abc', reference: 'MAN-REF', access_code: 'ac_1' },
  })
})

describe('ensurePayLinkForOrder', () => {
  it('reuses a live PENDING link', async () => {
    prismaMock.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      reference: 'MAN-EXISTING',
      amount: 25,
      status: 'PENDING',
      authorizationUrl: 'https://paystack.co/pay/existing',
      updatedAt: new Date(),
      createdAt: new Date(),
    })

    const result = await ensurePayLinkForOrder(baseOrder)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.authorizationUrl).toBe('https://paystack.co/pay/existing')
      expect(result.reference).toBe('MAN-EXISTING')
    }
    expect(initializePaystackPaymentMock).not.toHaveBeenCalled()
  })

  it('creates a fresh link when an existing PENDING link is stale', async () => {
    prismaMock.payment.findUnique.mockResolvedValue({
      id: 'pay_1',
      reference: 'MAN-STALE',
      amount: 25,
      status: 'PENDING',
      authorizationUrl: 'https://paystack.co/pay/stale',
      updatedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    })

    const result = await ensurePayLinkForOrder(baseOrder)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.authorizationUrl).toBe('https://paystack.co/pay/new')
    expect(initializePaystackPaymentMock).toHaveBeenCalledTimes(1)
  })

  it('returns receipt URL when already paid', async () => {
    const result = await ensurePayLinkForOrder({ ...baseOrder, paymentStatus: 'PAID' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.paymentStatus).toBe('PAID')
      expect(result.authorizationUrl).toBeNull()
      expect(result.receiptUrl).toContain('/receipt/')
    }
    expect(initializePaystackPaymentMock).not.toHaveBeenCalled()
  })

  it('rejects cancelled orders', async () => {
    const result = await ensurePayLinkForOrder({ ...baseOrder, status: 'CANCELLED' })
    expect(result).toEqual({ ok: false, status: 409, error: 'Cannot create a pay link for a cancelled order' })
  })

  it('uses fallback email domain when customer email is missing', async () => {
    process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN = 'paylinks.example.com'
    const result = await ensurePayLinkForOrder({ ...baseOrder, customerEmail: null })
    expect(result.ok).toBe(true)
    expect(initializePaystackPaymentMock).toHaveBeenCalledWith(
      expect.stringMatching(/^pay\+.+@paylinks\.example\.com$/),
      25,
      expect.stringMatching(/^MAN-/),
      expect.stringContaining('/receipt/'),
      expect.objectContaining({ orderId: 'order_1', source: 'MANUAL', storeId: 'store_1' })
    )
  })

  it('accepts a plain customer email', async () => {
    const result = await ensurePayLinkForOrder({ ...baseOrder, customerEmail: 'ada@example.com' })
    expect(result.ok).toBe(true)
    expect(initializePaystackPaymentMock).toHaveBeenCalledWith(
      'ada@example.com',
      25,
      expect.stringMatching(/^MAN-/),
      expect.stringContaining('/receipt/'),
      expect.objectContaining({ orderId: 'order_1', source: 'MANUAL', storeId: 'store_1' })
    )
  })

  it('accepts plus-addressing in customer email', async () => {
    const result = await ensurePayLinkForOrder({ ...baseOrder, customerEmail: 'pay+ORDER_1@paylinks.example.com' })
    expect(result.ok).toBe(true)
    expect(initializePaystackPaymentMock).toHaveBeenCalledWith(
      'pay+ORDER_1@paylinks.example.com',
      25,
      expect.stringMatching(/^MAN-/),
      expect.stringContaining('/receipt/'),
      expect.objectContaining({ orderId: 'order_1', source: 'MANUAL', storeId: 'store_1' })
    )
  })

  it('accepts subdomain customer email', async () => {
    const result = await ensurePayLinkForOrder({ ...baseOrder, customerEmail: 'ada@mail.example.co.uk' })
    expect(result.ok).toBe(true)
    expect(initializePaystackPaymentMock).toHaveBeenCalledWith(
      'ada@mail.example.co.uk',
      25,
      expect.stringMatching(/^MAN-/),
      expect.stringContaining('/receipt/'),
      expect.objectContaining({ orderId: 'order_1', source: 'MANUAL', storeId: 'store_1' })
    )
  })

  it('accepts uppercase customer email', async () => {
    const result = await ensurePayLinkForOrder({ ...baseOrder, customerEmail: 'ADA@EXAMPLE.COM' })
    expect(result.ok).toBe(true)
    expect(initializePaystackPaymentMock).toHaveBeenCalledWith(
      'ADA@EXAMPLE.COM',
      25,
      expect.stringMatching(/^MAN-/),
      expect.stringContaining('/receipt/'),
      expect.objectContaining({ orderId: 'order_1', source: 'MANUAL', storeId: 'store_1' })
    )
  })

  it('normalises fallback domain setting with email to domain', async () => {
    process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN = 'info@dhreamarket.com'
    const result = await ensurePayLinkForOrder({ ...baseOrder, customerEmail: null })
    expect(result.ok).toBe(true)
    expect(initializePaystackPaymentMock).toHaveBeenCalledWith(
      expect.stringMatching(/^pay\+.+@dhreamarket\.com$/),
      25,
      expect.stringMatching(/^MAN-/),
      expect.stringContaining('/receipt/'),
      expect.objectContaining({ orderId: 'order_1', source: 'MANUAL', storeId: 'store_1' })
    )
  })

  it('normalises uppercase fallback domain setting', async () => {
    process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN = 'WWW.PAYLINKS.EXAMPLE.COM'
    const result = await ensurePayLinkForOrder({ ...baseOrder, customerEmail: null })
    expect(result.ok).toBe(true)
    expect(initializePaystackPaymentMock).toHaveBeenCalledWith(
      expect.stringMatching(/^pay\+.+@paylinks\.example\.com$/),
      25,
      expect.stringMatching(/^MAN-/),
      expect.stringContaining('/receipt/'),
      expect.objectContaining({ orderId: 'order_1', source: 'MANUAL', storeId: 'store_1' })
    )
  })

  it('returns distinct error when no fallback domain is set', async () => {
    delete process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN
    const result = await ensurePayLinkForOrder({ ...baseOrder, customerEmail: null })
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Customer email is required and no fallback email domain is set',
    })
  })

  it('returns distinct error when fallback domain is empty', async () => {
    process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN = '   '
    const result = await ensurePayLinkForOrder({ ...baseOrder, customerEmail: null })
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Customer email is required and no fallback email domain is set',
    })
  })

  it('returns distinct error when fallback domain is malformed', async () => {
    process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN = 'not-a-domain'
    const result = await ensurePayLinkForOrder({ ...baseOrder, customerEmail: null })
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Fallback email domain setting is malformed',
    })
  })

  it('returns distinct error when fallback domain normalizes to invalid value', async () => {
    process.env.PAYLINK_FALLBACK_EMAIL_DOMAIN = '@@@'
    const result = await ensurePayLinkForOrder({ ...baseOrder, customerEmail: null })
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'Fallback email domain setting is malformed',
    })
  })
})
