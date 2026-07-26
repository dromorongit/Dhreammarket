import { getPrisma } from '@/lib/prisma'
import { runAllocationEngine, AllocationItem } from '@/lib/stock-allocation-engine'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { createNotification } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit-log'

export async function createRestockOrder(
  productId: string,
  vendorId: string,
  quantityOrdered: number,
  expectedArrivalDate?: Date,
  notes?: string
): Promise<{ success: boolean; restockOrder?: any; error?: string }> {
  const prisma = getPrisma()

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { storeId: true, name: true },
    })

    if (!product) {
      return { success: false, error: 'Product not found' }
    }

    const store = await prisma.store.findUnique({
      where: { userId: vendorId },
      select: { id: true },
    })

    if (!store || store.id !== product.storeId) {
      return { success: false, error: 'Unauthorized: Product does not belong to vendor' }
    }

const restockOrder = await prisma.restockOrder.create({
       data: {
         productId,
         vendorId,
         quantityOrdered,
         status: 'ORDERED',
         expectedArrivalDate,
         notes,
       },
       include: {
         product: {
           select: { name: true, stock: true },
         },
       },
     })

     await recordFulfillmentEvent(
       restockOrder.id,
       'PROCUREMENT_ORDER_CREATED',
       vendorId,
       {
         productName: product.name,
         vendorId,
         description: `Procurement order created for ${quantityOrdered} units. Expected arrival: ${expectedArrivalDate?.toLocaleDateString() || 'Not specified'}`,
       }
     ).catch(err => console.error('Failed to record procurement order event:', err))

     createAuditLog({
       userId: vendorId,
       userRole: 'VENDOR',
       action: 'RESTOCK_ORDER_CREATED',
       entityType: 'RESTOCK_ORDER',
       entityId: restockOrder.id,
       beforeData: null,
       afterData: {
         productId,
         vendorId,
         quantityOrdered,
         status: 'ORDERED',
         expectedArrivalDate,
         notes,
       },
     }).catch(err => console.error('Failed to create audit log:', err))

     await createNotification(
       vendorId,
       'RESTOCK_ORDER_CREATED',
       'Restock Order Created',
       `Restock order for ${quantityOrdered} units of ${product.name} has been created.`
     ).catch(err => console.error('Failed to notify vendor:', err))

    return { success: true, restockOrder }
  } catch (error) {
    console.error('Error creating restock order:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create restock order' }
  }
}

