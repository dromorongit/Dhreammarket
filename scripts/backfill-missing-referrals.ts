import "dotenv/config";
import { getPrisma } from "@/lib/prisma";
import { randomUUID } from "crypto";

const prisma = getPrisma();

function generateReferralCode(): string {
  return `REF-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function main() {
  console.log("=== BACKFILL MISSING REFERRAL CREDITS ===\n");

  // --- BEFORE SNAPSHOT ---
  console.log("--- BEFORE SNAPSHOT ---");
  const pendingWithCodeBefore = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*)::int AS count FROM "pending_registrations" WHERE "referralCode" IS NOT NULL
  `;
  console.log(`Pending registrations with referralCode: ${pendingWithCodeBefore[0].count}`);

  const completedReferralsBefore = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*)::int AS count FROM "referral_records" WHERE status IN ('COMPLETED', 'REWARD_CLAIMED')
  `;
  console.log(`Completed/claimed ReferralRecords: ${completedReferralsBefore[0].count}`);

  // --- IDENTIFY AFFECTED PAIRS ---
  // Pending registrations: submitted a referralCode but not yet verified → not yet processed
  const pendingRegs = await prisma.$queryRaw<any[]>`
    SELECT id, email, "referralCode", "registrationIpAddress", "createdAt"
    FROM "pending_registrations"
    WHERE "referralCode" IS NOT NULL
    ORDER BY "createdAt" ASC
  `;

  const affected: Array<{
    pendingId: string;
    email: string;
    submittedCode: string;
    referrerId: string | null;
    referrerEmail: string | null;
    reason: string;
  }> = [];

  for (const pending of pendingRegs) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: pending.referralCode },
      select: { id: true, email: true },
    });
    if (!referrer) {
      affected.push({
        pendingId: pending.id,
        email: pending.email,
        submittedCode: pending.referralCode,
        referrerId: null,
        referrerEmail: null,
        reason: "CODE_NOT_FOUND_IN_USERS",
      });
      continue;
    }
    const existing = await prisma.referralRecord.findFirst({
      where: { referrerId: referrer.id, refereeId: null },
    });
    if (existing) {
      affected.push({
        pendingId: pending.id,
        email: pending.email,
        submittedCode: pending.referralCode,
        referrerId: referrer.id,
        referrerEmail: referrer.email,
        reason: "REFERRAL_RECORD_ALREADY_EXISTS",
      });
      continue;
    }
    affected.push({
      pendingId: pending.id,
      email: pending.email,
      submittedCode: pending.referralCode,
      referrerId: referrer.id,
      referrerEmail: referrer.email,
      reason: "NEEDS_REFERRAL_RECORD_CREATED",
    });
  }

  console.log(`\n--- Affected pending registrations: ${affected.length} ---`);
  for (const row of affected) {
    console.log(JSON.stringify(row));
  }

  const needsBackfill = affected.filter(a => a.reason === "NEEDS_REFERRAL_RECORD_CREATED");
  console.log(`\nPending registrations requiring backfill: ${needsBackfill.length}`);

  if (needsBackfill.length === 0) {
    console.log("\nNo backfill needed for pending registrations.");
  }

  // --- EXECUTE BACKFILL (IDEMPOTENT) ---
  console.log("\n--- EXECUTING BACKFILL ---");
  let backfilled = 0;
  let skipped = 0;

  for (const item of needsBackfill) {
    try {
      const newCode = generateReferralCode();
      const result = await prisma.$transaction(async (tx) => {
        const referral = await tx.referralRecord.create({
          data: {
            referrerId: item.referrerId!,
            refereeId: null,
            code: newCode,
            status: "PENDING",
          },
        });
        return referral;
      });
      console.log(`  BACKFILLED: pendingId=${item.pendingId}, email=${item.email}, referrerId=${item.referrerId}, newRecordCode=${result.code}`);
      backfilled++;
    } catch (err) {
      console.error(`  ERROR backfilling pendingId=${item.pendingId}:`, err);
      skipped++;
    }
  }

  console.log(`\nBackfill complete: ${backfilled} created, ${skipped} skipped due to errors`);

  // --- AFTER SNAPSHOT ---
  console.log("\n--- AFTER SNAPSHOT ---");
  const completedReferralsAfter = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*)::int AS count FROM "referral_records" WHERE status IN ('COMPLETED', 'REWARD_CLAIMED')
  `;
  console.log(`Completed/claimed ReferralRecords: ${completedReferralsAfter[0].count}`);

  const pendingWithCodeAfter = await prisma.$queryRaw<any[]>`
    SELECT COUNT(*)::int AS count FROM "pending_registrations" WHERE "referralCode" IS NOT NULL
  `;
  console.log(`Pending registrations with referralCode (unchanged): ${pendingWithCodeAfter[0].count}`);

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
