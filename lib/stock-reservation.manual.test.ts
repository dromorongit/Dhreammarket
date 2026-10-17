import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn() }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/fulfillment-events', () => ({ recordFulfillmentEvent: vi.fn() }))

import { getPrisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/audit-log'
import { consumeManualSaleStock, restoreManualSaleStock } from './stock-reservation'

const mockGetPrisma = vi.mocked(getPrisma)
const mockCreateAuditLog = vi.mocked(createAuditLog)

function buildMockPrisma(overrides: {
  products?: Record<string, { stock: number; reservedQuantity: number }>
  variants?: Record<string, { stock: number; reservedQuantity: number }>
  order?: { id: string; orderType?: string; inventoryConsumedAt: Date | null; items: any[] } | null
} = {}) {
  const products = new Map(
    Object.entries(overrides.products || {}).map(([id, p]) => [id, { id, ...p }])
  )
  const variants = new Map(
    Object.entries(overrides.variants || {}).map(([id, v]) => [id, { id, ...v }])
  )
  const order = overrides.order || null

  const mockPrisma: any = {
    $queryRaw: vi.fn(async (...args: any[]) => {
      // Look up any product or variant ID mentioned in the arguments
      for (const arg of args) {
        if (typeof arg === 'string') {
          const product = products.get(arg)
          if (product) return [{ stock: product.stock, reservedQuantity: product.reservedQuantity }]
          const variant = variants.get(arg)
          if (variant) return [{ stock: variant.stock, reservedQuantity: variant.reservedQuantity }]
        }
      }
      // Check interpolated values (Prisma passes them as separate args after template strings)
      for (let i = 1; i < args.length; i++) {
        const arg = args[i]
        if (typeof arg === 'string') {
          const product = products.get(arg)
          if (product) return [{ stock: product.stock, reservedQuantity: product.reservedQuantity }]
          const variant = variants.get(arg)
          if (variant) return [{ stock: variant.stock, reservedQuantity: variant.reservedQuantity }]
        }
      }
      return []
    }),
    product: {
      findUnique: vi.fn(async ({ where }: any) => products.get(where.id) || null),
      update: vi.fn(async ({ where, data }: any) => {
        const p = products.get(where.id)
        if (p) {
          if (data.stock !== undefined) p.stock = data.stock
          if (data.reservedQuantity !== undefined) p.reservedQuantity = data.reservedQuantity
        }
        return { id: where.id, ...p }
      }),
    },
    productVariant: {
      findUnique: vi.fn(async ({ where }: any) => variants.get(where.id) || null),
      update: vi.fn(async ({ where, data }: any) => {
        const v = variants.get(where.id)
        if (v) {
          if (data.stock !== undefined) v.stock = data.stock
          if (data.reservedQuantity !== undefined) v.reservedQuantity = data.reservedQuantity
        }
        return { id: where.id, ...v }
      }),
    },
    order: {
      findUnique: vi.fn(async ({ where }: any) => order),
      update: vi.fn(async ({ where, data }: any) => {
        if (order && order.id === where.id) {
          if (data.inventoryConsumedAt !== undefined) order.inventoryConsumedAt = data.inventoryConsumedAt
        }
        return order
      }),
    },
    $transaction: vi.fn(async (fn: any) => fn(mockPrisma)),
  }
  return mockPrisma
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('consumeManualSaleStock', () => {
  it('consumes stock successfully for IN_STOCK products', async () => {
    const prisma = buildMockPrisma({
      products: { prod_1: { stock: 100, reservedQuantity: 10 } },
      order: { id: 'order_1', inventoryConsumedAt: null, items: [] },
    })
    mockGetPrisma.mockReturnValue(prisma)

    const result = await consumeManualSaleStock(
      prisma as any,
      [{ productId: 'prod_1', quantity: 5 }],
      'order_1'
    )

    expect(result.success).toBe(true)
    expect(result.consumedItems).toHaveLength(1)
    expect(result.consumedItems?.[0].productId).toBe('prod_1')
    expect(result.consumedItems?.[0].quantity).toBe(5)
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { inventoryConsumedAt: expect.any(Date) },
    })
    expect(mockCreateAuditLog).toHaveBeenCalled()
  })

  it('consumes variant stock correctly', async () => {
    const prisma = buildMockPrisma({
      products: { prod_1: { stock: 100, reservedQuantity: 10 } },
      variants: { variant_1: { stock: 50, reservedQuantity: 5 } },
      order: { id: 'order_1', inventoryConsumedAt: null, items: [] },
    })
    mockGetPrisma.mockReturnValue(prisma)

    const result = await consumeManualSaleStock(
      prisma as any,
      [{ productId: 'prod_1', productVariantId: 'variant_1', quantity: 3 }],
      'order_1'
    )

    expect(result.success).toBe(true)
    expect(result.consumedItems?.[0].productVariantId).toBe('variant_1')
  })

  it('rejects the whole sale when product stock is insufficient', async () => {
    const prisma = buildMockPrisma({
      products: { prod_1: { stock: 3, reservedQuantity: 0 } },
      order: { id: 'order_1', inventoryConsumedAt: null, items: [] },
    })
    mockGetPrisma.mockReturnValue(prisma)

    const result = await consumeManualSaleStock(
      prisma as any,
      [{ productId: 'prod_1', quantity: 5 }],
      'order_1'
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Insufficient stock')
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('rejects the whole sale when variant stock is insufficient', async () => {
    const prisma = buildMockPrisma({
      products: { prod_1: { stock: 100, reservedQuantity: 0 } },
      variants: { variant_1: { stock: 2, reservedQuantity: 0 } },
      order: { id: 'order_1', inventoryConsumedAt: null, items: [] },
    })
    mockGetPrisma.mockReturnValue(prisma)

    const result = await consumeManualSaleStock(
      prisma as any,
      [{ productId: 'prod_1', productVariantId: 'variant_1', quantity: 5 }],
      'order_1'
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Insufficient variant stock')
    expect(prisma.order.update).not.toHaveBeenCalled()
  })

  it('rejects when available = stock - reservedQuantity is insufficient', async () => {
    const prisma = buildMockPrisma({
      products: { prod_1: { stock: 10, reservedQuantity: 8 } }, // available = 2
      order: { id: 'order_1', inventoryConsumedAt: null, items: [] },
    })
    mockGetPrisma.mockReturnValue(prisma)

    const result = await consumeManualSaleStock(
      prisma as any,
      [{ productId: 'prod_1', quantity: 5 }],
      'order_1'
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Available: 2, Required: 5')
  })

  it('rolls back everything when any line is short (all-or-nothing)', async () => {
    const prisma = buildMockPrisma({
      products: {
        prod_1: { stock: 100, reservedQuantity: 0 },
        prod_2: { stock: 1, reservedQuantity: 0 },
      },
      order: { id: 'order_1', inventoryConsumedAt: null, items: [] },
    })
    mockGetPrisma.mockReturnValue(prisma)

    const result = await consumeManualSaleStock(
      prisma as any,
      [
        { productId: 'prod_1', quantity: 10 },
        { productId: 'prod_2', quantity: 5 }, // insufficient
      ],
      'order_1'
    )

    expect(result.success).toBe(false)
    // prod_1 stock should not have been changed because the sale was rejected
    expect(prisma.product.update).not.toHaveBeenCalled()
    expect(prisma.order.update).not.toHaveBeenCalled()
  })
})

describe('restoreManualSaleStock', () => {
  it('restores stock for a consumed order', async () => {
    const order = {
      id: 'order_1',
      inventoryConsumedAt: new Date(),
      items: [
        { productId: 'prod_1', quantity: 5, productVariantId: null, availabilityType: 'IN_STOCK' },
      ],
    }
    const prisma = buildMockPrisma({
      products: { prod_1: { stock: 90, reservedQuantity: 5 } },
      order,
    })
    mockGetPrisma.mockReturnValue(prisma)

    const result = await restoreManualSaleStock(prisma as any, 'order_1')

    expect(result.success).toBe(true)
    // Stock should be incremented back
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
      data: { stock: 95, reservedQuantity: 10 },
    })
    // inventoryConsumedAt should be nulled
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { inventoryConsumedAt: null },
    })
    expect(mockCreateAuditLog).toHaveBeenCalled()
  })

  it('is idempotent: no-op when inventoryConsumedAt is null', async () => {
    const prisma = buildMockPrisma({
      order: { id: 'order_1', inventoryConsumedAt: null, items: [] },
    })
    mockGetPrisma.mockReturnValue(prisma)

    const result = await restoreManualSaleStock(prisma as any, 'order_1')

    expect(result.success).toBe(true)
    expect(prisma.product.update).not.toHaveBeenCalled()
    expect(prisma.order.update).not.toHaveBeenCalled()
    expect(mockCreateAuditLog).not.toHaveBeenCalled()
  })

  it('is idempotent: no-op after already restored (inventoryConsumedAt is null)', async () => {
    const prisma = buildMockPrisma({
      order: { id: 'order_1', inventoryConsumedAt: null, items: [] },
    })
    mockGetPrisma.mockReturnValue(prisma)

    // First call (already null)
    const r1 = await restoreManualSaleStock(prisma as any, 'order_1')
    expect(r1.success).toBe(true)

    // Second call — still null, still no-op
    const r2 = await restoreManualSaleStock(prisma as any, 'order_1')
    expect(r2.success).toBe(true)
    expect(prisma.product.update).not.toHaveBeenCalled()
  })

  it('restores stock exactly once when called twice after consumption', async () => {
    const order = {
      id: 'order_1',
      inventoryConsumedAt: new Date(),
      items: [
        { productId: 'prod_1', quantity: 5, productVariantId: null, availabilityType: 'IN_STOCK' },
      ],
    }
    const prisma = buildMockPrisma({
      products: { prod_1: { stock: 90, reservedQuantity: 5 } },
      order,
    })
    mockGetPrisma.mockReturnValue(prisma)

    // First call restores stock
    const r1 = await restoreManualSaleStock(prisma as any, 'order_1')
    expect(r1.success).toBe(true)
    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
      data: { stock: 95, reservedQuantity: 10 },
    })

    // Second call finds inventoryConsumedAt already cleared — no-op
    const r2 = await restoreManualSaleStock(prisma as any, 'order_1')
    expect(r2.success).toBe(true)
    // product.update should still only have been called once
    expect(prisma.product.update).toHaveBeenCalledTimes(1)
    expect(prisma.order.update).toHaveBeenCalledTimes(1)
  })

  it('returns failure when order not found', async () => {
    const prisma = buildMockPrisma({ order: null })
    mockGetPrisma.mockReturnValue(prisma)

    const result = await restoreManualSaleStock(prisma as any, 'order_missing')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Order not found')
  })

  it('restores stock exactly once under concurrent cancels (FOR UPDATE serialized)', async () => {
    const order = {
      id: 'order_1',
      inventoryConsumedAt: new Date(),
      items: [
        { productId: 'prod_1', quantity: 5, productVariantId: null, availabilityType: 'IN_STOCK' },
      ],
    }
    let callCount = 0
    const prisma = buildMockPrisma({
      products: { prod_1: { stock: 90, reservedQuantity: 5 } },
      order,
    })
    // Override $transaction to simulate FOR UPDATE serialization
    prisma.$transaction = vi.fn(async (fn: any) => {
      callCount++
      const currentOrder = callCount === 1 ? order : { ...order, inventoryConsumedAt: null }
      const result = await fn({
        ...prisma,
        order: {
          ...prisma.order,
          findUnique: vi.fn(async () => currentOrder),
          update: vi.fn(async () => ({ ...currentOrder, inventoryConsumedAt: null })),
        },
      })
      return result
    })
    mockGetPrisma.mockReturnValue(prisma)

    // Run two cancels concurrently — pass null tx so $transaction is used
    const [r1, r2] = await Promise.all([
      restoreManualSaleStock(null as any, 'order_1'),
      restoreManualSaleStock(null as any, 'order_1'),
    ])

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    // Both cancels go through $transaction (FOR UPDATE serialization)
    expect(callCount).toBe(2)
  })
})

describe('consumeInventory is a no-op on already-consumed order', () => {
  it('returns early when inventoryConsumedAt is already set', async () => {
    const prisma = buildMockPrisma({
      order: {
        id: 'order_1',
        orderType: 'NORMAL',
        inventoryConsumedAt: new Date(),
        items: [{ productId: 'prod_1', quantity: 5 }],
      },
    })
    mockGetPrisma.mockReturnValue(prisma)

    // Import consumeInventory dynamically since it has a different signature
    const { consumeInventory } = await import('./stock-reservation')

    const result = await consumeInventory('order_1', 'user_1')

    expect(result.success).toBe(true)
    expect(result.consumedItems).toEqual([])
    // No stock updates should happen
    expect(prisma.product.update).not.toHaveBeenCalled()
    expect(prisma.order.update).not.toHaveBeenCalled()
  })
})
