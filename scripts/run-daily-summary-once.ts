// Run the daily vendor sales summary once, locally.
//
//   npx tsx scripts/run-daily-summary-once.ts                    # uses now
//   npx tsx scripts/run-daily-summary-once.ts 2026-11-05T19:00:00Z
//
// Prints only the result JSON from runDailySummaries. The DATABASE_URL is never
// printed, on success or on failure. Refuses to run against anything other than
// the local development database.

import { assertLocalDatabaseUrl } from './assert-local-db.mjs'
import { getPrisma } from '../lib/prisma'
import { runDailySummaries } from '../lib/daily-summary'

async function main(argv: string[]): Promise<void> {
  // The URL is never printed, on success or on failure.
  assertLocalDatabaseUrl(process.env.DATABASE_URL)

  if (process.env.NODE_ENV === 'production') {
    throw new Error('refusing to run against production')
  }

  const nowArg = argv[2]
  const now = nowArg ? new Date(nowArg) : new Date()
  if (isNaN(now.getTime())) {
    throw new Error(`invalid ISO timestamp: ${nowArg}`)
  }

  const prisma = getPrisma()
  try {
    const result = await runDailySummaries(now)
    process.stdout.write(JSON.stringify(result) + '\n')
  } finally {
    await prisma.$disconnect()
  }
}

main(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
