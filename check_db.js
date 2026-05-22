const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:JbSCjrHdsggoCZuAgloKppWqbbWFtVJG@nozomi.proxy.rlwy.net:12087/railway'
});

async function main() {
  // Check tables
  const tables = await pool.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  console.log('=== TABLES ===');
  tables.rows.forEach(r => console.log(' -', r.table_name));

  // Check existing users
  const users = await pool.query(`
    SELECT id, email, role, "createdAt" FROM users ORDER BY role, "createdAt"
  `);
  console.log('\n=== USERS ===');
  users.rows.forEach(r => console.log(` - ${r.email} | ${r.role} | ${r.createdAt}`));

  // Check if SUPER_ADMIN unique index exists
  const indexes = await pool.query(`
    SELECT indexname, indexdef FROM pg_indexes 
    WHERE tablename = 'users' AND indexdef LIKE '%SUPER_ADMIN%'
  `);
  console.log('\n=== SUPER_ADMIN INDEXES ===');
  if (indexes.rows.length === 0) {
    console.log(' - No SUPER_ADMIN unique index found');
  } else {
    indexes.rows.forEach(r => console.log(` - ${r.indexname}: ${r.indexdef}`));
  }

  // Check categories table structure
  const categoriesColumns = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'categories'
    ORDER BY ordinal_position
  `);
  console.log('\n=== CATEGORIES TABLE STRUCTURE ===');
  categoriesColumns.rows.forEach(col => {
    console.log(` - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
  });

  // Check if there are any categories
  const categoriesCount = await pool.query('SELECT COUNT(*) FROM categories');
  console.log(`\n=== CATEGORIES COUNT ===`);
  console.log(` - ${categoriesCount.rows[0].count} categories`);

  // Fetch a few categories to see data
  if (parseInt(categoriesCount.rows[0].count) > 0) {
    const sampleCategories = await pool.query('SELECT id, name, slug, isActive, parentId FROM categories LIMIT 5');
    console.log('\n=== SAMPLE CATEGORIES ===');
    sampleCategories.rows.forEach(cat => {
      console.log(` - ID: ${cat.id}, Name: ${cat.name}, Slug: ${cat.slug}, Active: ${cat.isActive}, ParentId: ${cat.parentId}`);
    });
  }

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
