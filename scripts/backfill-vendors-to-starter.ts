import 'dotenv/config'
import { getPrisma } from '../lib/prisma'
import { upgradeSubscription } from '../lib/subscription/subscription-service'

const prisma = getPrisma()

async function backfillVendorsToStarter() {
  console.log('=== BACKFILL VENDORS TO STARTER PLAN ===')

  const starterPlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'Starter' } })
  const freePlan = await prisma.subscriptionPlan.findUnique({ where: { name: 'Free' } })
  if (!starterPlan || !freePlan) {
    console.error('Required plans not found in database')
    process.exit(1)
  }

  console.log('\n--- BEFORE SNAPSHOT ---')
  const vendorCountBefore = await prisma.user.count({ where: { role: 'VENDOR' } })
  const freeCountBefore = await prisma.vendorSubscription.count({ where: { planId: freePlan.id } })
  const starterCountBefore = await prisma.vendorSubscription.count({ where: { planId: starterPlan.id } })
  console.log(`Vendor users: ${vendorCountBefore}`)
  console.log(`Free subscriptions: ${freeCountBefore}`)
  console.log(`Starter subscriptions: ${starterCountBefore}`)

  const vendorUsers = await prisma.user.findMany({
    where: { role: 'VENDOR' },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  })

  const allSubscriptions = await prisma.vendorSubscription.findMany({
    include: { plan: true },
  })

  const subsByVendorId = new Map<string, typeof allSubscriptions>()
  const anomalies: Array<{ subscriptionId: string; vendorId: string; email?: string; reason: string }> = []

  for (const s of allSubscriptions) {
    const user = await prisma.user.findUnique({
      where: { id: s.vendorId },
      select: { id: true, email: true, role: true },
    })
    if (!user) {
      anomalies.push({ subscriptionId: s.id, vendorId: s.vendorId, reason: 'Orphaned subscription (user deleted)' })
      continue
    }
    if (user.role !== 'VENDOR') {
      anomalies.push({ subscriptionId: s.id, vendorId: s.vendorId, email: user.email, reason: `Non-VENDOR user (role=${user.role})` })
      continue
    }
    const existing = subsByVendorId.get(s.vendorId) ?? []
    existing.push(s)
    subsByVendorId.set(s.vendorId, existing)
  }

  const upgradeBucket: Array<{ vendorId: string; email: string }> = []
  const newCreateBucket: Array<{ vendorId: string; email: string }> = []
  const skipBucket: Array<{ vendorId: string; email: string; reason: string }> = []

  for (const v of vendorUsers) {
    const subs = subsByVendorId.get(v.id) ?? []
    if (subs.length === 0) {
      newCreateBucket.push({ vendorId: v.id, email: v.email })
    } else if (subs.length === 1) {
      const s = subs[0]
      if (s.plan.name === 'Free') {
        upgradeBucket.push({ vendorId: v.id, email: v.email })
      } else if (s.plan.name === 'Starter') {
        skipBucket.push({ vendorId: v.id, email: v.email, reason: 'Already on Starter' })
      } else {
        skipBucket.push({ vendorId: v.id, email: v.email, reason: `Already on ${s.plan.name}` })
      }
    } else {
      anomalies.push({ subscriptionId: subs.map((s) => s.id).join(','), vendorId: v.id, email: v.email, reason: `Multiple subscriptions (${subs.length})` })
    }
  }

  console.log('\n--- CLASSIFICATION ---')
  console.log(`Upgrade from Free: ${upgradeBucket.length}`)
  console.log(`New Starter create: ${newCreateBucket.length}`)
  console.log(`Skip (already paid/higher): ${skipBucket.length}`)
  console.log(`Anomalies flagged: ${anomalies.length}`)

  if (anomalies.length > 0) {
    console.log('\nAnomalous rows (will be skipped):')
    for (const a of anomalies) {
      console.log(`  ${a.subscriptionId} | vendorId=${a.vendorId} | email=${a.email ?? '(none)'} | ${a.reason}`)
    }
  }

  let upgraded = 0
  let created = 0
  let skipped = 0

  for (const v of upgradeBucket) {
    try {
      const updated = await upgradeSubscription(v.vendorId, 'Starter')
      console.log(`  UPGRADED: ${v.email} -> Starter (subId=${updated.id})`)
      upgraded++
    } catch (e) {
      console.error(`  FAILED upgrade for ${v.email}: ${e}`)
    }
  }

  const now = new Date()
  const periodEnd = new Date(now)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  for (const v of newCreateBucket) {
    try {
      const subscription = await prisma.vendorSubscription.create({
        data: {
          vendorId: v.vendorId,
          planId: starterPlan.id,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextRenewalAt: periodEnd,
          autoRenew: false,
          totalPaid: 0,
        },
        include: { plan: true },
      })

      await prisma.subscriptionHistory.create({
        data: {
          subscriptionId: subscription.id,
          action: 'SUBSCRIBED',
          toPlanId: starterPlan.id,
          billingCycle: 'MONTHLY',
          notes: 'One-off backfill: vendor granted Starter plan limits before public launch',
        },
      })

      console.log(`  CREATED: ${v.email} -> Starter (subId=${subscription.id})`)
      created++
    } catch (e) {
      console.error(`  FAILED create for ${v.email}: ${e}`)
    }
  }

  skipped = skipBucket.length

  console.log('\n--- AFTER SNAPSHOT ---')
  const freeCountAfter = await prisma.vendorSubscription.count({ where: { planId: freePlan.id } })
  const starterCountAfter = await prisma.vendorSubscription.count({ where: { planId: starterPlan.id } })
  console.log(`Free subscriptions: ${freeCountAfter}`)
  console.log(`Starter subscriptions: ${starterCountAfter}`)

  console.log('\n=== SUMMARY ===')
  console.log(`Upgraded from Free: ${upgraded}`)
  console.log(`Newly created on Starter: ${created}`)
  console.log(`Skipped: ${skipped}`)
  console.log(`Anomalies flagged (not touched): ${anomalies.length}`)

  const totalProcessed = upgraded + created + skipped + anomalies.length
  if (totalProcessed !== vendorUsers.length) {
    console.error(`\nWARNING: Processed count (${totalProcessed}) does not match vendor count (${vendorUsers.length}). Review logs above.`)
  } else {
    console.log('\nAll expected vendors accounted for.')
  }
}

backfillVendorsToStarter()
  .catch((e) => {
    console.error('FATAL:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
