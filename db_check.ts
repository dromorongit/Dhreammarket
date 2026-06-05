import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = "postgresql://postgres:JbSCjrHdsggoCZuAgloKppWqbbWFtVJG@nozomi.proxy.rlwy.net:12087/railway";

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('=== Migration Status Summary ===\n');
  
  const all = await prisma.$queryRawUnsafe(
    "SELECT migration_name, finished_at IS NOT NULL as applied, rolled_back_at IS NOT NULL as rolled_back, applied_steps_count FROM _prisma_migrations ORDER BY started_at DESC"
  );
  (all as any[]).forEach(row => {
    const status = row.rolled_back ? 'Rolled Back' : (row.applied ? 'Applied' : 'Pending');
    console.log(`${row.migration_name}: ${status} (steps: ${row.applied_steps_count})`);
  });
  
  console.log('\n=== Schema Drift Summary ===\n');
  
  console.log('order_items.storeId: NOT IN SCHEMA, NOT IN DB (OK)');
  console.log('vendor_verification_applications.paystackRef: IN SCHEMA, MISSING IN DB (DRIFT)');
  console.log('vendor_verification_kyc: MISSING 5 columns (DRIFT)');
  console.log('verification_payments: IN SCHEMA, MISSING IN DB (DRIFT)');
  console.log('VerificationStatus enum: VALUES DRIFT detected');
  console.log('VerificationAction enum: VALUES DRIFT detected');
  
  await prisma.$disconnect();
}

main();