import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

const txMock = vi.hoisted(() => ({
  orderItem: {
    count: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(() => txMock as unknown as PrismaClient),
}))

import { stampOrderItems } from '@/lib/order-delivery-stamps'

const STORE_ID = 'store_1'
const ORDER_ID = 'order_1'
const NOW = new Date('2026-01-15T10:00:00.000Z')

describe('stampOrderItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 0 for multi-store orders', async () => {
    txMock.orderItem.count.mockResolvedValue(1) // items with other store

    const count = await stampOrderItems({
      orderId: ORDER_ID,
      storeId: STORE_ID,
      field: 'shippedAt',
      now: NOW,
      tx: txMock as unknown as PrismaClient,
    })

    expect(count).toBe(0)
    expect(txMock.orderItem.findMany).not.toHaveBeenCalled()
  })

  it('returns 0 when no items need stamping (field already set)', async () => {
    txMock.orderItem.count.mockResolvedValue(0) // single-store
    txMock.orderItem.findMany.mockResolvedValue([])

    const count = await stampOrderItems({
      orderId: ORDER_ID,
      storeId: STORE_ID,
      field: 'shippedAt',
      now: NOW,
      tx: txMock as unknown as PrismaClient,
    })

    expect(count).toBe(0)
  })

  it('stamps shippedAt for single-store order items with null shippedAt', async () => {
    txMock.orderItem.count.mockResolvedValue(0) // single-store
    txMock.orderItem.findMany.mockResolvedValue([
      { id: 'item_1' },
      { id: 'item_2' },
    ])
    txMock.orderItem.updateMany.mockResolvedValue({ count: 2 })

    const count = await stampOrderItems({
      orderId: ORDER_ID,
      storeId: STORE_ID,
      field: 'shippedAt',
      now: NOW,
      tx: txMock as unknown as PrismaClient,
    })

    expect(count).toBe(2)
    expect(txMock.orderItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['item_1', 'item_2'] },
        shippedAt: null,
      },
      data: { shippedAt: NOW },
    })
  })

  it('stamps deliveredAt and shippedAt (if null) for deliveredAt', async () => {
    txMock.orderItem.count.mockResolvedValue(0) // single-store
    txMock.orderItem.findMany.mockResolvedValue([{ id: 'item_1' }])
    txMock.orderItem.updateMany.mockResolvedValue({ count: 1 })

    const count = await stampOrderItems({
      orderId: ORDER_ID,
      storeId: STORE_ID,
      field: 'deliveredAt',
      now: NOW,
      tx: txMock as unknown as PrismaClient,
    })

    expect(count).toBe(1)
    expect(txMock.orderItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['item_1'] },
        deliveredAt: null,
      },
      data: { deliveredAt: NOW, shippedAt: NOW },
    })
  })

  it('only updates items belonging to the store', async () => {
    txMock.orderItem.count.mockResolvedValue(0)
    txMock.orderItem.findMany.mockResolvedValue([{ id: 'item_1' }])
    txMock.orderItem.updateMany.mockResolvedValue({ count: 1 })

    await stampOrderItems({
      orderId: ORDER_ID,
      storeId: STORE_ID,
      field: 'shippedAt',
      now: NOW,
      tx: txMock as unknown as PrismaClient,
    })

    expect(txMock.orderItem.findMany).toHaveBeenCalledWith({
      where: {
        orderId: ORDER_ID,
        product: { storeId: STORE_ID },
        shippedAt: null,
      },
      select: { id: true },
    })
  })

  it('is idempotent: second call with same data returns 0', async () => {
    txMock.orderItem.count.mockResolvedValue(0)
    txMock.orderItem.findMany
      .mockResolvedValueOnce([{ id: 'item_1' }])
      .mockResolvedValueOnce([])
    txMock.orderItem.updateMany.mockResolvedValue({ count: 1 })

    const count1 = await stampOrderItems({
      orderId: ORDER_ID,
      storeId: STORE_ID,
      field: 'shippedAt',
      now: NOW,
      tx: txMock as unknown as PrismaClient,
    })
    const count2 = await stampOrderItems({
      orderId: ORDER_ID,
      storeId: STORE_ID,
      field: 'shippedAt',
      now: NOW,
      tx: txMock as unknown as PrismaClient,
    })

    expect(count1).toBe(1)
    expect(count2).toBe(0)
  })

  it('never overwrites existing values', async () => {
    txMock.orderItem.count.mockResolvedValue(0)
    txMock.orderItem.findMany.mockResolvedValue([{ id: 'item_1' }])
    txMock.orderItem.updateMany.mockResolvedValue({ count: 1 })

    await stampOrderItems({
      orderId: ORDER_ID,
      storeId: STORE_ID,
      field: 'shippedAt',
      now: NOW,
      tx: txMock as unknown as PrismaClient,
    })

    // The where clause includes `shippedAt: null` so existing values are not overwritten
    expect(txMock.orderItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shippedAt: null }),
      })
    )
  })
})