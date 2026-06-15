import { getPrisma } from '@/lib/prisma'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { createNotification } from '@/lib/notifications'
import { createAuditLog } from '@/lib/audit-log'

export interface AllocationResult {
  success: boolean
  allocatedOrders: string[]
  skippedOrders: Array<{ orderId: string; reason: string }>
}

export interface AllocationItem {
  productId: string
  productVariantId?: string
  quantity: number
}

interface AllocatedOrderInfo {
  id: string
  orderType: string
  store: {
    userId: string
  } | null
}

export async function runAllocationEngine(
  items: AllocationItem[],
  createdBy?: string
): Promise<AllocationResult> {
  const prisma = getPrisma()

  if (items.length === 0) {
    return { success: true, allocatedOrders: [], skippedOrders: [] }
  }

  const allocatedOrders: string[] = []
  const skippedOrders: Array<{ orderId: string; reason: string }> = []
  const allocatedOrdersInfo: AllocatedOrderInfo[] = []

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        const { productId, productVariantId, quantity: incomingQuantity } = item

        const waitingOrders = await tx.order.findMany({
          where: {
            paymentStatus: 'PAID',
            orderType: { in: ['PREORDER', 'BACKORDER'] },
            fulfillmentStatus: { in: ['AWAITING_STOCK', 'AWAITING_RESTOCK'] },
            allocatedAt: null,
            items: {
              some: {
                productId,
                ...(productVariantId && { productVariantId }),
              },
            },
          },
          include: {
            items: {
              where: {
                productId,
                ...(productVariantId && { productVariantId }),
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        })

        let remainingStock = incomingQuantity

        for (const order of waitingOrders) {
          if (remainingStock <= 0) break

          const orderItem = order.items[0]
          const requiredQty = orderItem.quantity - (orderItem.allocatedQuantity || 0)

          if (requiredQty <= 0) {
            skippedOrders.push({
              orderId: order.id,
              reason: 'Order already fully allocated',
            })
            continue
          }

          if (requiredQty > remainingStock) {
            skippedOrders.push({
              orderId: order.id,
              reason: `Insufficient stock: required ${requiredQty}, available ${remainingStock}`,
            })
            continue
          }

          await tx.orderItem.update({
            where: { id: orderItem.id },
            data: { allocatedQuantity: { increment: requiredQty } },
          })

          await tx.order.update({
            where: { id: order.id },
            data: {
              fulfillmentStatus: 'READY_TO_FULFILL',
              allocatedAt: new Date(),
            },
          })

          remainingStock -= requiredQty
          allocatedOrders.push(order.id)
        }

        if (incomingQuantity > 0) {
          const allocatedQty = incomingQuantity - remainingStock

          if (productVariantId) {
            await tx.productVariant.update({
              where: { id: productVariantId },
              data: { stock: { decrement: allocatedQty } },
            })
          } else {
            await tx.product.update({
              where: { id: productId },
              data: { stock: { decrement: allocatedQty } },
            })
          }
        }
      }

      if (allocatedOrders.length > 0) {
        const ordersWithVendor = await tx.order.findMany({
          where: { id: { in: allocatedOrders } },
          select: {
            id: true,
            orderType: true,
            items: {
              select: { productId: true },
            },
          },
        })

        for (const order of ordersWithVendor) {
          const firstItem = order.items[0]
          if (firstItem?.productId) {
            const product = await tx.product.findUnique({
              where: { id: firstItem.productId },
              select: { storeId: true },
            })
            if (product?.storeId) {
              const store = await tx.store.findUnique({
                where: { id: product.storeId },
                select: { userId: true },
              })
              if (store?.userId) {
                allocatedOrdersInfo.push({ id: order.id, orderType: order.orderType, store: { userId: store.userId } })
              }
            }
          }
        }
      }
    })

    for (const orderInfo of allocatedOrdersInfo) {
      const { id: orderId, orderType, store } = orderInfo

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: { product: true, productVariant: true },
          },
        },
      })

      const item = order?.items[0]
      const productName = item?.product?.name || item?.productVariant?.color || 'Product'

      const eventType = orderType === 'BACKORDER' ? 'RESTOCK_RECEIVED' : 'STOCK_RECEIVED'
      recordFulfillmentEvent(orderId, eventType, createdBy, {
        productName,
        description: 'Stock received for pre-ordered/backordered item.',
      }).catch(err => console.error('Failed to record stock received event:', err))

recordFulfillmentEvent(orderId, 'INVENTORY_ALLOCATED', createdBy, {
         productName,
         description: 'Inventory allocated via stock arrival',
       }).catch(err => console.error('Failed to record allocation event:', err))

       createAuditLog({
         userId: createdBy || orderId,
         userRole: 'SYSTEM',
         action: 'INVENTORY_ALLOCATED',
         entityType: 'ORDER',
         entityId: orderId,
         beforeData: { fulfillmentStatus: 'AWAITING_STOCK' },
         afterData: { fulfillmentStatus: 'READY_TO_FULFILL' },
       }).catch(err => console.error('Failed to create audit log:', err))

       recordFulfillmentEvent(orderId, 'READY_TO_FULFILL', createdBy, {
        productName,
        description: 'Order is ready to be fulfilled.',
      }).catch(err => console.error('Failed to record ready_to_fulfill event:', err))

      if (store?.userId) {
        createNotification(
          store.userId,
          'ORDER_STATUS_UPDATED',
          'Order Ready to Fulfill',
          `Order #${orderId.slice(-8).toUpperCase()} is now ready to fulfill. ${productName}`
        ).catch(err => console.error('Failed to notify vendor:', err))
      }
    }

    return { success: true, allocatedOrders, skippedOrders }
  } catch (error) {
    console.error('Allocation engine error:', error)
    return {
      success: false,
      allocatedOrders: [],
      skippedOrders: items.map(i => ({ orderId: i.productId, reason: error instanceof Error ? error.message : 'Allocation failed' })),
    }
  }
}

export async function allocateForProductStock(
  productId: string,
  previousStock: number,
  newStock: number,
  createdBy?: string
): Promise<AllocationResult> {
  const addedQuantity = Math.max(0, newStock - previousStock)

  if (addedQuantity <= 0) {
    return { success: true, allocatedOrders: [], skippedOrders: [] }
  }

  return runAllocationEngine([{ productId, quantity: addedQuantity }], createdBy)
}

export async function allocateForVariantStock(
  variantId: string,
  previousStock: number,
  newStock: number,
  createdBy?: string
): Promise<AllocationResult> {
  const addedQuantity = Math.max(0, newStock - previousStock)

  if (addedQuantity <= 0) {
    return { success: true, allocatedOrders: [], skippedOrders: [] }
  }

  const variant = await getPrisma().productVariant.findUnique({
    where: { id: variantId },
    select: { productId: true },
  })

  if (!variant) {
    return { success: false, allocatedOrders: [], skippedOrders: [{ orderId: variantId, reason: 'Variant not found' }] }
  }

  return runAllocationEngine([{ productId: variant.productId, productVariantId: variantId, quantity: addedQuantity }], createdBy)
}