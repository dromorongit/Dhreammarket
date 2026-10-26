import { Prisma } from '@prisma/client'
import type { LedgerClient } from './corrective-ledger'
import { getPayoutHoldDays } from './payout-config'
import { getLegacyEligibleEarnings } from './legacy-eligibility'

export type StoreBalance = {
  credits: Prisma.Decimal
  debits: Prisma.Decimal
  paid: Prisma.Decimal
  available: Prisma.Decimal
  net: Prisma.Decimal
  itemCount: number
  holdDays: number
  asOf: Date
}

export type AvailableResult = {
  available: Prisma.Decimal
  net: Prisma.Decimal
}

export function computeAvailable(
  credits: Prisma.Decimal,
  debits: Prisma.Decimal,
  paid: Prisma.Decimal
): AvailableResult {
  const net = credits.minus(debits).minus(paid)
  const available = net.isNegative() ? new Prisma.Decimal(0) : net
  return { available, net }
}

function toDecimal(value: unknown): Prisma.Decimal {
  if (value === null || value === undefined) return new Prisma.Decimal(0)
  if (value instanceof Prisma.Decimal) return value
  return new Prisma.Decimal(String(value))
}

export async function computeStoreBalance(
  client: LedgerClient,
  input: { storeId: string; now?: Date; holdDays?: number }
): Promise<StoreBalance> {
  const holdDays = input.holdDays ?? getPayoutHoldDays()
  const asOf = input.now ?? new Date()

  const items = await client.orderItem.findMany({
    where: {
      product: { storeId: input.storeId },
      order: {
        paymentStatus: 'PAID',
        status: { in: ['DELIVERED', 'COMPLETED'] },
        source: 'ONLINE',
      },
      deliveredAt: { not: null },
    },
    select: { id: true, vendorEarnings: true, deliveredAt: true },
  })

  const candidateItems = items.filter((item) => {
    const d = item.deliveredAt
    if (!d) return false
    return d.getTime() + holdDays * 24 * 60 * 60 * 1000 <= asOf.getTime()
  })

  // Exclude items that have an open (non-terminal) ReturnRequest: the item's
  // funds are held until the return is resolved. Applied to the same item set
  // used for both credits and debits.
  const openReturnRows =
    items.length > 0 && typeof client?.returnRequest?.findMany === 'function'
      ? await client.returnRequest.findMany({
          where: {
            orderItemId: { in: items.map((i) => i.id) },
            status: { in: ['PENDING', 'ITEM_IN_TRANSIT', 'ITEM_RECEIVED', 'AWAITING_REFUND', 'ESCALATED'] },
          },
          select: { orderItemId: true },
        })
      : []
  const heldItemIds = new Set(openReturnRows.map((r: any) => r.orderItemId))
  const eligibleItems = candidateItems.filter((item) => !heldItemIds.has(item.id))

  const itemIds = eligibleItems.map((i) => i.id)

  const credits = eligibleItems.reduce((sum, item) => {
    const ve = item.vendorEarnings
    const rounded =
      ve === null || ve === undefined
        ? new Prisma.Decimal(0)
        : toDecimal(ve).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    return sum.plus(rounded)
  }, new Prisma.Decimal(0))

  let debits = new Prisma.Decimal(0)
  if (itemIds.length > 0) {
    const adjustments = await client.vendorBalanceAdjustment.findMany({
      where: { orderItemId: { in: itemIds } },
    })
    const adjustmentSum = adjustments.reduce(
      (sum, adj) => sum.plus(toDecimal(adj.amount)),
      new Prisma.Decimal(0)
    )
    // Signed convention: a negative amount is a debit (increases debits),
    // a positive amount is a credit (reduces debits). debits = -(sum amount).
    debits = adjustmentSum.negated()
  }

  // Conservative scoping: reuse the legacy payout scoping (by vendorId) so paid
  // is never smaller than the legacy calculation subtracted. A store resolves
  // to its owning vendor; payouts for that vendor across ALL of its stores (and
  // any legacy payout with a null storeId) are included. This over-subtracts
  // for multi-store vendors but guarantees paid_new >= paid_old.
  const store = await client.store.findUnique({
    where: { id: input.storeId },
    select: { userId: true },
  })
  const vendorId = store?.userId
  const payoutWhere: any = { status: { in: ['PENDING', 'PROCESSING', 'PAID'] } }
  if (vendorId) {
    payoutWhere.OR = [{ storeId: input.storeId }, { vendorId }]
  } else {
    payoutWhere.storeId = input.storeId
  }

  const payouts = await client.vendorPayout.findMany({
    where: payoutWhere,
    select: { amount: true },
  })

  const paid = payouts.reduce(
    (sum, p) => sum.plus(toDecimal(p.amount)),
    new Prisma.Decimal(0)
  )

  const { available, net } = computeAvailable(credits, debits, paid)

  return {
    credits,
    debits,
    paid,
    available,
    net,
    itemCount: eligibleItems.length,
    holdDays,
    asOf,
  }
}

export type StoreComparison = {
  storeId: string
  oldAvailable: number
  newAvailable: number
  delta: number
  credits: number
  debits: number
  paid: number
  itemCount: number
}

export type ComparisonReport = {
  stores: StoreComparison[]
  summary: {
    storesChecked: number
    storesWhereNewLessThanOld: number
    storesWhereNewGreaterThanOld: number
    totalDelta: number
  }
}

export async function buildPayoutEligibilityComparison(
  client: LedgerClient,
  options: { limit?: number } = {}
): Promise<ComparisonReport> {
  const limit = options.limit ?? 50
  const stores: StoreComparison[] = []
  let cursor: string | undefined
  let hasMore = true
  let storesChecked = 0
  let less = 0
  let greater = 0
  let totalDelta = 0

  while (hasMore) {
    const page = await client.store.findMany({
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, userId: true },
    })
    if (page.length === 0) break

    for (const store of page) {
      const count = await client.orderItem.count({
        where: {
          product: { storeId: store.id },
          order: { status: { in: ['DELIVERED', 'COMPLETED'] } },
        },
      })
      if (count === 0) continue

      storesChecked += 1

      const oldAvailable = store.userId
        ? await getLegacyEligibleEarnings(client, store.userId)
        : 0

      const balance = await computeStoreBalance(client, { storeId: store.id })

      const newAvailable = Number(balance.available.toString())
      const delta = newAvailable - oldAvailable

      if (newAvailable < oldAvailable) less += 1
      if (newAvailable > oldAvailable) greater += 1
      totalDelta += delta

      stores.push({
        storeId: store.id,
        oldAvailable,
        newAvailable,
        delta,
        credits: Number(balance.credits.toString()),
        debits: Number(balance.debits.toString()),
        paid: Number(balance.paid.toString()),
        itemCount: balance.itemCount,
      })
    }

    if (page.length < limit) hasMore = false
    cursor = page[page.length - 1].id
  }

  return {
    stores,
    summary: {
      storesChecked,
      storesWhereNewLessThanOld: less,
      storesWhereNewGreaterThanOld: greater,
      totalDelta,
    },
  }
}
