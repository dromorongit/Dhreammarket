import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  store: { findUnique: vi.fn() },
  product: { count: vi.fn(), findMany: vi.fn() },
  order: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    aggregate: vi.fn(),
  },
  refund: { findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))

import { loadVendorReceivables } from '@/lib/vendor-sales-data'
import {
  createFakeSalesPrisma,
  type FakeOrder,
  type FakeProduct,
} from '@/app/api/vendor/sales-summary/fake-sales-db.test-utils'

const NOW = new Date('2026-11-02T00:00:00.000Z')

const PRODUCTS: FakeProduct[] = [
  {
    id: 'prod_1',
    storeId: 'store_1',
    name: 'Widget',
    price: 20,
    costPrice: 5,
    variants: [],
  },
]

function buildOrder(overrides: Partial<FakeOrder> = {}): FakeOrder {
  return {
    id: 'order_1',
    source: 'MANUAL',
    channel: 'WHATSAPP',
    status: 'PROCESSING',
    paymentStatus: 'PENDING',
    createdAt: new Date('2026-10-10T12:00:00.000Z'),
    total: 40,
    vendorEarnings: null,
    netAmount: null,
    deliveryCost: 5,
    customerFirstName: 'Kofi',
    customerLastName: 'Mensah',
    customerPhone: '+233242222222',
    receiptToken: 'receipt_1',
    paymentMethod: 'CASH',
    deletedAt: null,
    items: [
      {
        id: 'item_1',
        productId: 'prod_1',
        productVariantId: null,
        quantity: 2,
        price: 20,
        costPriceSnapshot: 5,
        vendorEarnings: null,
        product: { id: 'prod_1', name: 'Widget', costPrice: 5 },
        productVariant: null,
      },
    ],
    ...overrides,
  }
}

function useFakeDb(orders: FakeOrder[]) {
  const fake = createFakeSalesPrisma({
    store: { id: 'store_1', userId: 'vendor_1' },
    products: PRODUCTS,
    orders,
    refunds: [],
  })

  prismaMock.store.findUnique.mockImplementation(fake.store.findUnique)
  prismaMock.product.count.mockImplementation(fake.product.count)
  prismaMock.product.findMany.mockImplementation(fake.product.findMany)
  prismaMock.order.count.mockImplementation(fake.order.count)
  prismaMock.order.findMany.mockImplementation(fake.order.findMany)
  prismaMock.order.findFirst.mockImplementation(fake.order.findFirst)
  prismaMock.order.aggregate.mockImplementation(fake.order.aggregate)
  prismaMock.refund.findMany.mockImplementation(fake.refund.findMany)

  return fake
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the receivables are not limited by the period', () => {
  it('counts an unpaid manual sale made long before the period', async () => {
    useFakeDb([
      buildOrder({
        id: 'order_old',
        createdAt: new Date('2025-01-05T12:00:00.000Z'),
        total: 75,
      }),
    ])

    const receivables = await loadVendorReceivables('store_1', NOW)

    expect(receivables.count).toBe(1)
    expect(receivables.amount).toBe(75)
    expect(receivables.amountPesawas).toBe(7500)
    expect(receivables.orders[0].id).toBe('order_old')
  })

  it('reports the age of the oldest receivable', async () => {
    useFakeDb([
      buildOrder({ id: 'order_new', createdAt: new Date('2026-10-30T12:00:00.000Z') }),
      buildOrder({ id: 'order_old', createdAt: new Date('2025-01-05T12:00:00.000Z') }),
    ])

    const receivables = await loadVendorReceivables('store_1', NOW)

    expect(receivables.count).toBe(2)
    expect(receivables.orders[0].id).toBe('order_old')
    expect(receivables.oldestCreatedAt).toBe('2025-01-05T12:00:00.000Z')
    expect(receivables.oldestAgeDays).toBeGreaterThan(300)
  })

  it('leaves out a paid manual sale', async () => {
    useFakeDb([buildOrder({ paymentStatus: 'PAID' })])
    const receivables = await loadVendorReceivables('store_1', NOW)
    expect(receivables.count).toBe(0)
    expect(receivables.amount).toBe(0)
  })

  it('leaves out a cancelled manual sale', async () => {
    useFakeDb([buildOrder({ status: 'CANCELLED' })])
    const receivables = await loadVendorReceivables('store_1', NOW)
    expect(receivables.count).toBe(0)
  })

  it('leaves out an unpaid online order', async () => {
    useFakeDb([buildOrder({ source: 'ONLINE' })])
    const receivables = await loadVendorReceivables('store_1', NOW)
    expect(receivables.count).toBe(0)
  })

  it('leaves out another store\'s receivable', async () => {
    const otherProduct: FakeProduct = {
      id: 'prod_2',
      storeId: 'store_2',
      name: 'Other gadget',
      price: 10,
      costPrice: 2,
      variants: [],
    }
    const fake = createFakeSalesPrisma({
      store: { id: 'store_1', userId: 'vendor_1' },
      products: [...PRODUCTS, otherProduct],
      orders: [
        buildOrder({
          id: 'order_other',
          items: [
            {
              id: 'item_other',
              productId: 'prod_2',
              productVariantId: null,
              quantity: 1,
              price: 10,
              costPriceSnapshot: 2,
              vendorEarnings: null,
              product: { id: 'prod_2', name: 'Other gadget', costPrice: 2 },
              productVariant: null,
            },
          ],
        }),
      ],
      refunds: [],
    })
    prismaMock.order.count.mockImplementation(fake.order.count)
    prismaMock.order.findMany.mockImplementation(fake.order.findMany)
    prismaMock.order.findFirst.mockImplementation(fake.order.findFirst)
    prismaMock.order.aggregate.mockImplementation(fake.order.aggregate)

    const receivables = await loadVendorReceivables('store_1', NOW)
    expect(receivables.count).toBe(0)
  })

  it('never asks for a date range', async () => {
    useFakeDb([buildOrder()])
    await loadVendorReceivables('store_1', NOW)

    const where = prismaMock.order.count.mock.calls[0][0].where as any
    expect(where.createdAt).toBeUndefined()
    expect(where.source).toBe('MANUAL')
    expect(where.paymentStatus).toBe('PENDING')
    expect(where.status.not).toBe('CANCELLED')
  })
})
