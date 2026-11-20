import { getPrisma } from '@/lib/prisma'

function parseArgs(argv: string[]): { dryRun: boolean } {
  let dryRun = false
  for (const arg of argv) {
    if (arg === '--dry-run' || arg === '-n') {
      dryRun = true
    }
  }
  return { dryRun }
}

async function backfillVerificationMethod() {
  const { dryRun } = parseArgs(process.argv.slice(2))
  const prisma = getPrisma()

  // Find all verified stores
  const verifiedStores = await prisma.store.findMany({
    where: { isVerified: true },
    include: {
      verificationApplications: {
        where: { status: 'APPROVED' },
        orderBy: { updatedAt: 'desc' },
        take: 1,
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

    if (hasApprovedApplication) {
      verificationMethod = 'KYC'
      kycVerifiedAt = store.verificationApplications[0].updatedAt
      kycCount++
    } else {
      verificationMethod = 'ADMIN_FLAG'
      adminFlagCount++
    }

    if (store.verificationMethod === verificationMethod) {
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

backfillVerificationMethod()
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await getPrisma().$disconnect()
  })
