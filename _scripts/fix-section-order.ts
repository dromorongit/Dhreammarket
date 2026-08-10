import { Pool } from 'pg'

async function fixSectionOrder() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log('Fetching current homepage sections...')

    const result = await pool.query('SELECT id, slug, name, "displayOrder" FROM homepage_sections ORDER BY "displayOrder" ASC, slug ASC')
    const sections = result.rows
    console.log('Current sections:')
    sections.forEach(s => {
      console.log(`  ${s.displayOrder}: ${s.slug} (${s.name})`)
    })

    const sponsored = sections.find(s => s.slug === 'sponsored')
    const flashSales = sections.find(s => s.slug === 'flash-sales')
    const bigTopDeals = sections.find(s => s.slug === 'big-top-deals')
    const quickLinks = sections.find(s => s.slug === 'quick-links')

    if (!sponsored || !flashSales || !bigTopDeals || !quickLinks) {
      console.log('Missing required sections')
      return
    }

    // Target order: sponsored(0), flash-sales(1), big-top-deals(2), quick-links(3)
    const targetOrders: Record<string, number> = {
      'sponsored': 0,
      'flash-sales': 1,
      'big-top-deals': 2,
      'quick-links': 3,
    }

    // First, update the four key sections
    for (const [slug, targetOrder] of Object.entries(targetOrders)) {
      const section = sections.find(s => s.slug === slug)
      if (section && section.displayOrder !== targetOrder) {
        await pool.query('UPDATE homepage_sections SET "displayOrder" = $1 WHERE id = $2', [targetOrder, section.id])
        console.log(`Set ${slug} displayOrder to ${targetOrder}`)
      }
    }

    // Now fix any remaining conflicts by shifting sections that are at 0, 1, 2, or 3
    // but are NOT one of our four key sections
    const occupiedOrders = new Set([0, 1, 2, 3])
    const allSections = await pool.query('SELECT id, slug, name, "displayOrder" FROM homepage_sections ORDER BY "displayOrder" ASC, slug ASC')
    
    for (const section of allSections.rows) {
      if (targetOrders[section.slug] !== undefined) continue // skip our key sections
      
      if (occupiedOrders.has(section.displayOrder)) {
        const newOrder = 4 + section.displayOrder // shift by +4 to clear the top 4 slots
        await pool.query('UPDATE homepage_sections SET "displayOrder" = $1 WHERE id = $2', [newOrder, section.id])
        console.log(`Shifted ${section.slug} from ${section.displayOrder} to ${newOrder} to avoid conflict`)
        occupiedOrders.add(newOrder)
      }
    }

    console.log('\nFinal section order:')
    const finalResult = await pool.query('SELECT id, slug, name, "displayOrder" FROM homepage_sections ORDER BY "displayOrder" ASC, slug ASC')
    finalResult.rows.forEach(s => {
      console.log(`  ${s.displayOrder}: ${s.slug} (${s.name})`)
    })

    console.log('\nSuccessfully updated section order')
  } catch (error) {
    console.error('Error updating section order:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

fixSectionOrder()
