import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { releaseStock, consumeInventory } from '@/lib/stock-reservation'
import { recordFulfillmentEvent } from '@/lib/fulfillment-events'
import { createAuditLog, captureBeforeAfter } from '@/lib/audit-log'

const prisma = getPrisma()

export const dynamic = 'force-dynamic'

// GET single order with complete details
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const orderId = params.id

    const order = await prisma.order.findUnique({
      where: { id: orderId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        items: {
          include: {
            product: {
              include: {
                store: {
                  select: {
                    id: true,
                    name: true,
                    mainPhoneNumber: true,
                  },
                },
                images: {
                  select: {
                    url: true,
                  },
                  take: 1,
                },
              },
            },
            productVariant: true,
          },
        },
        payment: true,
      },
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Extract customer name with fallback hierarchy
    const customerName = [
      order.user.profile?.firstName,
      order.user.profile?.lastName,
    ].filter(Boolean).join(' ') || order.user.email

    // Group items by store for easier display
    const itemsByStore = order.items.reduce((acc, item) => {
      const storeName = item.product?.store?.name || 'Unknown Store'
      if (!acc[storeName]) {
        acc[storeName] = {
          storeName,
          vendorContact: item.product?.store?.mainPhoneNumber || null,
          items: [],
        }
      }
      acc[storeName].items.push({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        color: item.color,
        size: item.size,
        age: item.age,
        productName: item.product?.name || 'Unknown Product',
        productImage: item.product?.images?.[0]?.url || null,
      })
      return acc
    }, {} as Record<string, { storeName: string; vendorContact: string | null; items: any[] }>)

    const storeGroups = Object.values(itemsByStore)

return NextResponse.json({
      order: {
        id: order.id,
        total: order.total,
        status: order.status,
        paymentStatus: order.paymentStatus,
        orderType: order.orderType,
        fulfillmentStatus: order.fulfillmentStatus,
        vendorAccepted: order.vendorAccepted,
        vendorRejected: order.vendorRejected,
        vendorRejectionReason: order.vendorRejectionReason,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        customerName,
        customerEmail: order.user.email,
        customerPhone: order.user.profile?.phone || null,
        customerAddress: order.customerAddress,
        customerCity: order.customerCity,
        customerRegion: order.customerRegion,
        storeGroups,
        payment: order.payment ? {
          id: order.payment.id,
          amount: order.payment.amount,
          status: order.payment.status,
          reference: order.payment.reference,
          paystackRef: order.payment.paystackRef,
          createdAt: order.payment.createdAt.toISOString(),
        } : null,
      },
    })
  } catch (error) {
    console.error('Admin order detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch order details' }, { status: 500 })
  }
}

// PATCH - Update order status (e.g., cancel order)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authCheck = requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const adminUser = authCheck
    const orderId = params.id
    const body = await request.json()
    const { status, paymentStatus, reason } = body

    // Get existing order for before data
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId, deletedAt: null },
      select: { orderType: true, status: true, paymentStatus: true },
    })

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const updateData: any = {}

    if (status && ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      updateData.status = status
      if (status === 'CANCELLED') {
        recordFulfillmentEvent(orderId, 'CANCELLED', undefined, {
          description: reason || 'Order cancelled by administrator',
        }).catch(err => console.error('Failed to record cancellation event:', err))
      }
    }

    if (paymentStatus && ['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(paymentStatus)) {
      updateData.paymentStatus = paymentStatus
      if (paymentStatus === 'REFUNDED') {
        recordFulfillmentEvent(orderId, 'REFUNDED', undefined, {
          description: reason || 'Order refunded',
        }).catch(err => console.error('Failed to record refund event:', err))
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: updateData,
    })

    // Create audit log for order cancellation
    if (status === 'CANCELLED') {
      await createAuditLog({
        userId: adminUser.userId,
        userRole: adminUser.role,
        action: 'ORDER_CANCELLED',
        entityType: 'ORDER',
        entityId: orderId,
        beforeData: { status: existingOrder.status },
        afterData: { status: updatedOrder.status, reason },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
      })
    }

    // Create audit log for order refund
    if (paymentStatus === 'REFUNDED') {
      await createAuditLog({
        userId: adminUser.userId,
        userRole: adminUser.role,
        action: 'ORDER_REFUNDED',
        entityType: 'ORDER',
        entityId: orderId,
        beforeData: { paymentStatus: existingOrder.paymentStatus },
        afterData: { paymentStatus: updatedOrder.paymentStatus, reason },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || null,
      })
    }

    if ((status === 'DELIVERED' || status === 'COMPLETED') && existingOrder.orderType === 'NORMAL') {
      const consumptionResult = await consumeInventory(orderId)
      if (!consumptionResult.success && consumptionResult.error) {
        console.error('Inventory consumption failed:', consumptionResult.error)
      } else if (consumptionResult.consumedItems && consumptionResult.consumedItems.length > 0) {
        for (const item of consumptionResult.consumedItems) {
          recordFulfillmentEvent(orderId, 'INVENTORY_CONSUMED', undefined, {
            productName: item.productId,
            description: `Consumed ${item.quantity} units of inventory.`,
          }).catch(err => console.error('Failed to record inventory consumed event:', err))
        }
      }
    }

    // Release stock for cancelled/refunded NORMAL orders
    if ((status === 'CANCELLED' || paymentStatus === 'REFUNDED') && existingOrder.orderType === 'NORMAL') {
      releaseStock(orderId).catch(err => {
        console.error('Failed to release stock:', err)
      })
    }

    return NextResponse.json({
      success: true,
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        paymentStatus: updatedOrder.paymentStatus,
      },
    })
  } catch (error) {
    console.error('Admin order update error:', error)
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  }
}