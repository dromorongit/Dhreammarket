const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const cols = await pool.query(
      'SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position',
      ['support_tickets']
    );
    console.log('=== support_tickets COLUMNS ===');
    console.table(cols.rows);

    const cols2 = await pool.query(
      'SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position',
      ['support_conversations']
    );
    console.log('=== support_conversations COLUMNS ===');
    console.table(cols2.rows);

    const cols3 = await pool.query(
      'SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position',
      ['support_messages']
    );
    console.log('=== support_messages COLUMNS ===');
    console.table(cols3.rows);

    const t = await pool.query('SELECT * FROM "support_tickets" ORDER BY "createdAt" DESC LIMIT 10');
    console.log('=== ALL SUPPORT TICKETS (' + t.rowCount + ' rows) ===');
    console.table(t.rows);

    const c = await pool.query('SELECT * FROM "support_conversations" ORDER BY "createdAt" DESC LIMIT 10');
    console.log('=== ALL SUPPORT CONVERSATIONS (' + c.rowCount + ' rows) ===');
    console.table(c.rows);

    const m = await pool.query('SELECT * FROM "support_messages" ORDER BY "createdAt" DESC LIMIT 10');
    console.log('=== ALL SUPPORT MESSAGES (' + m.rowCount + ' rows) ===');
    console.table(m.rows);
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
