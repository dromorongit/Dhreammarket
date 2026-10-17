import { describe, it, expect, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  store: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  order: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  orderItem: {
    findMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
    count: vi.fn(),
  },
  payment: {
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
  },
  vendorPayout: {
    groupBy: vi.fn(),
  },
  vendorReview: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  productReview: {
    count: vi.fn(),
  },
  vendorFollow: {
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(() => prismaMock),
}))

const verifyTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth-middleware', () => ({
  verifyToken: verifyTokenMock,
}))

const requireAdminMock = vi.hoisted(() => vi.fn())
const requireSuperAdminMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/adminAuth', () => ({
  requireAdmin: requireAdminMock,
  requireSuperAdmin: requireSuperAdminMock,
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => (req: any) => ({ success: true })),
}))

describe('regression: MANUAL orders excluded from money/trust', () => {
  let mockPrisma: typeof prismaMock

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma = prismaMock
    ;(verifyTokenMock as any).mockResolvedValue({
      authenticated: true,
      userId: 'admin-1',
      role: 'SUPER_ADMIN',
    })
    ;(requireAdminMock as any).mockResolvedValue({
      userId: 'admin-1',
      role: 'SUPER_ADMIN',
    })
    ;(requireSuperAdminMock as any).mockResolvedValue({
      userId: 'admin-1',
      role: 'SUPER_ADMIN',
    })
    mockPrisma.store.findUnique.mockResolvedValue({ id: 'store-1', userId: 'vendor-1', categoryId: 'cat-1' })
    mockPrisma.store.findMany.mockResolvedValue([{ id: 'store-1', userId: 'vendor-1', categoryId: 'cat-1', products: [{ id: 'prod-1' }] }])
    mockPrisma.store.count.mockResolvedValue(0)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'vendor-1', role: 'VENDOR' })
    mockPrisma.payment.findMany.mockResolvedValue([])
    mockPrisma.payment.count.mockResolvedValue(0)
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    mockPrisma.payment.groupBy.mockResolvedValue([])
    mockPrisma.order.findMany.mockResolvedValue([])
    mockPrisma.orderItem.findMany.mockResolvedValue([])
    mockPrisma.orderItem.groupBy.mockResolvedValue([])
    mockPrisma.order.count.mockResolvedValue(0)
    mockPrisma.product.findMany.mockResolvedValue([])
    mockPrisma.vendorPayout.groupBy.mockResolvedValue([])
    mockPrisma.vendorReview.findMany.mockResolvedValue([])
    mockPrisma.vendorReview.count.mockResolvedValue(0)
    mockPrisma.productReview.count.mockResolvedValue(0)
    mockPrisma.vendorFollow.count.mockResolvedValue(0)
  })

  describe('admin payments totalRevenue excludes MANUAL', () => {
    it('adds source ONLINE to payment aggregate', async () => {
      const { GET } = await import('@/app/api/admin/payments/route')
      const request = { url: 'http://localhost/api/admin/payments' } as any
      await GET(request)

      const aggregateCall = mockPrisma.payment.aggregate.mock.calls[0]
      const where = aggregateCall[0].where
      expect(where.order.source).toBe('ONLINE')
      expect(where.status).toBe('PAID')
    })
  })

  describe('admin vendors earnings excludes MANUAL', () => {
    it('adds source ONLINE to orderItem query', async () => {
      const { GET } = await import('@/app/api/admin/vendors/route')
      const request = { url: 'http://localhost/api/admin/vendors' } as any
      await GET(request)

      const findManyCall = mockPrisma.orderItem.findMany.mock.calls[0]
      const where = findManyCall[0].where
      expect(where.order.source).toBe('ONLINE')
      expect(where.order.paymentStatus).toBe('PAID')
    })
  })

  describe('vendors/[id] completedOrderCount excludes MANUAL', () => {
    it('adds source ONLINE to completed order count', async () => {
      const { GET } = await import('@/app/api/vendors/[id]/route')
      const request = { url: 'http://localhost/api/vendors/store-1' } as any
      await GET(request, { params: { id: 'store-1' } })

      const countCall = mockPrisma.order.count.mock.calls[0]
      const where = countCall[0].where
      expect(where.source).toBe('ONLINE')
      expect(where.paymentStatus).toBe('PAID')
    })
  })

  describe('vendorRejectedOrdersWhere excludes MANUAL', () => {
    it('includes source ONLINE in trust where clause', async () => {
      const { vendorRejectedOrdersWhere } = await import('@/lib/trust-metrics')
      const where = vendorRejectedOrdersWhere('store-1')
      expect(where.source).toBe('ONLINE')
    })
  })
})
