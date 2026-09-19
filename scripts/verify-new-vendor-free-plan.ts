import 'dotenv/config'
import { getPrisma } from '../lib/prisma'
import { ensureFreeSubscription } from '../lib/subscription/subscription-service'
import { canCreateProduct, canCreateService } from '../lib/subscription/feature-restriction'

const prisma = getPrisma()
const TEST_EMAIL = 'test-vendor-verify-' + Date.now() + '@example.com'

async function main() {
  console.log('=== VERIFY NEW VENDOR REGISTRATION DEFAULTS TO FREE ===')
  console.log(`Test email: ${TEST_EMAIL}`)

  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'Free' } })
  const starterPlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'Starter' } })
  if (!freePlan || !starterPlan) {
    console.error('Required plans not found')
    process.exit(1)
  }

  const hashedPassword = 'test-hash-' + Date.now()
  const createdUser = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      password: hashedPassword,
      role: 'VENDOR',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
    select: { id: true, email: true, role: true },
  })
  console.log(`\nCreated test vendor: id=${createdUser.id} email=${createdUser.email}`)

  await prisma.profile.create({
    data: {
      userId: createdUser.id,
      phone: null,
      firstName: 'Test',
    },
  })

  const subscription = await ensureFreeSubscription(createdUser.id, prisma)
  console.log(`\nensureFreeSubscription result:`)
  console.log(`  subscriptionId: ${subscription.id}`)
  console.log(`  planId: ${subscription.planId}`)
  console.log(`  plan name: ${subscription.plan.name}`)
  console.log(`  status: ${subscription.status}`)
  console.log(`  billingCycle: ${subscription.billingCycle}`)
  console.log(`  totalPaid: ${subscription.totalPaid}`)

  const plan = await prisma.subscriptionPlan.findUnique({
    where: { id: subscription.planId },
    select: { id: true, name: true, productsLimit: true, servicesLimit: true },
  })
  console.log(`\nJoined plan details:`)
  console.log(`  planId: ${plan?.id}`)
  console.log(`  name: ${plan?.name}`)
  console.log(`  productsLimit: ${plan?.productsLimit}`)
  console.log(`  servicesLimit: ${plan?.servicesLimit}`)

  const productCheck = await canCreateProduct(createdUser.id)
  const serviceCheck = await canCreateService(createdUser.id)
  console.log(`\nFeature restriction checks:`)
  console.log(`  canCreateProduct: allowed=${productCheck.allowed} limit=${productCheck.limit} reason=${productCheck.reason ?? 'none'}`)
  console.log(`  canCreateService: allowed=${serviceCheck.allowed} limit=${serviceCheck.limit} reason=${serviceCheck.reason ?? 'none'}`)

  const isFree = subscription.plan.name === 'Free' && plan?.productsLimit === 20 && plan?.servicesLimit === 10
  const notStarter = subscription.plan.name !== 'Starter'
  const limitsCorrect = productCheck.limit === 20 && serviceCheck.limit === 10

  console.log('\n=== VERIFICATION RESULT ===')
  if (isFree && notStarter && limitsCorrect) {
    console.log('PASS: New vendor registration defaults to Free plan (20 products / 10 services)')
  } else {
    console.error('FAIL: Registration did NOT default to Free plan correctly')
    console.error(`  isFree=${isFree} notStarter=${notStarter} limitsCorrect=${limitsCorrect}`)
    process.exit(1)
  }

  console.log('\n--- CLEANUP ---')
  await prisma.subscriptionHistory.deleteMany({ where: { subscriptionId: subscription.id } })
  await prisma.vendorSubscription.delete({ where: { id: subscription.id } })
  await prisma.profile.delete({ where: { userId: createdUser.id } })
  await prisma.user.delete({ where: { id: createdUser.id } })
  console.log(`Deleted test vendor ${TEST_EMAIL} and associated subscription/history.`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
