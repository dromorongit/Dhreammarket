import 'dotenv/config'
import { getPrisma } from '@/lib/prisma'

const prisma = getPrisma()

async function main() {
  console.log('=== PHASE 5: REFERRAL CREDITING DIAGNOSTIC ===\n')

  // 1. Pending registrations with a submitted referralCode (not yet verified → not yet processed)
  const pendingWithCode = await prisma.$queryRaw<any[]>`
    SELECT id, email, "referralCode", "registrationIpAddress", "createdAt"
    FROM "pending_registrations"
    WHERE "referralCode" IS NOT NULL
    ORDER BY "createdAt" ASC
  `
  console.log(`--- Pending registrations with referralCode: ${pendingWithCode.length} ---`)
  for (const row of pendingWithCode) {
    console.log(JSON.stringify({
      pendingId: row.id,
      email: row.email,
      submittedCode: row.referralCode,
      ip: row.registrationIpAddress,
      createdAt: row.createdAt,
    }))
  }

  // 2. For each pending registration, resolve the referrer User by referralCode and check ReferralRecord
  console.log('\n--- Pending registration × ReferralRecord cross-check ---')
  for (const pending of pendingWithCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: pending.referralCode },
      select: { id: true, email: true, role: true },
    })
    if (!referrer) {
      console.log(JSON.stringify({
        pendingId: pending.id,
        submittedCode: pending.referralCode,
        status: 'CODE_NOT_FOUND_IN_USERS',
      }))
      continue
    }
    const existing = await prisma.referralRecord.findFirst({
      where: { referrerId: referrer.id, refereeId: null },
    })
    console.log(JSON.stringify({
      pendingId: pending.id,
      submittedCode: pending.referralCode,
      referrerId: referrer.id,
      referrerEmail: referrer.email,
      existingReferralRecord: existing ? { id: existing.id, status: existing.status } : null,
    }))
  }

  // 3. Completed ReferralRecord summary
  const statusCounts = await prisma.$queryRaw<any[]>`
    SELECT status, COUNT(*)::int AS count
    FROM "referral_records"
    GROUP BY status
    ORDER BY status
  `
  console.log('\n--- ReferralRecord status distribution ---')
  for (const row of statusCounts) {
    console.log(JSON.stringify({ status: row.status, count: row.count }))
  }

  // 4. Customers without any ReferralRecord as referee (may have registered without code, or during bug period)
  const customersWithoutReferralRecord = await prisma.$queryRaw<any[]>`
    SELECT u.id, u.email, u."createdAt", u."referralCode"
    FROM "users" u
    LEFT JOIN "referral_records" rr ON rr."refereeId" = u.id
    WHERE u.role = 'CUSTOMER'
      AND rr.id IS NULL
    ORDER BY u."createdAt" ASC
  `
  console.log(`\n--- Customers with NO ReferralRecord as referee: ${customersWithoutReferralRecord.length} ---`)
  for (const row of customersWithoutReferralRecord) {
    console.log(JSON.stringify({
      userId: row.id,
      email: row.email,
      createdAt: row.createdAt,
      theirReferralCode: row.referralCode,
    }))
  }

  // 5. Completed referrals with details
  const completedReferrals = await prisma.$queryRaw<any[]>`
    SELECT rr.id, rr."referrerId", rr."refereeId", rr.code, rr.status, rr."completedAt", rr."rewardPoints", rr."rewardCashback",
           ru.email AS referrerEmail, ru."referralCode" AS referrerCode,
           cu.email AS refereeEmail
    FROM "referral_records" rr
    JOIN "users" ru ON ru.id = rr."referrerId"
    LEFT JOIN "users" cu ON cu.id = rr."refereeId"
    WHERE rr.status IN ('COMPLETED', 'REWARD_CLAIMED')
    ORDER BY rr."completedAt" ASC
  `
  console.log(`\n--- Completed/claimed referrals: ${completedReferrals.length} ---`)
  for (const row of completedReferrals) {
    console.log(JSON.stringify({
      referralId: row.id,
      referrerId: row.referrerId,
      referrerEmail: row.referrerEmail,
      referrerCode: row.referrerCode,
      refereeId: row.refereeId,
      refereeEmail: row.refereeEmail,
      recordCode: row.code,
      status: row.status,
      completedAt: row.completedAt,
      rewardPoints: row.rewardPoints,
      rewardCashback: row.rewardCashback,
    }))
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('FATAL:', e)
  process.exit(1)
})