export async function updateRestockOrderStatus(
  restockOrderId: string,
  vendorId: string,
  newStatus: string,
  actualArrivalDate?: Date
): Promise<{ success: boolean; restockOrder?: any; error?: string }> {
  const prisma = getPrisma()

  const validTransitions: Record<string, string[]> = {
    ORDERED: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['ARRIVED', 'CANCELLED'],
    ARRIVED: ['RECEIVED', 'CANCELLED'],
    RECEIVED: [],
    CANCELLED: [],
  }

  try {
    const restockOrder = await prisma.restockOrder.findUnique({
      where: { id: restockOrderId },
      include: {
        product: {
          select: { name: true, stock: true, reservedQuantity: true },
        },
      },
    })

    if (!restockOrder) {
      return { success: false, error: 'Restock order not found' }
    }

    if (restockOrder.vendorId !== vendorId) {
      return { success: false, error: 'Unauthorized: Not your restock order' }
    }

const currentStatus = restockOrder.status as string
    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      return { success: false, error: `Invalid status transition from ${currentStatus} to ${newStatus}` }
    }

    const previousStatus = restockOrder.status
    const updatedOrder = await prisma.restockOrder.update({
       where: { id: restockOrderId },
       data: {
         status: newStatus as any,
         actualArrivalDate: newStatus === 'RECEIVED' ? (actualArrivalDate || new Date()) : restockOrder.actualArrivalDate,
       },
       include: {
         product: {
           select: { name: true, stock: true },
         },
       },
     })

    createAuditLog({
      userId: vendorId,
      userRole: 'VENDOR',
      action: 'RESTOCK_ORDER_UPDATED',
      entityType: 'RESTOCK_ORDER',
      entityId: restockOrderId,
      beforeData: { status: previousStatus },
      afterData: { status: newStatus },
    }).catch(err => console.error('Failed to create audit log:', err))

    if (newStatus === 'RECEIVED') {
      const previousStock = restockOrder.product.stock
      const quantityToReceive = restockOrder.quantityReceived || restockOrder.quantityOrdered

      const allocationResult = await runAllocationEngine(
        [{ productId: restockOrder.productId, quantity: quantityToReceive }],
        vendorId
      )

      await prisma.product.update({
        where: { id: restockOrder.productId },
        data: {
          stock: { increment: quantityToReceive },
        },
      })

      await createNotification(
        vendorId,
        'RESTOCK_INVENTORY_RECEIVED',
        'Inventory Received',
        `${quantityToReceive} units of ${restockOrder.product.name} have been added to stock.`
      ).catch(err => console.error('Failed to notify vendor:', err))

      if (allocationResult.allocatedOrders.length > 0) {
        await createNotification(
          vendorId,
          'ORDER_STATUS_UPDATED',
          'Inventory Allocated',
          `Stock allocation completed for ${allocationResult.allocatedOrders.length} waiting order(s).`
        ).catch(err => console.error('Failed to notify vendor:', err))
      }
    }

    if (newStatus === 'CANCELLED') {
      await createNotification(
        vendorId,
        'RESTOCK_ORDER_CREATED',
        'Restock Order Cancelled',
        `Restock order for ${restockOrder.product.name} has been cancelled.`
      ).catch(err => console.error('Failed to notify vendor:', err))
    }

    return { success: true, restockOrder: updatedOrder }
  } catch (error) {
    console.error('Error updating restock order status:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update restock order status' }
  }
}

