import { getPrisma } from '@/lib/prisma'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'

export interface ReservationItem {
  productId: string
  productVariantId?: string
  quantity: number
  availabilityType: 'IN_STOCK' | 'PREORDER' | 'BACKORDER'
}

export interface ReservationResult {
  success: boolean
  error?: string
  reservedItems?: Array<{ productId: string; productVariantId?: string; reserved: number }>
}

export interface ReleaseResult {
  success: boolean
  error?: string
  releasedItems?: Array<{ productId: string; productVariantId?: string; released: number }>
}

export async function reserveStock(
  orderId: string,
  items: ReservationItem[],
  createdBy?: string
): Promise<ReservationResult> {
  const prisma = getPrisma()

  try {
    const reservedItems: Array<{ productId: string; productVariantId?: string; reserved: number }> = []
    const beforeStockData: Array<{ productId: string; stock: number; reservedQuantity: number }> = []

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.availabilityType !== 'IN_STOCK') {
          continue
        }

        const product = await tx.product.findUnique({
          where: { id: item.productId },
        })

        if (!product) {
          throw new Error(`Product ${item.productId} not found`)
        }

        beforeStockData.push({ productId: item.productId, stock: product.stock, reservedQuantity: product.reservedQuantity })

        const availableStock = product.stock - product.reservedQuantity

        if (availableStock < item.quantity) {
          throw new Error(
            `Insufficient available stock for product ${item.productId}. ` +
            `Available: ${availableStock}, Requested: ${item.quantity}`
          )
        }

        const hasVariant = !!item.productVariantId
        let shouldReserveProduct = true

        if (hasVariant) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.productVariantId },
          })

          if (variant) {
            const availableVariantStock = variant.stock - variant.reservedQuantity
            if (availableVariantStock < item.quantity) {
              throw new Error(
                `Insufficient variant stock for ${item.productVariantId}. ` +
                `Available: ${availableVariantStock}, Requested: ${item.quantity}`
              )
            }

            await tx.productVariant.update({
              where: { id: item.productVariantId },
              data: { reservedQuantity: { increment: item.quantity } },
            })
          }
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { reservedQuantity: { increment: item.quantity } },
        })

        reservedItems.push({
          productId: item.productId,
          productVariantId: item.productVariantId,
          reserved: item.quantity,
        })
      }
    })

    for (let i = 0; i < reservedItems.length; i++) {
      const reservedItem = reservedItems[i]
      const beforeData = beforeStockData[i]

      recordFulfillmentEvent(orderId, 'STOCK_RESERVED', createdBy, {
        productName: reservedItem.productId,
        description: `Reserved ${reservedItem.reserved} units of stock.`,
      }).catch(err => {
        console.error('Failed to record reservation event:', err)
      })

      createAuditLog({
        userId: createdBy || orderId,
        userRole: 'SYSTEM',
        action: 'STOCK_RESERVED',
        entityType: 'PRODUCT',
        entityId: reservedItem.productId,
        beforeData: { stock: beforeData.stock, reservedQuantity: beforeData.reservedQuantity },
        afterData: { stock: beforeData.stock, reservedQuantity: beforeData.reservedQuantity + reservedItem.reserved },
      }).catch(err => console.error('Failed to create audit log:', err))
    }

    return { success: true, reservedItems }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reserve stock',
    }
  }
}

