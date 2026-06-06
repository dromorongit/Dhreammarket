import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'

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
         createdAt: order.createdAt.toISOString(),
         updatedAt: order.updatedAt.toISOString(),
         customerName,
         customerEmail: order.user.email,
         customerPhone: order.user.profile?.phone || null,
         customerAddress: order.customerAddress,
         customerCity: order.customerCity,
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