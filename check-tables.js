const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name")
  .then(r => {
    console.log(r.rows.map(row => row.table_name).join('\n'));
    pool.end();
  })
  .catch(e => {
    console.error(e);
    pool.end();
    process.exit(1);
  });