export async function releaseStock(
  orderId: string,
  createdBy?: string
): Promise<ReleaseResult> {
  const prisma = getPrisma()

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
      },
    })

    if (!order) {
      return { success: false, error: 'Order not found' }
    }

    const releasedItems: Array<{ productId: string; productVariantId?: string; released: number; beforeData?: { stock: number; reservedQuantity: number } }> = []

    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        const availabilityType = item.availabilityType || 'IN_STOCK'
        if (availabilityType !== 'IN_STOCK') {
          continue
        }

        const product = await tx.product.findUnique({
          where: { id: item.productId },
        })

        if (product && product.reservedQuantity > 0) {
          const releaseQuantity = Math.min(product.reservedQuantity, item.quantity)

          if (releaseQuantity > 0) {
            const beforeReserved = product.reservedQuantity
            const newReserved = product.reservedQuantity - releaseQuantity
            await tx.product.update({
              where: { id: item.productId },
              data: { reservedQuantity: Math.max(0, newReserved) },
            })

            releasedItems.push({
              productId: item.productId,
              productVariantId: item.productVariantId || undefined,
              released: releaseQuantity,
              beforeData: { stock: product.stock, reservedQuantity: beforeReserved },
            })
          }
        }

        if (item.productVariantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.productVariantId },
          })

          if (variant && variant.reservedQuantity > 0) {
            const releaseQuantity = Math.min(variant.reservedQuantity, item.quantity)

            if (releaseQuantity > 0) {
              const existingIndex = releasedItems.findIndex(
                (i) => i.productId === item.productId && i.productVariantId === item.productVariantId
              )
              if (existingIndex >= 0) {
                releasedItems[existingIndex].released += releaseQuantity
              } else {
                releasedItems.push({
                  productId: item.productId,
                  productVariantId: item.productVariantId,
                  released: releaseQuantity,
                })
              }
            }
          }
        }
      }
    })

    for (const releasedItem of releasedItems) {
      recordFulfillmentEvent(orderId, 'STOCK_RELEASED', createdBy, {
        productName: releasedItem.productId,
        description: `Released ${releasedItem.released} units of reserved stock.`,
      }).catch(err => {
        console.error('Failed to record release event:', err)
      })

      if (releasedItem.beforeData) {
        createAuditLog({
          userId: createdBy || orderId,
          userRole: 'SYSTEM',
          action: 'STOCK_RELEASED',
          entityType: 'PRODUCT',
          entityId: releasedItem.productId,
          beforeData: { stock: releasedItem.beforeData.stock, reservedQuantity: releasedItem.beforeData.reservedQuantity },
          afterData: { stock: releasedItem.beforeData.stock, reservedQuantity: releasedItem.beforeData.reservedQuantity - releasedItem.released },
        }).catch(err => console.error('Failed to create audit log:', err))
      }
    }

    return { success: true, releasedItems }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to release stock',
    }
  }
}

export async function getAvailableQuantity(
  productId: string,
  variantId?: string
): Promise<number> {
  const prisma = getPrisma()

  const product = await prisma.product.findUnique({
    where: { id: productId },
  })

  if (!product) {
    return 0
  }

  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
    })

    if (!variant) {
      return product.stock - product.reservedQuantity
    }

    return variant.stock - variant.reservedQuantity
  }

  return product.stock - product.reservedQuantity
}

export async function validateStockAvailability(
  items: Array<{
    productId: string
    productVariantId?: string
    quantity: number
    availabilityType: 'IN_STOCK' | 'PREORDER' | 'BACKORDER'
  }>
): Promise<{ valid: boolean; error?: string }> {
  const prisma = getPrisma()

  for (const item of items) {
    if (item.availabilityType !== 'IN_STOCK') {
      continue
    }

    const available = await getAvailableQuantity(item.productId, item.productVariantId)

    if (available < item.quantity) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        select: { name: true },
      })

      return {
        valid: false,
        error: `Insufficient available stock for ${product?.name || 'product'}. Available: ${available}`,
      }
    }
  }

  return { valid: true }
}

export async function getVendorStockMetrics(
  vendorId: string
): Promise<{
  totalPhysicalStock: number
  totalReservedStock: number
  totalAvailableStock: number
}> {
  const prisma = getPrisma()

  const store = await prisma.store.findUnique({
    where: { userId: vendorId },
    include: {
      products: true,
    },
  })

  if (!store) {
    return { totalPhysicalStock: 0, totalReservedStock: 0, totalAvailableStock: 0 }
  }

  let totalPhysicalStock = 0
  let totalReservedStock = 0

  for (const product of store.products) {
    totalPhysicalStock += product.stock
    totalReservedStock += product.reservedQuantity
  }

  const totalAvailableStock = totalPhysicalStock - totalReservedStock

  return { totalPhysicalStock, totalReservedStock, totalAvailableStock }
}

