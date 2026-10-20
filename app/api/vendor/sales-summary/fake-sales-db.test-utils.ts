// A tiny in-memory stand-in for the parts of Prisma the vendor money view
// uses.
//
// It is deliberately strict about the where clauses the report relies on
// (store scoping, the period, the source, the payment state) and it honours
// the cursor pagination, so the tests read like the real queries do.
//
// It is a test helper, not production code.

import { vi } from 'vitest'

export interface FakeProductVariant {
  id: string
  color: string | null
  size: string | null
  age: string | null
  sku: string | null
  price: number | null
  costPrice: number | null
}

export interface FakeProduct {
  id: string
  storeId: string
  name: string
  price: number
  costPrice: number | null
  availabilityType?: string
  variants: FakeProductVariant[]
}

export interface FakeOrderItem {
  id: string
  productId: string
  productVariantId: string | null
  quantity: number
  price: number
  costPriceSnapshot: number | null
  vendorEarnings: number | null
  product: { id: string; name: string; costPrice: number | null }
  productVariant: FakeProductVariant | null
}

export interface FakeOrder {
  id: string
  source: 'ONLINE' | 'MANUAL'
  channel: string | null
  status: string
  paymentStatus: string
  createdAt: Date
  total: number
  vendorEarnings: number | null
  netAmount: number | null
  deliveryCost: number | null
  customerFirstName: string | null
  customerLastName: string | null
  customerPhone: string | null
  receiptToken: string | null
  paymentMethod: string | null
  idempotencyKey?: string | null
  deletedAt: Date | null
  items: FakeOrderItem[]
}

export interface FakeRefund {
  id: string
  orderId: string | null
  amount: number
  status: string
  createdAt: Date
}

export interface FakeSalesStore {
  id: string
  userId: string
}

/**
 * The store id that owns an item of an order.
 *
 * A fake order holds the products of ONE store, which is how a manual order
 * works and how the report scopes an order to a vendor.
 */
function orderStoreId(order: FakeOrder): string | null {
  const item = order.items[0]
  if (!item) return null
  const product = fakeProducts.find((p) => p.id === item.productId)
  return product?.storeId ?? null
}

let fakeProducts: FakeProduct[] = []
let fakeOrders: FakeOrder[] = []
let fakeRefunds: FakeRefund[] = []
let fakeStore: FakeSalesStore = { id: 'store_1', userId: 'vendor_1' }

function matchesOrder(order: FakeOrder, where: any): boolean {
  if (!where) return true

  if ('deletedAt' in where) {
    if (where.deletedAt === null && order.deletedAt !== null) return false
  }

  if (where.source && order.source !== where.source) return false
  if (where.paymentStatus && order.paymentStatus !== where.paymentStatus) return false
  if (where.idempotencyKey && order.idempotencyKey !== where.idempotencyKey) return false

  if (where.status && typeof where.status === 'object' && where.status.not) {
    if (order.status === where.status.not) return false
  } else if (typeof where.status === 'string' && order.status !== where.status) {
    return false
  }

  if (where.createdAt) {
    const createdAt = order.createdAt.getTime()
    if (where.createdAt.gte && createdAt < where.createdAt.gte.getTime()) return false
    if (where.createdAt.lt && createdAt >= where.createdAt.lt.getTime()) return false
  }

  const itemFilter = where.items?.some
  if (itemFilter) {
    const storeId = itemFilter.product?.storeId
    const productIds = itemFilter.productId?.in
    const hasItem = order.items.some((item) => {
      if (productIds && !productIds.includes(item.productId)) return false
      if (storeId) {
        const product = fakeProducts.find((p) => p.id === item.productId)
        if (!product || product.storeId !== storeId) return false
      }
      return true
    })
    if (!hasItem) return false
  }

  return true
}

function sortOrders(orders: FakeOrder[], orderBy: any): FakeOrder[] {
  if (!orderBy) return orders
  const clauses = Array.isArray(orderBy) ? orderBy : [orderBy]
  return [...orders].sort((a, b) => {
    for (const clause of clauses) {
      const [field, direction] = Object.entries(clause as Record<string, string>)[0]
      const left = a[field as keyof FakeOrder] as any
      const right = b[field as keyof FakeOrder] as any
      if (left === right) continue
      const factor = direction === 'asc' ? 1 : -1
      return (left > right ? 1 : -1) * factor
    }
    return 0
  })
}

