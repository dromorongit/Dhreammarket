import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  order: { findFirst: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

import { getReceiptByToken } from '@/lib/receipts'

const VALID_TOKEN = 'abcdef1234567890abcdef1234567890'

function mockOrder(overrides: any = {}) {
  prismaMock.order.findFirst.mockResolvedValue({
    id: 'order_1',
    source: 'MANUAL',
    receiptToken: VALID_TOKEN,
    status: 'PROCESSING',
    paymentStatus: 'PAID',
    paymentMethod: 'MOBILE_MONEY',
    customerFirstName: 'Kofi',
    customerLastName: 'Mensah',
    customerPhone: '+233242222222',
    customerEmail: 'kofi@example.com',
    customerAddress: '123 Street',
    subtotal: 20,
    shipping: 5,
    total: 25,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    vendorCustomer: {
      store: {
        name: 'Kofi Store',
        slug: 'kofi-store',
        logo: null,
        mainPhoneNumber: '+233242222222',
        whatsappNumber: '+233242222222',
      },
    },
    items: [
      {
        product: { name: 'Widget' },
        productVariant: { color: 'Red', size: null, age: null },
        quantity: 2,
        price: 10,
      },
      {
        product: { name: 'Gadget' },
        productVariant: null,
        quantity: 1,
        price: 5,
      },
    ],
    ...overrides,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getReceiptByToken', () => {
  it('returns null for malformed tokens without querying the database', async () => {
    const result = await getReceiptByToken('not-a-token')
    expect(result).toBeNull()
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled()

    const result2 = await getReceiptByToken('abc')
    expect(result2).toBeNull()
    expect(prismaMock.order.findFirst).not.toHaveBeenCalled()
  })

  it('returns null for unknown tokens', async () => {
    prismaMock.order.findFirst.mockResolvedValue(null)
    const result = await getReceiptByToken(VALID_TOKEN)
    expect(result).toBeNull()
  })

  it('returns null for ONLINE orders (no information leak)', async () => {
    // A real query with source: 'MANUAL' never matches an ONLINE order.
    prismaMock.order.findFirst.mockResolvedValue(null)
    const result = await getReceiptByToken(VALID_TOKEN)
    expect(result).toBeNull()
    // Verify the query scopes to MANUAL only
    const where = prismaMock.order.findFirst.mock.calls[0]?.[0]?.where
    expect(where.source).toBe('MANUAL')
  })

  it('returns a minimal DTO for MANUAL orders without phone/email/address', async () => {
    mockOrder()
    const result = await getReceiptByToken(VALID_TOKEN)
    expect(result).not.toBeNull()

    const dto = result!
    expect(dto.storeName).toBe('Kofi Store')
    expect(dto.storeSlug).toBe('kofi-store')
    expect(dto.displayNumber).toBe('ORDER_1')
    expect(dto.createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(dto.items).toEqual([
      {
        name: 'Widget',
        variantLabel: 'Red',
        quantity: 2,
        unitPrice: 10,
        lineTotal: 20,
      },
      {
        name: 'Gadget',
        variantLabel: null,
        quantity: 1,
        unitPrice: 5,
        lineTotal: 5,
      },
    ])
    expect(dto.subtotal).toBe(20)
    expect(dto.deliveryFee).toBe(5)
    expect(dto.total).toBe(25)
    expect(dto.currency).toBe('GHS')
    expect(dto.paymentStatus).toBe('PAID')
    expect(dto.paymentMethod).toBe('MOBILE_MONEY')
    expect(dto.status).toBe('PROCESSING')
    expect(dto.customerFirstName).toBe('Kofi')

    // Must NOT contain sensitive customer data as top-level properties
    expect(dto).not.toHaveProperty('customerPhone')
    expect(dto).not.toHaveProperty('customerEmail')
    expect(dto).not.toHaveProperty('customerAddress')
    expect(dto).not.toHaveProperty('customerLastName')
    // storeContact is the store's public contact (intentionally exposed)
    expect(dto.storeContact).toBeDefined()
    // Customer phone/email/address must not appear as any DTO field value
    const dtoString = JSON.stringify(dto)
    expect(dtoString).not.toContain('kofi@example.com')
    expect(dtoString).not.toContain('123 Street')
  })

  it('marks unpaid orders as UNPAID with null paymentMethod', async () => {
    mockOrder({ paymentStatus: 'PENDING', paymentMethod: null })
    const result = await getReceiptByToken(VALID_TOKEN)
    expect(result?.paymentStatus).toBe('UNPAID')
    expect(result?.paymentMethod).toBeNull()
  })

  it('queries only MANUAL orders', async () => {
    mockOrder()
    await getReceiptByToken(VALID_TOKEN)
    const where = prismaMock.order.findFirst.mock.calls[0]?.[0]?.where
    expect(where.source).toBe('MANUAL')
    expect(where.receiptToken).toBe(VALID_TOKEN)
  })

  it('reads the order with a select, so no cost field is ever loaded', async () => {
    mockOrder()
    await getReceiptByToken(VALID_TOKEN)

    const query = prismaMock.order.findFirst.mock.calls[0]?.[0]

    // An `include` would load every column of the order and of its lines,
    // the delivery cost of the vendor and the cost snapshot of the line
    // included. The receipt is public: the token is the only gate.
    expect(query.include).toBeUndefined()
    expect(query.select).toBeDefined()

    const selected = JSON.stringify(query.select)
    expect(selected).not.toContain('costPrice')
    expect(selected).not.toContain('deliveryCost')
  })

  it('never puts a cost field in the receipt of a buyer', async () => {
    mockOrder({
      deliveryCost: 7.5,
      items: [
        {
          product: { name: 'Widget' },
          productVariant: { color: 'Red', size: null, age: null },
          quantity: 2,
          price: 10,
          costPriceSnapshot: 4,
        },
      ],
    })

    const result = await getReceiptByToken(VALID_TOKEN)
    const receipt = JSON.stringify(result)

    expect(receipt).not.toContain('costPrice')
    expect(receipt).not.toContain('deliveryCost')
    expect(receipt).not.toContain('7.5')
  })
})
