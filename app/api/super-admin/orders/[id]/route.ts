import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'

const prisma = getPrisma()

export const dynamic = 'force-dynamic'

// DELETE - Hard delete order and all related records
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Require SUPER_ADMIN access
    const authCheck = await requireSuperAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const orderId = params.id

    // Use transaction to ensure all deletions happen atomically
    await prisma.$transaction(async (tx) => {
      // 1. Delete OrderItems first (they reference the order)
      await tx.orderItem.deleteMany({
        where: { orderId },
      })

      // 2. Delete Payments related to the order
      await tx.payment.deleteMany({
        where: { orderId },
      })

      // 3. Delete ProductReviews linked to this order
      await tx.productReview.deleteMany({
        where: { orderId },
      })

      // 4. Delete VendorReviews linked to this order
      await tx.vendorReview.deleteMany({
        where: { orderId },
      })

      // 5. Finally delete the Order itself
      await tx.order.delete({
        where: { id: orderId },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Order permanently deleted',
    })
  } catch (error) {
    console.error('Error hard deleting order:', error)
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    )
  }
}