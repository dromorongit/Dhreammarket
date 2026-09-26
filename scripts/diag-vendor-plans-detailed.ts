import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'

async function main() {
  const prisma = getPrisma()

  const vendors = await prisma.user.findMany({
    where: { role: 'VENDOR' },
    select: { id: true, email: true },
    orderBy: { createdAt: 'asc' },
  })

  const subs = await prisma.vendorSubscription.findMany({
    include: { plan: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const subsByVendor = new Map<string, typeof subs>()
  for (const s of subs) {
    const list = subsByVendor.get(s.vendorId) ?? []
    list.push(s)
    subsByVendor.set(s.vendorId, list)
  }

  const onStarter: Array<{ vendorId: string; email: string }> = []
  const onFree: Array<{ vendorId: string; email: string }> = []
  const missing: Array<{ vendorId: string; email: string }> = []
  const duplicates: Array<{ vendorId: string; email: string; plans: string[] }> = []

  for (const v of vendors) {
    const list = subsByVendor.get(v.id) ?? []
    if (list.length === 0) {
      missing.push({ vendorId: v.id, email: v.email })
      continue
    }
    const planNames = list.map((s) => s.plan?.name ?? 'Unknown')
    if (list.length > 1) {
      duplicates.push({ vendorId: v.id, email: v.email, plans: planNames })
    }
    const latest = list[list.length - 1]
    if (latest.plan?.name === 'Starter') onStarter.push({ vendorId: v.id, email: v.email })
    else onFree.push({ vendorId: v.id, email: v.email })
  }

  console.log(`Total vendor users: ${vendors.length}`)
  console.log(`On Starter: ${onStarter.length}`)
  console.log(`On Free: ${onFree.length}`)
  console.log(`Missing subscription: ${missing.length}`)
  console.log(`Duplicate subscriptions: ${duplicates.length}`)

  if (missing.length) {
    console.log('\n--- Missing subscriptions ---')
    for (const row of missing) {
      console.log(`  ${row.vendorId} | ${row.email}`)
    }
  }

  if (onFree.length) {
    console.log('\n--- On Free ---')
    for (const row of onFree) {
      console.log(`  ${row.vendorId} | ${row.email}`)
    }
  }

  if (duplicates.length) {
    console.log('\n--- Duplicate subscriptions ---')
    for (const row of duplicates) {
      console.log(`  ${row.vendorId} | ${row.email} | ${row.plans.join(', ')}`)
    }
  }

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('ERROR:', e)
  process.exit(1)
})
