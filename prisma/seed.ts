import 'dotenv/config'
import { getPrisma } from '../lib/prisma'
import { subscriptionPlans, planBenefits } from '../lib/subscription/types'
import { logInfo } from '../lib/logger'

async function main() {
  const prisma = getPrisma()

  for (const plan of subscriptionPlans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {
        priceMonthly: plan.priceMonthly ?? null,
        priceYearly: plan.priceYearly ?? null,
        productsLimit: plan.productsLimit,
        servicesLimit: plan.servicesLimit,
        isActive: true,
        benefits: JSON.stringify(planBenefits[plan.name as keyof typeof planBenefits] ?? []),
      },
      create: {
        name: plan.name,
        priceMonthly: plan.priceMonthly ?? null,
        priceYearly: plan.priceYearly ?? null,
        productsLimit: plan.productsLimit,
        servicesLimit: plan.servicesLimit,
        isActive: true,
        benefits: JSON.stringify(planBenefits[plan.name as keyof typeof planBenefits] ?? []),
      },
    })
    logInfo(`Seeded subscription plan: ${plan.name}`)
  }

  logInfo('Subscription plan seeding complete')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    try {
      await getPrisma().$disconnect()
    } catch {}
  })
