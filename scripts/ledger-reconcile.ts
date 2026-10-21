// Thin CLI for the corrective-ledger reconciliation.
//
//   npx tsx scripts/ledger-reconcile.ts          # dry run (default)
//   npx tsx scripts/ledger-reconcile.ts --apply  # backfill missing entries
//
// Defaults to dry run: nothing is written unless --apply is passed. It refuses
// to run unless the target is the local development database (the same guard
// every scripts/* database command uses), and it refuses production runs
// unless --i-know-this-is-production is passed explicitly.
import { assertLocalDatabaseUrl } from './assert-local-db.mjs'
import { getPrisma } from '../lib/prisma'
import { reconcileClawbacks } from '../lib/ledger/reconcile'

async function main(argv: string[]): Promise<void> {
  let apply = false
  let iKnowThisIsProduction = false

  for (const arg of argv.slice(2)) {
    switch (arg) {
      case '--apply':
        apply = true
        break
      case '--i-know-this-is-production':
        iKnowThisIsProduction = true
        break
      default:
        throw new Error(`unknown argument: ${arg}. Usage: scripts/ledger-reconcile.ts [--apply] [--i-know-this-is-production]`)
    }
  }

  // The URL is never printed, on success or on failure.
  assertLocalDatabaseUrl(process.env.DATABASE_URL)

  if (process.env.NODE_ENV === 'production' && !iKnowThisIsProduction) {
    throw new Error(
      'refusing to run against production: pass --i-know-this-is-production explicitly'
    )
  }

  const client = getPrisma()
  try {
    const report = await reconcileClawbacks(client, { apply })
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } finally {
    await client.$disconnect()
  }
}

main(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
