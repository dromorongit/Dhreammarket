import { assertLocalDatabaseUrl } from './assert-local-db.mjs'
import { getPrisma } from '../lib/prisma'
import { findOverdueReturns, findSettledReturns } from '../lib/returns/overdue'

async function main(argv: string[]): Promise<void> {
  assertLocalDatabaseUrl(process.env.DATABASE_URL)

  if (process.env.NODE_ENV === 'production') {
    throw new Error('refusing to run against production')
  }

  const client = getPrisma()
  try {
    const rows = await client.returnRequest.findMany({
      where: { status: { in: ['PENDING', 'ITEM_IN_TRANSIT', 'ITEM_RECEIVED'] } },
      select: { id: true, escalationDeadline: true, createdAt: true, status: true },
    })
    const now = new Date()
    const overdue = findOverdueReturns(rows, now)
    const report = overdue.map((r: any) => ({
      id: r.id,
      escalationDeadline: r.escalationDeadline,
      createdAt: r.createdAt,
    }))
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')

    // Dry-run: list AWAITING_REFUND requests whose linked refund is PROCESSED.
    // Ids only, read-only, not wired to any automatic action.
    const settledRows = await client.returnRequest.findMany({
      where: { status: 'AWAITING_REFUND' },
      include: { refunds: { select: { status: true } } },
    })
    const settled = findSettledReturns(settledRows)
    const settledReport = settled.map((r: any) => ({ id: r.id }))
    process.stdout.write(JSON.stringify({ settled: settledReport }, null, 2) + '\n')
  } finally {
    await client.$disconnect()
  }
}

main(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})