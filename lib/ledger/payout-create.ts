import { Prisma } from '@prisma/client'
import type { LedgerClient } from './corrective-ledger'
import { computeStoreBalance } from './payout-eligibility'
import { getPayoutHoldDays } from './payout-config'

export type CreatePayoutResult =
  | { ok: true; payout: any }
  | { ok: false; reason: 'INVALID_AMOUNT' }
  | { ok: false; reason: 'EXCEEDS_AVAILABLE'; available: Prisma.Decimal }

function toDecimal(value: unknown): Prisma.Decimal | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const d = new Prisma.Decimal(String(value))
  if (!d.isFinite()) return null
  // at most 2 decimals
  if (d.decimalPlaces() > 2) return null
  if (d.lte(0)) return null
  return d
}

export async function createPayoutWithinLedger(
  client: LedgerClient,
  input: {
    vendorId: string
    storeId: string
    amount: number
    reference?: any
    note?: any
    now?: Date
    holdDays?: number
  }
): Promise<CreatePayoutResult> {
  const amountDecimal = toDecimal(input.amount)
  if (!amountDecimal) {
    return { ok: false, reason: 'INVALID_AMOUNT' }
  }

  const holdDays = input.holdDays ?? getPayoutHoldDays()

  return client.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM "stores" WHERE id = ${input.storeId} FOR UPDATE`

    const balance = await computeStoreBalance(tx, {
      storeId: input.storeId,
      now: input.now,
      holdDays,
    })

    if (amountDecimal.greaterThan(balance.available)) {
      return { ok: false, reason: 'EXCEEDS_AVAILABLE', available: balance.available }
    }

    const payout = await tx.vendorPayout.create({
      data: {
        vendorId: input.vendorId,
        storeId: input.storeId,
        amount: Number(amountDecimal.toString()),
        status: 'PENDING',
        reference: input.reference,
        note: input.note,
      },
      include: {
        vendor: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return { ok: true, payout }
  }) as Promise<CreatePayoutResult>
}
