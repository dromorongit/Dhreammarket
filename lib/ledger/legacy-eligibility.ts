import { Prisma } from '@prisma/client'
import type { LedgerClient } from './corrective-ledger'

/**
 * Legacy (pre-ledger) eligibility calculation, extracted faithfully from
 * app/api/vendor/payouts/route.ts so compare mode can run it without touching
 * the route's internals.
 *
 * Returns a plain number, exactly as the original helper did.
 */
export async function getLegacyEligibleEarnings(
  client: LedgerClient,
  vendorId: string
): Promise<number> {
  const store = await client.store.findUnique({
    where: { userId: vendorId },
    select: { id: true },
  })

  if (!store) {
    return 0
  }

  const result = await client.orderItem.aggregate({
    where: {
      product: {
        storeId: store.id,
      },
      order: {
        paymentStatus: 'PAID',
        status: {
          in: ['DELIVERED', 'COMPLETED'],
        },
        source: 'ONLINE',
      },
    },
    _sum: {
      vendorEarnings: true,
    },
  })

  const eligibleEarnings = result._sum?.vendorEarnings || 0

  const pendingPayouts = await client.vendorPayout.findMany({
    where: {
      vendorId,
      status: {
        in: ['PENDING', 'PROCESSING', 'PAID'],
      },
    },
    select: {
      amount: true,
    },
  })

  const alreadyPaidOut = pendingPayouts.reduce(
    (sum, payout) => sum + (payout.amount as number),
    0
  )

  return Math.max(eligibleEarnings - alreadyPaidOut, 0)
}
