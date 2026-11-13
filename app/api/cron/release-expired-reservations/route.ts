import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getPrisma } from '@/lib/prisma'
import { releaseStock } from '@/lib/stock-reservation'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Reservations older than this many minutes are eligible for release.
export const RESERVATION_TTL_MINUTES = 30

function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[Release Expired Reservations] CRON_SECRET is not set')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!safeEqual(token, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - RESERVATION_TTL_MINUTES * 60 * 1000)

  const expiredOrders = await getPrisma().order.findMany({
    where: {
      source: 'ONLINE',
      status: 'PENDING',
      paymentStatus: 'PENDING',
      stockReservedAt: { not: null, lt: cutoff },
      inventoryConsumedAt: null,
    },
    select: { id: true },
    take: 100,
  })

  let released = 0
  const skipped: string[] = []
  const failed: string[] = []

  for (const order of expiredOrders) {
    try {
      // Atomic claim: only cancel if still PENDING/PENDING (prevents double
      // handling by concurrent runs or a late payment). Mark the order as a
      // cron-expired reservation so handleLatePayment can distinguish it from
      // a manual cancellation when a late payment arrives.
      const claimResult = await getPrisma().order.updateMany({
        where: {
          id: order.id,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
        data: {
          status: 'CANCELLED',
          reservationExpiredAt: new Date(),
        },
      })

      if (claimResult.count === 0) {
        skipped.push(order.id)
        continue
      }

      // Release the reserved stock (idempotent via stockReservedAt flag).
      await releaseStock(order.id)

      // Mark the payment record FAILED, mirroring checkout's Paystack-init
      // failure handling (app/api/checkout/route.ts payment update).
      const orderWithPayment = await getPrisma().order.findUnique({
        where: { id: order.id },
        select: { payment: { select: { id: true, status: true } } },
      })
      const paymentId = orderWithPayment?.payment?.id
      if (paymentId && orderWithPayment?.payment?.status !== 'FAILED') {
        await getPrisma().payment.update({
          where: { id: paymentId },
          data: {
            status: 'FAILED',
            message: `Reservation expired after ${RESERVATION_TTL_MINUTES} minutes without payment`,
          },
        })
      }

      // Update order paymentStatus to match.
      await getPrisma().order.update({
        where: { id: order.id },
        data: { paymentStatus: 'FAILED' },
      })

      released++
    } catch (err) {
      console.error(`[Release Expired Reservations] Failed for order ${order.id}:`, err)
      failed.push(order.id)
    }
  }

  return NextResponse.json({ released, skipped: skipped.length, failed: failed.length, failedOrderIds: failed })
}
