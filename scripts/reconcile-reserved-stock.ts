// Reconcile drifted reservedQuantity on Product and ProductVariant.
//
//   npx tsx scripts/reconcile-reserved-stock.ts          # dry run (default)
//   npx tsx scripts/reconcile-reserved-stock.ts --apply  # write corrections
//
// Defaults to dry run: nothing is written unless --apply is passed. It refuses
// to run unless the target is the local development database, and it refuses
// production runs unless --i-know-this-is-production is passed explicitly.
//
// For every Product and ProductVariant it computes the expected
// reservedQuantity as the sum of order item quantities across orders where
// stockReservedAt IS NOT NULL and inventoryConsumedAt IS NULL (i.e. active,
// unconsumed reservations), then compares it with the stored reservedQuantity.
//
// In DRY RUN mode it prints only a table of id, name, stored, expected,
// difference, and totals.
//
// With --apply it updates the stored values, one transaction per
// product/variant.
//
// The DATABASE_URL is never printed, on success or on failure.
import { assertLocalDatabaseUrl } from './assert-local-db.mjs'
import { getPrisma } from '../lib/prisma'

type DriftRow = {
  kind: 'product' | 'variant'
  id: string
  name: string
  stored: number
  expected: number
  difference: number
}

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
        throw new Error(
          `unknown argument: ${arg}. Usage: scripts/reconcile-reserved-stock.ts [--apply] [--i-know-this-is-production]`
        )
    }
  }

  // The URL is never printed, on success or on failure.
  assertLocalDatabaseUrl(process.env.DATABASE_URL)

  if (process.env.NODE_ENV === 'production' && !iKnowThisIsProduction) {
    throw new Error(
      'refusing to run against production: pass --i-know-this-is-production explicitly'
    )
  }

  const prisma = getPrisma()
  try {
    // Expected reservedQuantity per product from active (unconsumed) reservations.
    const expectedProducts = await prisma.$queryRaw<Array<{ id: string; expected: number }>>`
      SELECT oi."productId" AS id, COALESCE(SUM(oi."quantity")::int, 0) AS expected
      FROM "order_items" oi
      JOIN "orders" o ON o.id = oi."orderId"
      WHERE o."stockReservedAt" IS NOT NULL
        AND o."inventoryConsumedAt" IS NULL
      GROUP BY oi."productId"
    `

    // Expected reservedQuantity per product variant from active reservations.
    const expectedVariants = await prisma.$queryRaw<Array<{ id: string; expected: number }>>`
      SELECT oi."productVariantId" AS id, COALESCE(SUM(oi."quantity")::int, 0) AS expected
      FROM "order_items" oi
      JOIN "orders" o ON o.id = oi."orderId"
      WHERE oi."productVariantId" IS NOT NULL
        AND o."stockReservedAt" IS NOT NULL
        AND o."inventoryConsumedAt" IS NULL
      GROUP BY oi."productVariantId"
    `

    const expectedProductMap = new Map<string, number>()
    for (const row of expectedProducts) {
      expectedProductMap.set(row.id, Number(row.expected))
    }

    const expectedVariantMap = new Map<string, number>()
    for (const row of expectedVariants) {
      expectedVariantMap.set(row.id, Number(row.expected))
    }

    const products = await prisma.product.findMany({
      select: { id: true, name: true, reservedQuantity: true },
      orderBy: { name: 'asc' },
    })
    const variants = await prisma.productVariant.findMany({
      select: { id: true, reservedQuantity: true, product: { select: { name: true } } },
      orderBy: [{ product: { name: 'asc' } }, { id: 'asc' }],
    })

    const rows: DriftRow[] = []

    for (const p of products) {
      const expected = expectedProductMap.get(p.id) ?? 0
      const difference = p.reservedQuantity - expected
      rows.push({
        kind: 'product',
        id: p.id,
        name: p.name,
        stored: p.reservedQuantity,
        expected,
        difference,
      })
    }

    for (const v of variants) {
      const expected = expectedVariantMap.get(v.id) ?? 0
      const difference = v.reservedQuantity - expected
      rows.push({
        kind: 'variant',
        id: v.id,
        name: v.product.name,
        stored: v.reservedQuantity,
        expected,
        difference,
      })
    }

    const drifted = rows.filter(r => r.difference !== 0)
    const totalStored = rows.reduce((sum, r) => sum + r.stored, 0)
    const totalExpected = rows.reduce((sum, r) => sum + r.expected, 0)
    const totalDifference = rows.reduce((sum, r) => sum + r.difference, 0)

    // Dry run: print only the table of drifted rows plus totals.
    if (!apply) {
      if (drifted.length === 0) {
        process.stdout.write('No drift detected.\n')
      } else {
        console.table(
          drifted.map(r => ({
            kind: r.kind,
            id: r.id,
            name: r.name,
            stored: r.stored,
            expected: r.expected,
            difference: r.difference,
          }))
        )
        process.stdout.write(
          `Totals: stored=${totalStored} expected=${totalExpected} difference=${totalDifference} driftedRows=${drifted.length}\n`
        )
      }
      return
    }

    // Apply: recompute each expected value inside its own transaction so a
    // checkout happening mid-run cannot be overwritten with a stale value.
    let corrected = 0
    for (const row of drifted) {
      if (row.kind === 'product') {
        await prisma.$transaction(async (tx) => {
          const expected = await tx.$queryRaw<Array<{ expected: number }>>`
            SELECT COALESCE(SUM(oi."quantity")::int, 0) AS expected
            FROM "order_items" oi
            JOIN "orders" o ON o.id = oi."orderId"
            WHERE oi."productId" = ${row.id}
              AND o."stockReservedAt" IS NOT NULL
              AND o."inventoryConsumedAt" IS NULL
          `
          const expectedValue = Number((expected[0] as { expected: number }).expected)
          await tx.product.update({
            where: { id: row.id },
            data: { reservedQuantity: expectedValue },
          })
        })
      } else {
        await prisma.$transaction(async (tx) => {
          const expected = await tx.$queryRaw<Array<{ expected: number }>>`
            SELECT COALESCE(SUM(oi."quantity")::int, 0) AS expected
            FROM "order_items" oi
            JOIN "orders" o ON o.id = oi."orderId"
            WHERE oi."productVariantId" = ${row.id}
              AND o."stockReservedAt" IS NOT NULL
              AND o."inventoryConsumedAt" IS NULL
          `
          const expectedValue = Number((expected[0] as { expected: number }).expected)
          await tx.productVariant.update({
            where: { id: row.id },
            data: { reservedQuantity: expectedValue },
          })
        })
      }
      corrected++
    }

    process.stdout.write(
      `Corrected ${corrected} drifted row(s). ` +
      `Totals before: stored=${totalStored} expected=${totalExpected} difference=${totalDifference}\n`
    )
  } finally {
    await prisma.$disconnect()
  }
}

main(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
