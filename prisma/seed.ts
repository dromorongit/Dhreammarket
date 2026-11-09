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

  // Support AI v2 knowledge base: non-conflicting FAQ content only, seeded as
  // DRAFT. Code never approves documents; only a human approval changes status.
  // Deliberately NOT seeded: returns, cancellation, payout timing, vendor
  // review timing, or platform commission content (policy gaps for Phase 2).
  const supportDocuments = [
    {
      slug: 'payment-methods-info',
      title: 'Payment methods',
      intent: 'buyer.payment_methods_info',
      content:
        'We accept all major credit/debit cards, mobile money, and bank transfers through Paystack, our secure payment processor.',
    },
    {
      slug: 'delivery-info',
      title: 'Delivery times',
      intent: 'buyer.delivery_info',
      content:
        'Delivery times vary by seller location and shipping method. Standard delivery typically takes 3-7 business days. You will receive tracking information once your order ships.',
    },
    {
      slug: 'track-order-info',
      title: 'Track your order',
      intent: 'buyer.track_order_info',
      content:
        'Go to your Dashboard > Orders. Click on any order to see its current status. You can also track order updates through email notifications.',
    },
    {
      slug: 'account-help-general',
      title: 'Account help',
      intent: 'account.help_general',
      content:
        "Click 'Forgot Password' on the login page. Enter your email address and follow the reset link sent to your inbox. The link expires in 1 hour.",
    },
    {
      slug: 'about-platform',
      title: 'About Dhream Market',
      intent: 'general.about_platform',
      content:
        'Dhream Market is the trusted home of Ghanaian trade online — built for the SMEs and shoppers who power our economy every day.',
    },
  ]

  for (const doc of supportDocuments) {
    const existing = await prisma.supportDocument.findUnique({ where: { slug: doc.slug } })
    if (existing) {
      logInfo(`Support document already exists, leaving status unchanged: ${doc.slug}`)
      continue
    }
    const created = await prisma.supportDocument.create({
      data: {
        slug: doc.slug,
        title: doc.title,
        content: doc.content,
        status: 'DRAFT',
        version: 1,
        intent: doc.intent,
      },
    })
    await prisma.documentChunk.create({
      data: { documentId: created.id, chunkIndex: 0, content: doc.content },
    })
    logInfo(`Seeded support document (DRAFT): ${doc.slug}`)
  }

  logInfo('Support AI v2 seed complete')
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
