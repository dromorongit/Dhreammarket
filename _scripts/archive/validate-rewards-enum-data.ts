import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

// 8 enums declared in schema.prisma for the drifted rewards/loyalty columns
const ENUM_VALUES: Record<string, string[]> = {
  TransactionType: ['EARN', 'REDEEM', 'ADJUST', 'EXPIRE', 'BONUS'],
  RewardCategory: [
    'PURCHASE', 'SERVICE_BOOKING', 'REVIEW', 'REVIEW_IMAGE', 'REVIEW_VIDEO',
    'DAILY_LOGIN', 'PROFILE_COMPLETE', 'FOLLOW_VENDOR', 'REFERRAL',
    'SUCCESSFUL_REFERRAL', 'WISHLIST_ACTIVITY', 'COLLECTION_CREATE',
    'REPEAT_PURCHASE', 'REPEAT_BOOKING', 'COUPON_REDEEM', 'CASHBACK_REDEEM', 'SPECIAL_OFFER',
  ],
  CashbackSource: [
    'PRODUCT_PURCHASE', 'SERVICE_BOOKING', 'VENDOR_CAMPAIGN',
    'PROMOTIONAL_CAMPAIGN', 'REFERRAL_BONUS', 'REWARD_REDEMPTION', 'ADJUSTMENT',
  ],
  ReferralStatus: ['PENDING', 'COMPLETED', 'REWARD_CLAIMED', 'EXPIRED', 'CANCELLED'],
  RedemptionType: ['POINTS', 'CASHBACK', 'COUPON', 'MIXED'],
  RedemptionStatus: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  CampaignType: ['POINTS_MULTIPLIER', 'CASHBACK_BONUS', 'DISCOUNT', 'FIXED_REWARD', 'BUNDLE_OFFER'],
  RewardType: ['POINTS', 'CASHBACK', 'COUPON', 'DISCOUNT'],
}

// table, column, enum
const TARGETS: Array<{ table: string; column: string; enum: keyof typeof ENUM_VALUES }> = [
  { table: 'reward_transactions', column: 'type', enum: 'TransactionType' },
  { table: 'reward_transactions', column: 'category', enum: 'RewardCategory' },
  { table: 'cashback_transactions', column: 'source', enum: 'CashbackSource' },
  { table: 'referral_records', column: 'status', enum: 'ReferralStatus' },
  { table: 'reward_redemptions', column: 'type', enum: 'RedemptionType' },
  { table: 'reward_redemptions', column: 'status', enum: 'RedemptionStatus' },
  { table: 'vendor_reward_campaigns', column: 'type', enum: 'CampaignType' },
  { table: 'vendor_reward_campaigns', column: 'rewardType', enum: 'RewardType' },
]

async function validateEnumData() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set in .env')
    process.exit(1)
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  })

  try {
    const client = await pool.connect()
    try {
      let totalMismatches = 0
      for (const t of TARGETS) {
        const allowed = new Set(ENUM_VALUES[t.enum])
        console.log(`\n=== ${t.table}.${t.column} (enum ${t.enum}) ===`)
        console.log(`Allowed values: ${[...allowed].join(', ')}`)

        const totalRes = await client.query(`SELECT COUNT(*) AS count FROM "${t.table}"`)
        const total = parseInt(totalRes.rows[0].count, 10)
        console.log(`Total rows in ${t.table}: ${total}`)

        const distinctRes = await client.query(
          `SELECT "${t.column}" AS val, COUNT(*) AS count FROM "${t.table}" GROUP BY "${t.column}" ORDER BY count DESC`
        )

        const mismatches: Array<{ val: string | null; count: number }> = []
        if (distinctRes.rows.length === 0) {
          console.log('  (no rows / column is entirely NULL)')
        }
        for (const r of distinctRes.rows) {
          const val = r.val
          const count = parseInt(r.count, 10)
          if (val === null) {
            console.log(`  NULL                          ${count} rows`)
            continue
          }
          if (!allowed.has(val)) {
            mismatches.push({ val, count })
            totalMismatches++
            console.log(`  ⚠ MISMATCH: "${val}"         ${count} rows  (NOT in ${t.enum})`)
          } else {
            console.log(`  ok: "${val}"                  ${count} rows`)
          }
        }

        if (mismatches.length === 0) {
          console.log(`  ✓ CLEAN — all values map to ${t.enum}`)
        }
      }

      console.log('\n=== SUMMARY ===')
      console.log(`Columns with data mismatches: ${totalMismatches > 0 ? totalMismatches : 'NONE'}`)
      if (totalMismatches === 0) {
        console.log('✅ All 8 columns are clean. Safe to proceed to Phase 2 fix scripts (per-table).')
      } else {
        console.log('⛔ Mismatches found — PAUSE. Do not force-cast; data-cleanup decision required first.')
      }
    } finally {
      await client.release()
    }
  } catch (error) {
    console.error('Error running validation:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

validateEnumData()
