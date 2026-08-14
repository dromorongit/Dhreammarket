import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

async function backfillSupplierVendorId() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('Starting supplier vendorId backfill...')

    const suppliersResult = await pool.query('SELECT id, "companyName" FROM suppliers WHERE "vendorId" IS NULL')
    const suppliers = suppliersResult.rows
    console.log(`Found ${suppliers.length} suppliers with NULL vendorId`)

    let backfilled = 0
    const ambiguous: string[] = []
    const unattributed: string[] = []

    for (const supplier of suppliers) {
      const poResult = await pool.query(
        'SELECT DISTINCT "vendorId" FROM purchase_orders WHERE "supplierId" = $1',
        [supplier.id]
      )
      const vendorIds = poResult.rows.map(r => r.vendorId)

      if (vendorIds.length === 0) {
        unattributed.push(supplier.id)
        console.log(`  Unattributed: ${supplier.id} (${supplier.companyName}) - zero purchase orders`)
      } else if (vendorIds.length === 1) {
        await pool.query(
          'UPDATE suppliers SET "vendorId" = $1 WHERE id = $2',
          [vendorIds[0], supplier.id]
        )
        backfilled++
        console.log(`  Backfilled: ${supplier.id} (${supplier.companyName}) -> vendorId=${vendorIds[0]}`)
      } else {
        ambiguous.push(supplier.id)
        console.log(`  Ambiguous: ${supplier.id} (${supplier.companyName}) - multiple vendors: ${vendorIds.join(', ')}`)
      }
    }

    console.log('\n=== Backfill Summary ===')
    console.log(`Total suppliers with NULL vendorId: ${suppliers.length}`)
    console.log(`Successfully backfilled: ${backfilled}`)
    console.log(`Ambiguous (multiple vendors): ${ambiguous.length}`)
    console.log(`Unattributed (zero POs): ${unattributed.length}`)

    if (ambiguous.length > 0) {
      console.log('\nAmbiguous supplier IDs (manual review needed):')
      ambiguous.forEach(id => console.log(`  - ${id}`))
    }

    if (unattributed.length > 0) {
      console.log('\nUnattributed supplier IDs (manual review needed):')
      unattributed.forEach(id => console.log(`  - ${id}`))
    }

    console.log('\nBackfill completed successfully')
  } catch (error) {
    console.error('Error during backfill:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

backfillSupplierVendorId()