export async function getProductReservationMetrics(
  productId: string
): Promise<{
  currentStock: number
  reservedQuantity: number
  availableQuantity: number
}> {
  const prisma = getPrisma()

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true, reservedQuantity: true },
  })

  if (!product) {
    return { currentStock: 0, reservedQuantity: 0, availableQuantity: 0 }
  }

  return {
    currentStock: product.stock,
    reservedQuantity: product.reservedQuantity,
    availableQuantity: product.stock - product.reservedQuantity,
  }
}

export async function consumeInventory(
  orderId: string,
  createdBy?: string
): Promise<{ success: boolean; error?: string; consumedItems?: Array<{ productId: string; variantId?: string; quantity: number; timestamp: Date }> }> {
  const prisma = getPrisma()

  try {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
              productVariant: true,
            },
          },
        },
      })

      if (!order) {
        return { success: false, error: 'Order not found' }
      }

      if (order.orderType !== 'NORMAL') {
        return { success: true, consumedItems: [] }
      }

      if (order.inventoryConsumedAt) {
        return { success: true, consumedItems: [] }
      }

      const consumedItems: Array<{ productId: string; variantId?: string; quantity: number; timestamp: Date }> = []
      const beforeStockData: Array<{ productId: string; stock: number; reservedQuantity: number }> = []
      const timestamp = new Date()

      for (const item of order.items) {
        const availabilityType = item.availabilityType || 'IN_STOCK'
        if (availabilityType !== 'IN_STOCK') {
          continue
        }

        const product = await tx.product.findUnique({
          where: { id: item.productId },
        })

        if (!product) {
          throw new Error(`Product ${item.productId} not found for inventory consumption`)
        }

        beforeStockData.push({ productId: item.productId, stock: product.stock, reservedQuantity: product.reservedQuantity })

        if (product.reservedQuantity < item.quantity) {
          throw new Error(
            `Insufficient reserved stock for product ${item.productId}. ` +
            `Reserved: ${product.reservedQuantity}, Required: ${item.quantity}`
          )
        }

        const newStock = product.stock - item.quantity
        const newReserved = product.reservedQuantity - item.quantity

        if (newStock < 0) {
          throw new Error(
            `Insufficient stock for product ${item.productId}. ` +
            `Current stock: ${product.stock}, Required: ${item.quantity}`
          )
        }

        if (newReserved < 0) {
          throw new Error(
            `Insufficient reserved quantity for product ${item.productId}. ` +
            `Current reserved: ${product.reservedQuantity}, Required: ${item.quantity}`
          )
        }

        if (item.productVariantId) {
          const variant = await tx.productVariant.findUnique({
            where: { id: item.productVariantId },
          })

          if (variant) {
            const newVariantStock = variant.stock - item.quantity
            const newVariantReserved = variant.reservedQuantity - item.quantity

            if (newVariantStock < 0 || newVariantReserved < 0) {
              throw new Error(
                `Insufficient variant stock/reserved for variant ${item.productVariantId}`
              )
            }

            await tx.productVariant.update({
              where: { id: item.productVariantId },
              data: {
                stock: newVariantStock,
                reservedQuantity: newVariantReserved,
              },
            })
          }
        }

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: newStock,
            reservedQuantity: newReserved,
          },
        })

        consumedItems.push({
          productId: item.productId,
          variantId: item.productVariantId || undefined,
          quantity: item.quantity,
          timestamp,
        })
      }

      await tx.order.update({
        where: { id: orderId },
        data: { inventoryConsumedAt: timestamp },
      })

      for (let i = 0; i < consumedItems.length; i++) {
        const consumedItem = consumedItems[i]
        const beforeData = beforeStockData[i]

        createAuditLog({
          userId: createdBy || orderId,
          userRole: 'SYSTEM',
          action: 'INVENTORY_CONSUMED',
          entityType: 'PRODUCT',
          entityId: consumedItem.productId,
          beforeData: { stock: beforeData.stock, reservedQuantity: beforeData.reservedQuantity },
          afterData: { stock: beforeData.stock - consumedItem.quantity, reservedQuantity: beforeData.reservedQuantity - consumedItem.quantity },
        }).catch(err => console.error('Failed to create audit log:', err))
      }

      return { success: true, consumedItems }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to consume inventory',
    }
  }
}