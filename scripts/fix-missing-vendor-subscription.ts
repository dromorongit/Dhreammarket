import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'
import { ensureFreeSubscription } from '@/lib/subscription/subscription-service'

async function main() {
  const prisma = getPrisma()
  const vendorId = 'cmugyxbpr00001rp8143exrkj'

  console.log('Running ensureFreeSubscription for vendor:', vendorId)
  const subscription = await ensureFreeSubscription(vendorId)

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: subscription.planId },
    select: { id: true, name: true, productsLimit: true, servicesLimit: true },
  })

  console.log(JSON.stringify({
    subscriptionId: subscription.id,
    vendorId: subscription.vendorId,
    status: subscription.status,
    plan: plan,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
  }, null, 2))

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})
