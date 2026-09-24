import "dotenv/config";
import { getPrisma } from "@/lib/prisma";

const prisma = getPrisma();

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

async function main() {
  console.log("=== ADD influencerCode TO pending_registrations ===");

  console.log("\n--- BEFORE SNAPSHOT ---");
  const beforeCount = await runWithRetry("pendingRegistration.count", () => prisma.pendingRegistration.count());
  console.log(`pending_registrations row count before: ${beforeCount}`);

  const sql = `
    ALTER TABLE "pending_registrations"
    ADD COLUMN IF NOT EXISTS "influencerCode" TEXT;
  `;

  console.log("\n--- EXECUTING MIGRATION ---");
  console.log(sql);
  try {
    const result = await runWithRetry("add-column", () => prisma.$executeRawUnsafe(sql));
    console.log("RESULT:", result);
  } catch (e) {
    console.error("ERROR:", e);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log("\n--- AFTER SNAPSHOT ---");
  const afterCount = await runWithRetry("pendingRegistration.count-after", () => prisma.pendingRegistration.count());
  console.log(`pending_registrations row count after: ${afterCount}`);

  if (afterCount !== beforeCount) {
    console.error("DATA LOSS DETECTED: row count changed during migration.");
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
