import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  order: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (cb:any) => cb(prismaMock)),
  payment: { deleteMany: vi.fn() },
  orderItem: { deleteMany: vi.fn() },
  productReview: { deleteMany: vi.fn() },
  vendorReview: { deleteMany: vi.fn() },
  $queryRaw: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/prisma', () => ({ getPrisma: vi.fn(() => prismaMock) }))
vi.mock('@/lib/adminAuth', () => ({ requireSuperAdmin: vi.fn() }))
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/order-source', () => ({ isManualOrder: vi.fn() }))
vi.mock('@/lib/stock-reservation', () => ({ restoreManualSaleStock: vi.fn() }))

import { requireSuperAdmin } from '@/lib/adminAuth'
import { isManualOrder } from '@/lib/order-source'
import { restoreManualSaleStock } from '@/lib/stock-reservation'
import { DELETE } from '@/app/api/super-admin/orders/[id]/route'

const mockRequireSuperAdmin = vi.mocked(requireSuperAdmin)
const mockIsManualOrder = vi.mocked(isManualOrder)
const mockRestore = vi.mocked(restoreManualSaleStock)

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireSuperAdmin.mockResolvedValue({ userId: 'sa-1', role: 'SUPER_ADMIN' } as any)
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock))
  prismaMock.payment.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.orderItem.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.productReview.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.vendorReview.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.order.delete.mockResolvedValue({ id: 'order-1' })
})

describe('super-admin manual order delete restores stock', () => {
  it('calls restoreManualSaleStock for an unpaid manual order with consumed stock', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-1',
      paymentStatus: 'PENDING',
      refunds: [],
      items: [],
      inventoryConsumedAt: new Date(),
    })
    mockIsManualOrder.mockReturnValue(true)
    mockRestore.mockResolvedValue({ success: true })

    const request = new NextRequest('http://localhost/api/super-admin/orders/order-1', { method: 'DELETE' })
    const response = await DELETE(request, { params: { id: 'order-1' } } as any)
    expect(response.status).toBe(200)
    expect(mockRestore).toHaveBeenCalledWith(prismaMock, 'order-1')
  })
})