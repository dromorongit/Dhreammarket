import "dotenv/config";
import { getPrisma } from "@/lib/prisma";

const prisma = getPrisma();

const statements = [
  `CREATE TABLE IF NOT EXISTS "influencers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "referralCode" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "incentivePerVendor" DOUBLE PRECISION,
    "incentivePerCustomer" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "influencers_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "influencer_referrals" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "refereeRole" TEXT NOT NULL,
    "codeUsed" TEXT NOT NULL,
    "registrationIpAddress" TEXT,
    "qualified" BOOLEAN NOT NULL DEFAULT false,
    "qualifiedAt" TIMESTAMP(3),
    "incentiveAmount" DOUBLE PRECISION,
    "incentivePaid" BOOLEAN NOT NULL DEFAULT false,
    "incentivePaidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "influencer_referrals_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE TABLE IF NOT EXISTS "influencer_clicks" (
    "id" TEXT NOT NULL,
    "influencerId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrerUrl" TEXT,
    "landingPage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "influencer_clicks_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "influencers_referralCode_key" ON "influencers"("referralCode");`,
  `CREATE INDEX IF NOT EXISTS "influencers_referralCode_idx" ON "influencers"("referralCode");`,
  `CREATE INDEX IF NOT EXISTS "influencers_active_idx" ON "influencers"("active");`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "influencer_referrals_refereeId_key" ON "influencer_referrals"("refereeId");`,
  `CREATE INDEX IF NOT EXISTS "influencer_referrals_influencerId_idx" ON "influencer_referrals"("influencerId");`,
  `CREATE INDEX IF NOT EXISTS "influencer_referrals_refereeRole_idx" ON "influencer_referrals"("refereeRole");`,
  `CREATE INDEX IF NOT EXISTS "influencer_referrals_qualified_idx" ON "influencer_referrals"("qualified");`,
  `CREATE INDEX IF NOT EXISTS "influencer_referrals_incentivePaid_idx" ON "influencer_referrals"("incentivePaid");`,
  `CREATE INDEX IF NOT EXISTS "influencer_referrals_createdAt_idx" ON "influencer_referrals"("createdAt");`,

  `CREATE INDEX IF NOT EXISTS "influencer_clicks_influencerId_idx" ON "influencer_clicks"("influencerId");`,
  `CREATE INDEX IF NOT EXISTS "influencer_clicks_ipAddress_idx" ON "influencer_clicks"("ipAddress");`,
  `CREATE INDEX IF NOT EXISTS "influencer_clicks_createdAt_idx" ON "influencer_clicks"("createdAt");`,

  `ALTER TABLE "influencer_referrals" ADD CONSTRAINT "influencer_referrals_refereeId_fkey"
    FOREIGN KEY ("refereeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,

  `ALTER TABLE "influencer_referrals" ADD CONSTRAINT "influencer_referrals_influencerId_fkey"
    FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,

  `ALTER TABLE "influencer_clicks" ADD CONSTRAINT "influencer_clicks_influencerId_fkey"
    FOREIGN KEY ("influencerId") REFERENCES "influencers"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
];

async function runWithRetry<T>(label: string, fn: () => Promise<T>, attempts = 5, delayMs = 5000): Promise<T> {
  let lastError: any;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      const meta = e?.meta;
      const message = String(e?.message ?? e ?? '');
      const driverCode = meta?.driverAdapterError?.originalCode ?? meta?.code;
      const isTransient = driverCode === '57P03' || message.includes('the database system is starting up');
      if (!isTransient || i === attempts) {
        throw e;
      }
      console.warn(`[${label}] Transient DB error (${driverCode ?? message}), retry ${i}/${attempts}...`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

async function tableExists(tableName: string): Promise<boolean> {
  const rows = await runWithRetry(
    `tableExists(${tableName})`,
    () => prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = '${tableName}'
      ) AS "exists"
    `)
  );
  return rows[0]?.exists ?? false;
}

async function rowCount(tableName: string): Promise<number> {
  const rows = await runWithRetry(
    `rowCount(${tableName})`,
    () => prisma.$queryRawUnsafe<{ count: bigint }[]>(`
      SELECT COUNT(*)::bigint AS "count" FROM "${tableName}"
    `)
  );
  return Number(rows[0]?.count ?? BigInt(0));
}

async function main() {
  console.log("=== APPLY INFLUENCER PROGRAM MIGRATION ===");

  console.log("\n--- BEFORE SNAPSHOT ---");
  const beforeExists = {
    influencers: await tableExists("influencers"),
    influencer_referrals: await tableExists("influencer_referrals"),
    influencer_clicks: await tableExists("influencer_clicks"),
  };
  console.log("Table existence before:", JSON.stringify(beforeExists));

  if (beforeExists.influencers) {
    console.log(`influencers row count before: ${await rowCount("influencers")}`);
  }
  if (beforeExists.influencer_referrals) {
    console.log(`influencer_referrals row count before: ${await rowCount("influencer_referrals")}`);
  }
  if (beforeExists.influencer_clicks) {
    console.log(`influencer_clicks row count before: ${await rowCount("influencer_clicks")}`);
  }

  console.log("\n--- EXECUTING MIGRATION ---");
  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing:`);
    console.log(sql);
    try {
      const result = await runWithRetry(
        `statement-${i + 1}`,
        () => prisma.$executeRawUnsafe(sql)
      );
      console.log(`RESULT: ${result}`);
    } catch (e) {
      console.error(`ERROR on statement ${i + 1}:`, e);
      console.error("FAILING SQL:", sql);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  console.log("\n--- AFTER SNAPSHOT ---");
  const afterExists = {
    influencers: await tableExists("influencers"),
    influencer_referrals: await tableExists("influencer_referrals"),
    influencer_clicks: await tableExists("influencer_clicks"),
  };
  console.log("Table existence after:", JSON.stringify(afterExists));

  const influencersCount = await rowCount("influencers");
  const referralsCount = await rowCount("influencer_referrals");
  const clicksCount = await rowCount("influencer_clicks");

  console.log(`influencers row count after: ${influencersCount}`);
  console.log(`influencer_referrals row count after: ${referralsCount}`);
  console.log(`influencer_clicks row count after: ${clicksCount}`);

  if (!afterExists.influencers || !afterExists.influencer_referrals || !afterExists.influencer_clicks) {
    console.error("DATA LOSS DETECTED: one or more tables were not created.");
    await prisma.$disconnect();
    process.exit(1);
  }

  if (influencersCount !== 0 || referralsCount !== 0 || clicksCount !== 0) {
    console.error("DATA LOSS DETECTED: unexpected row counts after migration.");
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("\n=== MIGRATION COMPLETE: no data loss detected ===");
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
