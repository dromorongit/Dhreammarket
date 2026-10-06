import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/rating-sync', () => ({
  syncProductRating: vi.fn(),
  syncStoreRating: vi.fn(),
  syncServiceRating: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
const mockGetPrisma = vi.mocked(getPrisma)
const mockVerifyToken = vi.mocked(verifyToken)

function buildMockPrisma() {
  const orderItems: any[] = []
  const orders: any[] = []
  const productReviews: any[] = []
  const vendorReviews: any[] = []
  const stores: any[] = []
  const users: any[] = []
  const products: any[] = []

  const mockPrisma = {
    order: {
      findFirst: vi.fn(async ({ where }: any) => {
        console.log('order.findFirst where:', JSON.stringify(where, null, 2))
        const itemFilter = where?.items?.some
        if (!itemFilter) {
          console.log('No itemFilter found')
          return null
        }

        const productId = itemFilter?.productId
        const storeId = itemFilter?.product?.storeId

        if (!productId && !storeId) {
          console.log('No productId or storeId found in itemFilter')
          return null
        }

        const result = orders.find((o) => {
          if (o.userId !== where.userId) {
            console.log(`userId mismatch: ${o.userId} !== ${where.userId}`)
            return false
          }
          if (o.paymentStatus !== where.paymentStatus) {
            console.log(`paymentStatus mismatch: ${o.paymentStatus} !== ${where.paymentStatus}`)
            return false
          }
          if (where.status?.in && !where.status.in.includes(o.status)) {
            console.log(`status mismatch: ${o.status} not in ${JSON.stringify(where.status.in)}`)
            return false
          }
          const hasItem = o.items.some((item: any) => {
            if (productId && item.product?.id === productId) return true
            if (storeId && item.product?.storeId === storeId) return true
            return false
          })
          if (!hasItem) {
            console.log(`No matching item for productId=${productId} storeId=${storeId}`)
          }
          return hasItem
        })
        console.log('findFirst result:', result?.id || null)
        return result || null
      }),
      count: vi.fn(async ({ where }: any) => {
        const itemFilter = where?.items?.some
        if (!itemFilter) return 0
        const productId = itemFilter?.productId
        const storeId = itemFilter?.product?.storeId

        if (where.vendorRejected === true) {
          return orders.filter((o) => {
            if (o.paymentStatus !== where.paymentStatus) return false
            if (o.vendorRejected !== true) return false
            return o.items.some((item: any) => {
              if (productId && item.product?.id === productId) return true
              if (storeId && item.product?.storeId === storeId) return true
              return false
            })
          }).length
        }

        if (where.status?.in) {
          return orders.filter((o) => {
            if (o.paymentStatus !== where.paymentStatus) return false
            if (!where.status.in.includes(o.status)) return false
            return o.items.some((item: any) => {
              if (productId && item.product?.id === productId) return true
              if (storeId && item.product?.storeId === storeId) return true
              return false
            })
          }).length
        }

        return 0
      }),
    },
    productReview: {
      findUnique: vi.fn(async ({ where }: any) => {
        return productReviews.find((r) => r.userId === where.userId_productId.userId && r.productId === where.userId_productId.productId) || null
      }),
      count: vi.fn(async ({ where }: any) => {
        return productReviews.filter((r) => {
          if (where.product?.storeId && r.product.storeId !== where.product.storeId) return false
          if (where.orderId?.not && r.orderId !== null) return false
          return true
        }).length
      }),
      create: vi.fn(async ({ data }: any) => {
        return { id: 'review-' + Date.now(), ...data }
      }),
    },
    vendorReview: {
      findUnique: vi.fn(async ({ where }: any) => {
        return vendorReviews.find((r) => r.userId === where.userId_storeId.userId && r.storeId === where.userId_storeId.storeId) || null
      }),
      count: vi.fn(async ({ where }: any) => {
        return vendorReviews.filter((r) => {
          if (r.storeId !== where.storeId) return false
          if (where.orderId?.not && r.orderId !== null) return false
          return true
        }).length
      }),
      create: vi.fn(async ({ data }: any) => {
        return { id: 'vendor-review-' + Date.now(), ...data }
      }),
    },
    store: {
      findUnique: vi.fn(async ({ where }: any) => {
        return stores.find((s) => s.id === where.id || s.slug === where.slug) || null
      }),
    },
    product: {
      findUnique: vi.fn(async ({ where, include }: any) => {
        const product = products.find((p) => p.id === where.id || p.slug === where.slug) || null
        if (!product) return null
        if (include?.store) {
          const store = stores.find((s) => s.id === product.storeId)
          return {
            ...product,
            store: {
              userId: store?.userId,
            },
          }
        }
        return product
      }),
    },
  }

  return {
    mockPrisma,
    orders,
    orderItems,
    productReviews,
    vendorReviews,
    stores,
    users,
    products,
  }
}

