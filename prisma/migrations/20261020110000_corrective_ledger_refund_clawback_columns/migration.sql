-- Corrective ledger: an OPEN vendor debit.
--
-- A refund clawback is recorded as an unapplied (open) ledger entry: it
-- carries forward and will be deducted from the vendor's NEXT payout.
-- Deduction from payouts is not implemented yet, so 'appliedPayoutId' and
-- 'appliedAt' must be nullable - a row that is still open has no payout and
-- has not been applied at any moment in time.
--
-- Additive or relaxing statements only:
--   - ALTER COLUMN ... DROP NOT NULL (relaxing) on the two "applied" columns
--   - ADD COLUMN (additive) for the idempotency key and the currency
--   - CREATE UNIQUE INDEX / CREATE INDEX (additive)
-- There is no DROP, no data rewrite and no table rewrite.
--
-- The unique index tolerates NULL keys (PostgreSQL treats NULLs as distinct
-- in a unique index), so the rows that already exist - none of which has an
-- idempotency key - are left exactly as they are.

-- AlterTable: relax the two "applied" columns so an entry can stay OPEN.
ALTER TABLE "vendor_balance_adjustments" ALTER COLUMN "appliedPayoutId" DROP NOT NULL;
ALTER TABLE "vendor_balance_adjustments" ALTER COLUMN "appliedAt" DROP NOT NULL;

-- AlterTable: the idempotency guard and the currency.
ALTER TABLE "vendor_balance_adjustments" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "vendor_balance_adjustments" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GHS';

-- CreateIndex: at most one ledger entry per refund.
CREATE UNIQUE INDEX "vendor_balance_adjustments_idempotencyKey_key" ON "vendor_balance_adjustments"("idempotencyKey");

-- CreateIndex: "open debits for a store" lookups.
CREATE INDEX "vendor_balance_adjustments_storeId_appliedPayoutId_idx" ON "vendor_balance_adjustments"("storeId", "appliedPayoutId");
