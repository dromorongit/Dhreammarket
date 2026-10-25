import { assertLocalDatabaseUrl } from './assert-local-db.mjs'
import { getPrisma } from '../lib/prisma'
import { buildPayoutEligibilityComparison } from '../lib/ledger/payout-eligibility'

async function main(argv: string[]): Promise<void> {
  let iKnowThisIsProduction = false
  let limit = 50

  for (const arg of argv.slice(2)) {
    if (arg === '--i-know-this-is-production') {
      iKnowThisIsProduction = true
    } else if (arg.startsWith('--limit=')) {
      const n = Number(arg.slice('--limit='.length))
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n)
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  assertLocalDatabaseUrl(process.env.DATABASE_URL)

  if (process.env.NODE_ENV === 'production' && !iKnowThisIsProduction) {
    throw new Error('refusing to run against production: pass --i-know-this-is-production explicitly')
  }

  const client = getPrisma()
  try {
    const report = await buildPayoutEligibilityComparison(client, { limit })
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } finally {
    await client.$disconnect()
  }
}

main(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