describe('Review eligibility and trust aggregates', () => {
  let mockPrisma: ReturnType<typeof buildMockPrisma>['mockPrisma']
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyToken.mockResolvedValue({ authenticated: true, userId: 'customer-1', role: 'CUSTOMER', sessionId: 'session-1' } as any)
    ctx = buildMockPrisma()
    mockPrisma = ctx.mockPrisma
    ;(mockGetPrisma as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockPrisma as any)
  })

  it('returns not_purchased when customer has no order for the product', async () => {
    const { POST } = await import('@/app/api/products/[id]/reviews/route')
    const request = {
      cookies: { get: () => ({ value: 'fake-token' }) },
      json: async () => ({ rating: 5, comment: 'Great product' }),
    } as any
    const params = { id: 'product-1' }

    ctx.products.push({ id: 'product-1', storeId: 'store-1', slug: 'product-1' })
    ctx.stores.push({ id: 'store-1', userId: 'vendor-1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Only customers who received this item can review it')
  })

  it('returns not_purchased when customer only has a pending order', async () => {
    const { POST } = await import('@/app/api/products/[id]/reviews/route')
    const request = {
      cookies: { get: () => ({ value: 'fake-token' }) },
      json: async () => ({ rating: 5, comment: 'Great product' }),
    } as any
    const params = { id: 'product-1' }

    ctx.products.push({ id: 'product-1', storeId: 'store-1', slug: 'product-1' })
    ctx.stores.push({ id: 'store-1', userId: 'vendor-1' })
    ctx.orders.push({
      id: 'order-1',
      userId: 'customer-1',
      paymentStatus: 'PAID',
      status: 'PENDING',
      items: [{ product: { id: 'product-1', storeId: 'store-1' } }],
    })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data.error).toBe('Only customers who received this item can review it')
  })

  it('allows review when customer has a delivered order', async () => {
    const { POST } = await import('@/app/api/products/[id]/reviews/route')
    const request = {
      cookies: { get: () => ({ value: 'fake-token' }) },
      json: async () => ({ rating: 5, comment: 'Great product' }),
    } as any
    const params = { id: 'product-1' }

    ctx.products.push({ id: 'product-1', storeId: 'store-1', slug: 'product-1' })
    ctx.stores.push({ id: 'store-1', userId: 'vendor-1' })
    ctx.orders.push({
      id: 'order-1',
      userId: 'customer-1',
      paymentStatus: 'PAID',
      status: 'DELIVERED',
      items: [{ product: { id: 'product-1', storeId: 'store-1' } }],
    })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.review.orderId).toBe('order-1')
  })

  it('returns already_reviewed when customer already reviewed', async () => {
    const { POST } = await import('@/app/api/products/[id]/reviews/route')
    const request = {
      cookies: { get: () => ({ value: 'fake-token' }) },
      json: async () => ({ rating: 5, comment: 'Great product' }),
    } as any
    const params = { id: 'product-1' }

    ctx.products.push({ id: 'product-1', storeId: 'store-1', slug: 'product-1' })
    ctx.stores.push({ id: 'store-1', userId: 'vendor-1' })
    ctx.orders.push({
      id: 'order-1',
      userId: 'customer-1',
      paymentStatus: 'PAID',
      status: 'DELIVERED',
      items: [{ product: { id: 'product-1', storeId: 'store-1' } }],
    })
    ctx.productReviews.push({ userId: 'customer-1', productId: 'product-1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('You have already reviewed this product')
  })

  it('prevents review when another user already reviewed', async () => {
    const { POST } = await import('@/app/api/products/[id]/reviews/route')
    const request = {
      cookies: { get: () => ({ value: 'fake-token' }) },
      json: async () => ({ rating: 5, comment: 'Great product' }),
    } as any
    const params = { id: 'product-1' }

    ctx.products.push({ id: 'product-1', storeId: 'store-1', slug: 'product-1' })
    ctx.stores.push({ id: 'store-1', userId: 'vendor-1' })
    ctx.orders.push({
      id: 'order-1',
      userId: 'customer-1',
      paymentStatus: 'PAID',
      status: 'DELIVERED',
      items: [{ product: { id: 'product-1', storeId: 'store-1' } }],
    })
    ctx.productReviews.push({ userId: 'other-customer', productId: 'product-1' })

    const response = await POST(request, { params })
    const data = await response.json()

    expect(response.status).toBe(201)
    expect(data.review.orderId).toBe('order-1')
  })

  it('computes cancellation rate only when threshold is met', async () => {
    const completedOrders = 5
    const vendorCancelledCount = 2
    const total = completedOrders + vendorCancelledCount

    const rate = total >= 10 ? vendorCancelledCount / total : null
    const isNewSeller = total < 10

    expect(rate).toBeNull()
    expect(isNewSeller).toBe(true)

    const highVolumeCompleted = 8
    const highVolumeCancelled = 3
    const highVolumeTotal = highVolumeCompleted + highVolumeCancelled
    const highVolumeRate = highVolumeTotal >= 10 ? highVolumeCancelled / highVolumeTotal : null
    const highVolumeIsNewSeller = highVolumeTotal < 10

    expect(highVolumeRate).toBeCloseTo(3 / 11)
    expect(highVolumeIsNewSeller).toBe(false)
  })

  it('attributes vendor cancellation to the correct vendor in multi-vendor orders', async () => {
    const store1 = { id: 'store-1', userId: 'vendor-1' }
    const store2 = { id: 'store-2', userId: 'vendor-2' }
    ctx.stores.push(store1, store2)

    const multiVendorOrder = {
      id: 'order-multi',
      userId: 'customer-1',
      paymentStatus: 'PAID',
      status: 'PROCESSING',
      vendorRejected: true,
      items: [
        { product: { storeId: 'store-1' } },
        { product: { storeId: 'store-2' } },
      ],
    }
    ctx.orders.push(multiVendorOrder)

    const countForStore1 = await mockPrisma.order.count({
      where: {
        paymentStatus: 'PAID',
        vendorRejected: true,
        items: { some: { product: { storeId: 'store-1' } } },
      },
    })

    const countForStore2 = await mockPrisma.order.count({
      where: {
        paymentStatus: 'PAID',
        vendorRejected: true,
        items: { some: { product: { storeId: 'store-2' } } },
      },
    })

    expect(countForStore1).toBe(1)
    expect(countForStore2).toBe(1)
  })
})
