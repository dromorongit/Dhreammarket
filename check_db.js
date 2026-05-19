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

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
