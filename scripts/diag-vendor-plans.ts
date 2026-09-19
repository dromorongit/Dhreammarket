import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'

async function main() {
  const prisma = getPrisma()

  const totalVendors = await prisma.user.count({
    where: { role: 'VENDOR' },
  })

  const withSubscription = await prisma.user.count({
    where: {
      role: 'VENDOR',
      vendorSubscriptions: { some: {} },
    },
  })

  const withoutSubscription = totalVendors - withSubscription

  const planDist = await prisma.vendorSubscription.groupBy({
    by: ['planId'],
    where: {},
    _count: { id: true },
  })

  const plans = await prisma.subscriptionPlan.findMany({
    select: { id: true, name: true },
  })
  const planMap = Object.fromEntries(plans.map((p) => [p.id, p.name]))

  console.log('=== VENDOR SUBSCRIPTION DIAGNOSTICS ===')
  console.log(`Total vendors: ${totalVendors}`)
  console.log(`Vendors with subscription: ${withSubscription}`)
  console.log(`Vendors without subscription: ${withoutSubscription}`)
  console.log('Plan distribution:')
  for (const row of planDist) {
    console.log(`  ${planMap[row.planId] ?? 'Unknown'}: ${row._count.id}`)
  }

  const freePlan = await prisma.subscriptionPlan.findUnique({
    where: { name: 'Free' },
  })
  if (freePlan) {
    const onFree = await prisma.vendorSubscription.count({
      where: { planId: freePlan.id },
    })
    console.log(`Vendors on Free plan: ${onFree}`)
  }

  const starterPlan = await prisma.subscriptionPlan.findUnique({
    where: { name: 'Starter' },
  })
  if (starterPlan) {
    const onStarter = await prisma.vendorSubscription.count({
      where: { planId: starterPlan.id },
    })
    console.log(`Vendors on Starter plan: ${onStarter}`)
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})
