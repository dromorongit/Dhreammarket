import { Pool } from 'pg'
require('dotenv').config({ path: '.env' })

// NOTE: At the time of this fix (2026-08-24) the five affected tables
// (reward_transactions, cashback_transactions, referral_records,
// reward_redemptions, vendor_reward_campaigns) were DORMANT/UNUSED — no app
// code referenced them and each table had 0 rows. Their columns were declared
// as Prisma enums in schema.prisma but the underlying Postgres enum TYPE was
// never created, so the columns remained plain `text`. This is the same root
// cause as the already-fixed support_messages.senderType drift. Because the
// tables are empty there is nothing to cast and no data-loss risk; we create
// the missing enum types and retype the columns in a single transaction.
async function fixRewardsEnumDrift() {
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
      await client.query('BEGIN')

      // Idempotent enum TYPE creation (matches schema.prisma exactly)
      const enumDefs: Array<{ name: string; values: string[] }> = [
        { name: 'TransactionType', values: ['EARN', 'REDEEM', 'ADJUST', 'EXPIRE', 'BONUS'] },
        {
          name: 'RewardCategory',
          values: [
            'PURCHASE', 'SERVICE_BOOKING', 'REVIEW', 'REVIEW_IMAGE', 'REVIEW_VIDEO',
            'DAILY_LOGIN', 'PROFILE_COMPLETE', 'FOLLOW_VENDOR', 'REFERRAL',
            'SUCCESSFUL_REFERRAL', 'WISHLIST_ACTIVITY', 'COLLECTION_CREATE',
            'REPEAT_PURCHASE', 'REPEAT_BOOKING', 'COUPON_REDEEM', 'CASHBACK_REDEEM', 'SPECIAL_OFFER',
          ],
        },
        {
          name: 'CashbackSource',
          values: [
            'PRODUCT_PURCHASE', 'SERVICE_BOOKING', 'VENDOR_CAMPAIGN',
            'PROMOTIONAL_CAMPAIGN', 'REFERRAL_BONUS', 'REWARD_REDEMPTION', 'ADJUSTMENT',
          ],
        },
        { name: 'ReferralStatus', values: ['PENDING', 'COMPLETED', 'REWARD_CLAIMED', 'EXPIRED', 'CANCELLED'] },
        { name: 'RedemptionType', values: ['POINTS', 'CASHBACK', 'COUPON', 'MIXED'] },
        { name: 'RedemptionStatus', values: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'] },
        { name: 'CampaignType', values: ['POINTS_MULTIPLIER', 'CASHBACK_BONUS', 'DISCOUNT', 'FIXED_REWARD', 'BUNDLE_OFFER'] },
        { name: 'RewardType', values: ['POINTS', 'CASHBACK', 'COUPON', 'DISCOUNT'] },
      ]

      for (const e of enumDefs) {
        const list = e.values.map((v) => `'${v}'`).join(', ')
        await client.query(
          `DO $$
           BEGIN
             IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${e.name}') THEN
               CREATE TYPE "${e.name}" AS ENUM (${list});
             END IF;
           END
           $$;`
        )
        console.log(`Enum type "${e.name}" ensured`)
      }

      // Convert each drifted column text -> enum (tables are empty, no cast risk)
      const alters: Array<{ table: string; column: string; enum: string }> = [
        { table: 'reward_transactions', column: 'type', enum: 'TransactionType' },
        { table: 'reward_transactions', column: 'category', enum: 'RewardCategory' },
        { table: 'cashback_transactions', column: 'source', enum: 'CashbackSource' },
        { table: 'referral_records', column: 'status', enum: 'ReferralStatus', default: 'PENDING' },
        { table: 'reward_redemptions', column: 'type', enum: 'RedemptionType' },
        { table: 'reward_redemptions', column: 'status', enum: 'RedemptionStatus', default: 'COMPLETED' },
        { table: 'vendor_reward_campaigns', column: 'type', enum: 'CampaignType' },
        { table: 'vendor_reward_campaigns', column: 'rewardType', enum: 'RewardType' },
      ]

      for (const a of alters) {
        // Some columns carry an enum default (e.g. status @default(PENDING)).
        // Postgres cannot auto-cast a text default to the enum type, so drop it
        // first (no-op if absent), convert, then re-add as the enum type.
        let stmt = `ALTER TABLE "${a.table}" ALTER COLUMN "${a.column}" DROP DEFAULT, `
        stmt += `ALTER COLUMN "${a.column}" TYPE "${a.enum}" USING "${a.column}"::"${a.enum}"`
        if (a.default) {
          stmt += `, ALTER COLUMN "${a.column}" SET DEFAULT '${a.default}'::"${a.enum}"`
        }
        stmt += `;`
        await client.query(stmt)
        console.log(`Converted ${a.table}.${a.column} -> ${a.enum}`)
      }

      await client.query('COMMIT')
      console.log('✓ Transaction committed. All 8 enum-type drifts resolved.')
    } catch (error) {
      await client.query('ROLLBACK')
      console.error('✗ Transaction rolled back due to error:', error)
      throw error
    } finally {
      await client.release()
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

fixRewardsEnumDrift()
