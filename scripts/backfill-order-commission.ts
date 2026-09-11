import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'
import { calculateFinancialBreakdown, resolveProcessorFee } from '@/lib/revenue'

const prisma = getPrisma()
const HISTORICAL_COMMISSION_RATE = 0.01

async function backfillOrderCommission() {
  console.log('=== BACKFILL ORDER COMMISSION ===')

  const orders = await prisma.$queryRaw<any[]>`
    SELECT id, "total", "grossAmount", "processorFee", "platformCommission", "vendorEarnings", "commissionRate"
    FROM "orders"
    WHERE "paymentStatus" = 'PAID'
      AND ("platformCommission" IS NULL OR "platformCommission" = 0)
    ORDER BY "createdAt" ASC
  `

  console.log(`Found ${orders.length} PAID orders with missing platformCommission`)

  if (orders.length === 0) {
    console.log('No backfill needed.')
    return
  }

  let backfilled = 0
  for (const order of orders) {
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      select: { id: true, price: true, quantity: true },
    })

    let grossAmount = order.grossAmount
    if (grossAmount === null || grossAmount === undefined) {
      grossAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    }

    const processorFee = order.processorFee ?? resolveProcessorFee(null, grossAmount)
    const financialBreakdown = calculateFinancialBreakdown(grossAmount, processorFee, HISTORICAL_COMMISSION_RATE)

    await prisma.order.update({
      where: { id: order.id },
      data: {
        grossAmount: financialBreakdown.grossAmount,
        processorFee: financialBreakdown.processorFee,
        netAmount: financialBreakdown.netAmount,
        platformCommission: financialBreakdown.platformCommission,
        vendorEarnings: financialBreakdown.vendorEarnings,
        commissionRate: financialBreakdown.commissionRate,
        total: grossAmount,
      },
    })

    for (const item of orderItems) {
      const itemGross = item.price * item.quantity
      let itemProcessorFee: number | null = null
      if (processorFee !== null && grossAmount > 0) {
        itemProcessorFee = (itemGross / grossAmount) * processorFee
      }

      const itemFinancialBreakdown = calculateFinancialBreakdown(itemGross, itemProcessorFee, HISTORICAL_COMMISSION_RATE)

      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          grossAmount: itemFinancialBreakdown.grossAmount,
          processorFee: itemFinancialBreakdown.processorFee,
          netAmount: itemFinancialBreakdown.netAmount,
          platformCommission: itemFinancialBreakdown.platformCommission,
          vendorEarnings: itemFinancialBreakdown.vendorEarnings,
          commissionRate: itemFinancialBreakdown.commissionRate,
        },
      })
    }

    backfilled++
    console.log(`  ${order.id}: gross=${grossAmount.toFixed(2)}, commission=${financialBreakdown.platformCommission.toFixed(2)}, vendorEarnings=${financialBreakdown.vendorEarnings.toFixed(2)}`)
  }

  console.log(`\nBackfilled ${backfilled} orders.`)

  const remaining = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*)::int as count FROM "orders"
    WHERE "paymentStatus" = 'PAID'
      AND ("platformCommission" IS NULL OR "platformCommission" = 0)
  `
  console.log(`Remaining PAID orders with missing platformCommission: ${remaining[0].count}`)
}

backfillOrderCommission()
  .catch(e => {
    console.error('ERROR:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
