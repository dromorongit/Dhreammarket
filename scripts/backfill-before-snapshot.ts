import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'

async function main() {
  const prisma = getPrisma()

  console.log('=== PHASE 1: BEFORE SNAPSHOT (ALL PAID ORDERS) ===')

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
  console.log(`All PAID orders: ${allPaidOrders.length}`)
  console.log('')

  for (const order of allPaidOrders) {
    console.log(JSON.stringify({
      id: order.id,
      reference: order.reference,
      total: order.total,
      grossAmount: order.grossAmount,
      processorFee: order.processorFee,
      netAmount: order.netAmount,
      platformCommission: order.platformCommission,
      vendorEarnings: order.vendorEarnings,
      commissionRate: order.commissionRate,
      createdAt: order.createdAt,
    }))
  }
  console.log('')

  const missingCount = allPaidOrders.filter(o => o.platformCommission == null || o.platformCommission === 0).length
  console.log(`PAID orders with missing/null/0 platformCommission: ${missingCount}`)

  const settings = await prisma.superAdminSettings.findFirst()
  console.log(`SuperAdminSettings.platformFee: ${settings?.platformFee}`)

  await prisma.$disconnect()
}

main()
  .catch(e => console.error('ERROR:', e))
  .finally(async () => { await getPrisma().$disconnect() })