export async function getVendorRestockOrders(
  vendorId: string,
  includeCancelled = false
): Promise<Array<{
  id: string
  productId: string
  productName: string
  quantityOrdered: number
  quantityReceived: number
  status: string
  expectedArrivalDate: Date | null
  actualArrivalDate: Date | null
  daysUntilArrival: number | null
  isOverdue: boolean
  createdAt: Date
}>> {
  const prisma = getPrisma()

  const where: any = {
    vendorId,
  }

  if (!includeCancelled) {
    where.status = { not: 'CANCELLED' }
  }

  const restockOrders = await prisma.restockOrder.findMany({
    where,
    include: {
      product: {
        select: { name: true, stock: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return restockOrders.map(order => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const expected = order.expectedArrivalDate ? new Date(order.expectedArrivalDate) : null
    const isOverdue = expected ? expected < today && order.status !== 'RECEIVED' && order.status !== 'CANCELLED' : false
    const daysUntilArrival = expected
      ? Math.ceil((expected.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null

    return {
      id: order.id,
      productId: order.productId,
      productName: order.product.name,
      quantityOrdered: order.quantityOrdered,
      quantityReceived: order.quantityReceived || 0,
      status: order.status,
      expectedArrivalDate: order.expectedArrivalDate,
      actualArrivalDate: order.actualArrivalDate,
      daysUntilArrival,
      isOverdue,
      createdAt: order.createdAt,
    }
  })
}

export async function checkOverdueRestockOrders(vendorId: string): Promise<void> {
  const prisma = getPrisma()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdueOrders = await prisma.restockOrder.findMany({
    where: {
      vendorId,
      status: { in: ['ORDERED', 'SHIPPED', 'ARRIVED'] },
      expectedArrivalDate: { lt: today },
    },
    include: {
      product: { select: { name: true } },
    },
  })

  for (const order of overdueOrders) {
    await createNotification(
      vendorId,
      'RESTOCK_ORDER_OVERDUE',
      'Overdue Restock Order',
      `Restock order #${order.id.slice(-8)} for ${order.product.name} is overdue. Expected arrival was ${order.expectedArrivalDate?.toLocaleDateString()}.`
    ).catch(err => console.error('Failed to send overdue notification:', err))
  }
}

export async function getAdminRestockAnalytics(): Promise<{
  totalRestockOrders: number
  recentRestockOrders: Array<{
    id: string
    productName: string
    vendorName: string
    quantityOrdered: number
    status: string
    createdAt: Date
  }>
  mostRestockedProducts: Array<{ productId: string; productName: string; totalQuantity: number }>
  vendorsWithFrequentStockouts: Array<{ vendorId: string; vendorName: string; stockoutCount: number }>
  averageLeadTime: number | null
}> {
  const prisma = getPrisma()

  const [total, recent, completedOrders, productData, vendorData] = await Promise.all([
    prisma.restockOrder.count({
      where: { status: { in: ['ORDERED', 'SHIPPED', 'ARRIVED', 'RECEIVED'] } },
    }),
    prisma.restockOrder.findMany({
      where: { status: { in: ['ORDERED', 'SHIPPED', 'ARRIVED', 'RECEIVED'] } },
      take: 10,
      include: {
        product: { select: { name: true } },
        vendor: { select: { store: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.restockOrder.findMany({
      where: {
        status: 'RECEIVED',
        actualArrivalDate: { not: null },
        expectedArrivalDate: { not: null },
      },
      select: {
        expectedArrivalDate: true,
        actualArrivalDate: true,
        quantityReceived: true,
      },
    }),
    prisma.restockOrder.groupBy({
      by: ['productId'],
      where: { status: 'RECEIVED' },
      _sum: { quantityReceived: true },
      orderBy: { _sum: { quantityReceived: 'desc' } },
      take: 10,
    }),
    prisma.restockOrder.groupBy({
      by: ['vendorId'],
      _count: { _all: true as any },
      orderBy: { _count: { _all: 'desc' } as any },
      take: 10,
    }),
  ])

  const products = await prisma.product.findMany({
    where: { id: { in: productData.map(p => p.productId) } },
    select: { id: true, name: true },
  })

  const productMap = new Map(products.map(p => [p.id, p.name]))

  const vendors = await prisma.store.findMany({
    where: { userId: { in: Array.from(vendorData.map(v => v.vendorId)) } },
    select: { userId: true, name: true },
  })

  const vendorMap = new Map(vendors.map(v => [v.userId, v.name]))

  const leadTimes = completedOrders
    .filter(o => o.expectedArrivalDate && o.actualArrivalDate)
    .map(o => {
      const expected = new Date(o.expectedArrivalDate!).getTime()
      const actual = new Date(o.actualArrivalDate!).getTime()
      return Math.abs((actual - expected) / (1000 * 60 * 60 * 24))
    })

  const averageLeadTime = leadTimes.length > 0
    ? Math.round(leadTimes.reduce((sum, lt) => sum + lt, 0) / leadTimes.length)
    : null

  return {
    totalRestockOrders: total,
    recentRestockOrders: recent.map(o => ({
      id: o.id,
      productName: o.product.name,
      vendorName: o.vendor.store?.name || 'Unknown Vendor',
      quantityOrdered: o.quantityOrdered,
      status: o.status,
      createdAt: o.createdAt,
    })),
    mostRestockedProducts: productData.map(p => ({
      productId: p.productId,
      productName: productMap.get(p.productId) || 'Unknown',
      totalQuantity: p._sum.quantityReceived || 0,
    })),
vendorsWithFrequentStockouts: vendorData.map((v: any) => ({
      vendorId: v.vendorId,
      vendorName: vendorMap.get(v.vendorId) || 'Unknown',
      stockoutCount: v._count._all || 0,
    })),
    averageLeadTime,
  }
}