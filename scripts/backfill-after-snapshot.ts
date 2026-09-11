import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'

async function main() {
  const prisma = getPrisma()

  console.log('=== PHASE 3: AFTER SNAPSHOT VERIFICATION ===')

  const totalPaidOrders = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*)::int as count FROM "orders" WHERE "paymentStatus" = 'PAID'
  `
  console.log(`Total PAID orders: ${totalPaidOrders[0].count}`)

  const allPaidOrders = await prisma.$queryRaw<any[]>`
    SELECT o.id, o.total, o."grossAmount", o."processorFee", o."netAmount", o."platformCommission", o."vendorEarnings", o."commissionRate", o."createdAt", p.reference
    FROM "orders" o
    LEFT JOIN "payments" p ON p."orderId" = o.id
    WHERE o."paymentStatus" = 'PAID'
    ORDER BY o."createdAt" ASC
  `

  console.log('')
  console.log('All PAID orders (post-backfill):')
  for (const order of allPaidOrders) {
    const gross = order.grossAmount ?? 0
    const processor = order.processorFee ?? 0
    const net = order.netAmount ?? 0
    const commission = order.platformCommission ?? 0
    const vendor = order.vendorEarnings ?? 0
    const rate = order.commissionRate ?? 0

    const sum = commission + vendor + processor
    const diff = Math.abs(sum - gross)
    const pctOfGross = gross > 0 ? (commission / gross) * 100 : 0

    const arithmeticOk = diff < 0.01
    const rateOk = Math.abs(rate - 0.01) < 0.0001 && Math.abs(pctOfGross - 1) < 0.01

    console.log(JSON.stringify({
      id: order.id,
      reference: order.reference,
      total: order.total,
      grossAmount: gross,
      processorFee: processor,
      netAmount: net,
      platformCommission: commission,
      vendorEarnings: vendor,
      commissionRate: rate,
      createdAt: order.createdAt,
      arithmeticCheck: {
        sum,
        gross,
        diff,
        ok: arithmeticOk,
      },
      rateCheck: {
        commissionPctOfGross: pctOfGross,
        expectedPct: 1,
        ok: rateOk,
      },
    }))
  }

  console.log('')
  const aggregation = await prisma.$queryRaw<any[]>`
    SELECT
      SUM(COALESCE("grossAmount", "total")) as total_gross,
      SUM("processorFee") as total_processor,
      SUM("netAmount") as total_net,
      SUM("platformCommission") as total_platform,
      SUM("vendorEarnings") as total_vendor
    FROM "orders"
    WHERE "paymentStatus" = 'PAID'
  `
  console.log('Financial Command Center aggregation:')
  console.log(JSON.stringify(aggregation[0], null, 2))

  await prisma.$disconnect()
}

main()
  .catch(e => console.error('ERROR:', e))
  .finally(async () => { await getPrisma().$disconnect() })
