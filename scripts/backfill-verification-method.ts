import { getPrisma } from '@/lib/prisma'

export function parseArgs(argv: string[]): { dryRun: boolean; allowHost: boolean; acceptUncertain: boolean } {
  let dryRun = true
  let allowHost = false
  let acceptUncertain = false
  for (const arg of argv) {
    if (arg === '--apply') {
      dryRun = false
    } else if (arg === '--dry-run' || arg === '-n') {
      dryRun = true
    } else if (arg === '--allow-host') {
      allowHost = true
    } else if (arg === '--accept-uncertain') {
      acceptUncertain = true
    }
  }
  return { dryRun, allowHost, acceptUncertain }
}

export async function backfillVerificationMethod() {
  const { dryRun, allowHost, acceptUncertain } = parseArgs(process.argv.slice(2))
  const prisma = getPrisma()

  const dbUrl = process.env.DATABASE_URL || ''
  let host = ''
  try {
    host = new URL(dbUrl).hostname.toLowerCase()
  } catch {
    host = ''
  }
  console.log(`backfill: host=${host || '(unset)'}`)
  if (host !== 'localhost' && host !== '127.0.0.1' && !allowHost) {
    throw new Error('Refusing to run: DATABASE_URL host is not localhost (pass --allow-host to override)')
  }

  const dbCheck = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`
  if (dbCheck[0]?.current_database !== 'dhream_dev') {
    throw new Error('Refusing to run: current_database is not dhream_dev')
  }

  // Find all verified stores
  const verifiedStores = await prisma.store.findMany({
    where: { isVerified: true },
    include: {
      verificationApplications: {
        where: { status: 'APPROVED' },
        orderBy: { updatedAt: 'desc' },
        take: 1,
        include: {
          auditLogs: {
            where: { action: 'ADMIN_APPROVED' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  console.log(`Found ${verifiedStores.length} verified stores`)

  let wouldUpdateCount = 0
  let kycCount = 0
  let adminFlagCount = 0

  const changes: Array<{
    storeId: string
    storeName: string
    method: 'KYC' | 'ADMIN_FLAG'
    kycVerifiedAt: Date | null
    currentMethod: string | null
  }> = []

  for (const store of verifiedStores) {
    const hasApprovedApplication = store.verificationApplications.length > 0

    let verificationMethod: 'KYC' | 'ADMIN_FLAG'
    let kycVerifiedAt: Date | null = null

    let uncertain = false
    if (hasApprovedApplication) {
      verificationMethod = 'KYC'
      // Use the createdAt of the audit row for the application's approve action.
      const approvedAudit = store.verificationApplications[0].auditLogs?.[0]
      if (approvedAudit) {
        kycVerifiedAt = approvedAudit.createdAt
      } else {
        uncertain = true
        kycVerifiedAt = store.verificationApplications[0].updatedAt
      }
      kycCount++
    } else {
      verificationMethod = 'ADMIN_FLAG'
      adminFlagCount++
    }

    if (uncertain && !acceptUncertain) {
      console.log(`Uncertain: ${store.name} (${store.id}) has no APPROVED audit log; skipping (pass --accept-uncertain)`)
      continue
    }

    if (store.verificationMethod === verificationMethod && !(uncertain)) {
      continue // no change needed
    }

    wouldUpdateCount++
    changes.push({
      storeId: store.id,
      storeName: store.name,
      method: verificationMethod,
      kycVerifiedAt,
      currentMethod: store.verificationMethod,
    })

    if (!dryRun) {
      await prisma.store.update({
        where: { id: store.id },
        data: {
          verificationMethod,
          kycVerifiedAt,
        },
      })
    }
  }

  // Group changes by method
  const byMethod = new Map<'KYC' | 'ADMIN_FLAG', string[]>()
  for (const change of changes) {
    const list = byMethod.get(change.method) ?? []
    list.push(`${change.storeName} (${change.storeId})`)
    byMethod.set(change.method, list)
  }

  if (dryRun) {
    console.log('\n=== DRY RUN - no changes made ===')
    console.log(`Would update ${wouldUpdateCount} stores:`)
    for (const [method, stores] of byMethod.entries()) {
      console.log(`\n${method} (${stores.length}):`)
      for (const s of stores) {
        console.log(`  - ${s}`)
      }
    }
    console.log(`\nPlanned: KYC=${kycCount}, ADMIN_FLAG=${adminFlagCount}`)
    console.log('Run without --dry-run to apply changes.')
  } else {
    console.log(`\nBackfill complete:`)
    console.log(`  Total updated: ${wouldUpdateCount}`)
    console.log(`  KYC: ${kycCount}`)
    console.log(`  ADMIN_FLAG: ${adminFlagCount}`)
  }
}

const invokedDirectly = (process.argv[1] || '').replace(/\\/g, '/').endsWith('scripts/backfill-verification-method.ts')
if (invokedDirectly) {
  backfillVerificationMethod()
    .catch((err) => {
      console.error('Backfill failed:', err)
      process.exit(1)
    })
    .finally(async () => {
      await getPrisma().$disconnect()
    })
}
