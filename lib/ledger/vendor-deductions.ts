import { getPrisma } from '@/lib/prisma'
import { computeStoreBalance } from './payout-eligibility'
import { getPayoutLedgerMode } from '../feature-flags'

export type VendorDeduction = {
  id: string
  amount: number
  orderNumber: string | null
  createdAt: Date
  reason: 'Refund'
}

export type VendorDeductionSummary = {
  available: number
  totalDeductions: number
  deductions: VendorDeduction[]
  mode: ReturnType<typeof getPayoutLedgerMode>
}

export async function getVendorDeductionSummary(client: any, storeId: string): Promise<VendorDeductionSummary> {
  const balance = await computeStoreBalance(client, { storeId })
  const eligible = new Set(balance.eligibleItemIds)
  const rows = await client.vendorBalanceAdjustment.findMany({
    where: { storeId, appliedPayoutId: null },
    include: { orderItem: { include: { order: { select: { orderNumber: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
  const deductions: VendorDeduction[] = rows
    .filter((r: any) => eligible.has(r.orderItemId))
    .map((r: any) => ({
      id: r.id,
      amount: -Number(r.amount.toString()),
      orderNumber: r.orderItem?.order?.orderNumber ?? null,
      createdAt: r.createdAt,
      reason: 'Refund' as const,
    }))
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0)
  return {
    available: Number(balance.available.toString()),
    totalDeductions,
    deductions,
    mode: getPayoutLedgerMode(),
  }
}
