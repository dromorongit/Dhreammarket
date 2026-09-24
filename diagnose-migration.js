require("dotenv/config");
const { Client } = require("pg");

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function runWithRetry(label, fn, attempts = 5, delayMs = 5000) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const code = e?.code;
      const message = String(e?.message ?? e ?? '');
      const isTransient = code === '57P03' || message.includes('the database system is starting up');
      if (!isTransient || i === attempts) {
        throw e;
      }
      console.warn(`[${label}] Transient DB error (${code ?? message}), retry ${i}/${attempts}...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

async function run() {
  await runWithRetry('connect', () => client.connect());
  console.log("Connected to database.");

  const results = {};

  // 1. Check tables exist
  const tables = ["influencers", "influencer_referrals", "influencer_clicks"];
  for (const table of tables) {
    const res = await runWithRetry(
      `table-${table}`,
      () => client.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table]
      )
    );
    results[table] = { exists: res.rows.length > 0, columns: res.rows };
  }

  // 2. Check foreign key constraints
  const constraints = [
    "influencer_referrals_refereeId_fkey",
    "influencer_referrals_influencerId_fkey",
    "influencer_clicks_influencerId_fkey",
  ];
  const constraintRows = await runWithRetry(
    'constraints',
    () => client.query(
      `SELECT constraint_name, table_name
       FROM information_schema.table_constraints
       WHERE table_schema = 'public'
         AND constraint_type = 'FOREIGN KEY'
         AND constraint_name = ANY($1::text[])`,
      [constraints]
    )
  );
  results.constraints = constraintRows.rows;

  // 3. Check _prisma_migrations structure first
  const structRes = await runWithRetry(
    'migrations-struct',
    () => client.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
       ORDER BY ordinal_position`
    )
  );
  results.prisma_migrations_columns = structRes.rows;

  // 4. Check _prisma_migrations for this migration
  const migrationRow = await runWithRetry(
    'migrations',
    () => client.query(
      `SELECT migration_name, finished_at, applied_steps_count, logs, rolled_back_at
       FROM _prisma_migrations
       WHERE migration_name = $1`,
      ["20260923233838_add_influencer_program"]
    )
  );
  results.migration = migrationRow.rows.length > 0 ? migrationRow.rows[0] : null;

  console.log(JSON.stringify(results, null, 2));
  await client.end();
}

run().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