/**
 * A product row as the report reads it.
 */
function projectOrder(order: FakeOrder, select: any): any {
  const itemWhere = select?.items?.where
  const items = itemWhere?.product?.storeId
    ? order.items.filter((item) => {
        const product = fakeProducts.find((p) => p.id === item.productId)
        return product?.storeId === itemWhere.product.storeId
      })
    : order.items

  return { ...order, items }
}

export interface FakeSalesPrisma {
  store: { findUnique: any }
  product: { count: any; findMany: any }
  order: {
    count: any
    findMany: any
    findFirst: any
    aggregate: any
    create: any
    update: any
  }
  orderItem: { createMany: any }
  vendorCustomer: { upsert: any }
  refund: { findMany: any }
  $transaction: any
  /** Every where clause the order query was called with, in order. */
  orderQueries: any[]
}

export interface FakeSalesDbOptions {
  store?: FakeSalesStore
  products?: FakeProduct[]
  orders?: FakeOrder[]
  refunds?: FakeRefund[]
}

/**
 * Build a fake Prisma over the given rows.
 */
export function createFakeSalesPrisma(options: FakeSalesDbOptions = {}): FakeSalesPrisma {
  fakeProducts = options.products ?? []
  fakeOrders = options.orders ?? []
  fakeRefunds = options.refunds ?? []
  fakeStore = options.store ?? { id: 'store_1', userId: 'vendor_1' }

  const orderQueries: any[] = []

  const prisma: FakeSalesPrisma = {
    store: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (!where) return null
        if (where.userId && where.userId !== fakeStore.userId) return null
        if (where.id && where.id !== fakeStore.id) return null
        return { ...fakeStore }
      }),
    },
    product: {
      count: vi.fn(async ({ where }: any) => {
        return fakeProducts.filter((product) => {
          if (where?.storeId && product.storeId !== where.storeId) return false
          if (where?.costPrice === null && product.costPrice !== null) return false
          if (Array.isArray(where?.OR)) {
            const matched = where.OR.some((clause: any) => {
              if (clause.variants?.none) return product.variants.length === 0
              if (clause.variants?.some) {
                return product.variants.some((variant) => variant.costPrice === null)
              }
              return false
            })
            if (!matched) return false
          }
          return true
        }).length
      }),
      findMany: vi.fn(async ({ where }: any) => {
        return fakeProducts
          .filter((product) => {
            if (where?.storeId && product.storeId !== where.storeId) return false
            return true
          })
          .map((product) => ({ ...product }))
      }),
    },
    order: {
      count: vi.fn(async ({ where }: any) => {
        orderQueries.push({ kind: 'count', where })
        return fakeOrders.filter((order) => matchesOrder(order, where)).length
      }),
      findMany: vi.fn(async (args: any) => {
        orderQueries.push({ kind: 'findMany', ...args })
        let rows = fakeOrders.filter((order) => matchesOrder(order, args.where))
        rows = sortOrders(rows, args.orderBy)

        if (args.cursor?.id) {
          const index = rows.findIndex((order) => order.id === args.cursor.id)
          rows = index >= 0 ? rows.slice(index + (args.skip ?? 0)) : []
        } else if (args.skip) {
          rows = rows.slice(args.skip)
        }

        if (typeof args.take === 'number') rows = rows.slice(0, args.take)

        return rows.map((order) => projectOrder(order, args.select))
      }),
      findFirst: vi.fn(async (args: any) => {
        let rows = fakeOrders.filter((order) => matchesOrder(order, args.where))
        rows = sortOrders(rows, args.orderBy)
        const row = rows[0]
        if (!row) return null
        return args.select
          ? {
              id: row.id,
              createdAt: row.createdAt,
              source: row.source,
              channel: row.channel,
              status: row.status,
              paymentStatus: row.paymentStatus,
              total: row.total,
              customerFirstName: row.customerFirstName,
              customerLastName: row.customerLastName,
              customerPhone: row.customerPhone,
              receiptToken: row.receiptToken,
            }
          : row
      }),
      aggregate: vi.fn(async ({ where, _sum }: any) => {
        const rows = fakeOrders.filter((order) => matchesOrder(order, where))
        const total = rows.reduce((sum, order) => sum + order.total, 0)
        return { _sum: { [Object.keys(_sum)[0]]: total } }
      }),
      create: vi.fn(async ({ data }: any) => {
        const order: FakeOrder = {
          id: `order_${fakeOrders.length + 1}`,
          source: data.source ?? 'MANUAL',
          channel: data.channel ?? null,
          status: data.status ?? 'PROCESSING',
          paymentStatus: data.paymentStatus ?? 'PENDING',
          createdAt: data.createdAt ?? new Date(),
          total: data.total ?? 0,
          vendorEarnings: data.vendorEarnings ?? null,
          netAmount: data.netAmount ?? null,
          deliveryCost: data.deliveryCost ?? null,
          customerFirstName: data.customerFirstName ?? null,
          customerLastName: data.customerLastName ?? null,
          customerPhone: data.customerPhone ?? null,
          receiptToken: data.receiptToken ?? null,
          paymentMethod: data.paymentMethod ?? null,
          idempotencyKey: data.idempotencyKey ?? null,
          deletedAt: null,
          items: [],
        }
        fakeOrders.push(order)
        return { ...order }
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const order = fakeOrders.find((candidate) => candidate.id === where?.id)
        if (!order) return null
        Object.assign(order, data)
        return { ...order }
      }),
    },
    orderItem: {
      createMany: vi.fn(async ({ data }: any) => {
        const rows = Array.isArray(data) ? data : [data]

        for (const row of rows) {
          const order = fakeOrders.find((candidate) => candidate.id === row.orderId)
          if (!order) continue

          const product = fakeProducts.find((candidate) => candidate.id === row.productId)
          const variant =
            product?.variants.find((candidate) => candidate.id === row.productVariantId) ?? null

          order.items.push({
            id: `item_${order.items.length + 1}`,
            productId: row.productId,
            productVariantId: row.productVariantId ?? null,
            quantity: row.quantity ?? 0,
            price: row.price ?? 0,
            costPriceSnapshot: row.costPriceSnapshot ?? null,
            vendorEarnings: row.vendorEarnings ?? null,
            product: {
              id: row.productId,
              name: product?.name ?? 'Unknown product',
              costPrice: product?.costPrice ?? null,
            },
            productVariant: variant
              ? {
                  id: variant.id,
                  color: variant.color,
                  size: variant.size,
                  age: variant.age,
                  sku: variant.sku,
                  price: variant.price,
                  costPrice: variant.costPrice,
                }
              : null,
          })
        }

        return { count: rows.length }
      }),
    },
    vendorCustomer: {
      upsert: vi.fn(async () => ({
        id: 'vendor_customer_1',
        storeId: fakeStore.id,
        phone: '+233000000000',
      })),
    },
    refund: {
      findMany: vi.fn(async ({ where }: any) => {
        const orderWhere = where?.order
        return fakeRefunds.filter((refund) => {
          if (!refund.orderId) return false
          const order = fakeOrders.find((candidate) => candidate.id === refund.orderId)
          if (!order) return false
          return matchesOrder(order, orderWhere)
        })
      }),
    },
    orderQueries,
    $transaction: vi.fn(),
  }

  // The transaction of a manual sale runs against the very same rows.
  prisma.$transaction = vi.fn(async (callback: any) =>
    callback({
      $queryRaw: vi.fn().mockResolvedValue([]),
      order: prisma.order,
      orderItem: prisma.orderItem,
      vendorCustomer: prisma.vendorCustomer,
    }),
  )

  return prisma
}

/**
 * The orders the fake holds right now.
 */
export function fakeSalesOrders(): FakeOrder[] {
  return fakeOrders
}

/**
 * The store that owns an order, for the tests that check the scoping.
 */
export { orderStoreId }
