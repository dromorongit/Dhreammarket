import "dotenv/config";
import { getPrisma } from "@/lib/prisma";

const prisma = getPrisma();

const statements = [
  `CREATE TABLE IF NOT EXISTS "vendor_posts" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "vendorId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendor_posts_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE INDEX IF NOT EXISTS "vendor_posts_vendorId_idx" ON "vendor_posts"("vendorId");`,
  `CREATE INDEX IF NOT EXISTS "vendor_posts_storeId_idx" ON "vendor_posts"("storeId");`,
  `CREATE INDEX IF NOT EXISTS "vendor_posts_createdAt_idx" ON "vendor_posts"("createdAt");`,

  `CREATE TABLE IF NOT EXISTS "vendor_post_likes" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vendor_post_likes_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE UNIQUE INDEX IF NOT EXISTS "vendor_post_likes_postId_userId_key" ON "vendor_post_likes"("postId", "userId");`,
  `CREATE INDEX IF NOT EXISTS "vendor_post_likes_postId_idx" ON "vendor_post_likes"("postId");`,
  `CREATE INDEX IF NOT EXISTS "vendor_post_likes_userId_idx" ON "vendor_post_likes"("userId");`,

  `CREATE TABLE IF NOT EXISTS "vendor_post_comments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendor_post_comments_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE INDEX IF NOT EXISTS "vendor_post_comments_postId_idx" ON "vendor_post_comments"("postId");`,
  `CREATE INDEX IF NOT EXISTS "vendor_post_comments_userId_idx" ON "vendor_post_comments"("userId");`,

  `CREATE TABLE IF NOT EXISTS "vendor_post_reports" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "comment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vendor_post_reports_pkey" PRIMARY KEY ("id")
  );`,

  `CREATE INDEX IF NOT EXISTS "vendor_post_reports_postId_idx" ON "vendor_post_reports"("postId");`,
  `CREATE INDEX IF NOT EXISTS "vendor_post_reports_userId_idx" ON "vendor_post_reports"("userId");`,
];

const constraintStatements = [
  {
    sql: `ALTER TABLE "vendor_posts" ADD CONSTRAINT "vendor_posts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    constraintName: "vendor_posts_vendorId_fkey",
    tableName: "vendor_posts",
  },
  {
    sql: `ALTER TABLE "vendor_posts" ADD CONSTRAINT "vendor_posts_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    constraintName: "vendor_posts_storeId_fkey",
    tableName: "vendor_posts",
  },
  {
    sql: `ALTER TABLE "vendor_post_likes" ADD CONSTRAINT "vendor_post_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vendor_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    constraintName: "vendor_post_likes_postId_fkey",
    tableName: "vendor_post_likes",
  },
  {
    sql: `ALTER TABLE "vendor_post_likes" ADD CONSTRAINT "vendor_post_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    constraintName: "vendor_post_likes_userId_fkey",
    tableName: "vendor_post_likes",
  },
  {
    sql: `ALTER TABLE "vendor_post_comments" ADD CONSTRAINT "vendor_post_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vendor_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    constraintName: "vendor_post_comments_postId_fkey",
    tableName: "vendor_post_comments",
  },
  {
    sql: `ALTER TABLE "vendor_post_comments" ADD CONSTRAINT "vendor_post_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    constraintName: "vendor_post_comments_userId_fkey",
    tableName: "vendor_post_comments",
  },
  {
    sql: `ALTER TABLE "vendor_post_reports" ADD CONSTRAINT "vendor_post_reports_postId_fkey" FOREIGN KEY ("postId") REFERENCES "vendor_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    constraintName: "vendor_post_reports_postId_fkey",
    tableName: "vendor_post_reports",
  },
  {
    sql: `ALTER TABLE "vendor_post_reports" ADD CONSTRAINT "vendor_post_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
    constraintName: "vendor_post_reports_userId_fkey",
    tableName: "vendor_post_reports",
  },
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
    () =>
      prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = '${tableName}'
        ) AS "exists"
      `)
  );
  return rows[0]?.exists ?? false;
}

async function constraintExists(constraintName: string, tableName: string): Promise<boolean> {
  const rows = await runWithRetry(
    `constraintExists(${constraintName})`,
    () =>
      prisma.$queryRawUnsafe<{ exists: boolean }[]>(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = '${tableName}'
            AND constraint_name = '${constraintName}'
        ) AS "exists"
      `)
  );
  return rows[0]?.exists ?? false;
}

async function rowCount(tableName: string): Promise<number> {
  const rows = await runWithRetry(
    `rowCount(${tableName})`,
    () =>
      prisma.$queryRawUnsafe<{ count: bigint }[]>(`
        SELECT COUNT(*)::bigint AS "count" FROM "${tableName}"
      `)
  );
  return Number(rows[0]?.count ?? BigInt(0));
}

async function main() {
  console.log("=== APPLY VENDOR FEED MIGRATION ===");

  console.log("\n--- BEFORE SNAPSHOT ---");
  const beforeExists = {
    vendor_posts: await tableExists("vendor_posts"),
    vendor_post_likes: await tableExists("vendor_post_likes"),
    vendor_post_comments: await tableExists("vendor_post_comments"),
    vendor_post_reports: await tableExists("vendor_post_reports"),
  };
  console.log("Table existence before:", JSON.stringify(beforeExists));

  const usersCountBefore = await rowCount("users");
  const storesCountBefore = await rowCount("stores");
  console.log(`users row count before: ${usersCountBefore}`);
  console.log(`stores row count before: ${storesCountBefore}`);

  if (beforeExists.vendor_posts || beforeExists.vendor_post_likes || beforeExists.vendor_post_comments || beforeExists.vendor_post_reports) {
    console.warn("WARNING: One or more vendor feed tables already exist. Migration may be partially applied.");
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

  console.log("\n--- EXECUTING FOREIGN KEY CONSTRAINTS ---");
  for (let i = 0; i < constraintStatements.length; i++) {
    const { sql, constraintName, tableName } = constraintStatements[i];
    const exists = await constraintExists(constraintName, tableName);
    if (exists) {
      console.log(`\n[FK ${i + 1}/${constraintStatements.length}] Constraint "${constraintName}" already exists on "${tableName}" — skipping.`);
      continue;
    }
    console.log(`\n[FK ${i + 1}/${constraintStatements.length}] Executing:`);
    console.log(sql);
    try {
      const result = await runWithRetry(
        `fk-${i + 1}`,
        () => prisma.$executeRawUnsafe(sql)
      );
      console.log(`RESULT: ${result}`);
    } catch (e) {
      console.error(`ERROR on FK statement ${i + 1}:`, e);
      console.error("FAILING SQL:", sql);
      await prisma.$disconnect();
      process.exit(1);
    }
  }

  console.log("\n--- AFTER SNAPSHOT ---");
  const afterExists = {
    vendor_posts: await tableExists("vendor_posts"),
    vendor_post_likes: await tableExists("vendor_post_likes"),
    vendor_post_comments: await tableExists("vendor_post_comments"),
    vendor_post_reports: await tableExists("vendor_post_reports"),
  };
  console.log("Table existence after:", JSON.stringify(afterExists));

  const usersCountAfter = await rowCount("users");
  const storesCountAfter = await rowCount("stores");
  console.log(`users row count after: ${usersCountAfter}`);
  console.log(`stores row count after: ${storesCountAfter}`);

  if (!afterExists.vendor_posts || !afterExists.vendor_post_likes || !afterExists.vendor_post_comments || !afterExists.vendor_post_reports) {
    console.error("DATA LOSS DETECTED: one or more tables were not created.");
    await prisma.$disconnect();
    process.exit(1);
  }

  if (usersCountAfter !== usersCountBefore || storesCountAfter !== storesCountBefore) {
    console.error("DATA LOSS DETECTED: users or stores row counts changed after migration.");
    console.error(`  users: ${usersCountBefore} -> ${usersCountAfter}`);
    console.error(`  stores: ${storesCountBefore} -> ${storesCountAfter}`);
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
