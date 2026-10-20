-- Corrective ledger: the new adjustment kind for a vendor refund clawback.
--
-- The enum value is added on its own, in its own migration, because a new
-- enum value cannot be used inside the transaction that adds it. The column
-- migration that follows can therefore safely write rows that carry
-- 'REFUND_CLAWBACK'.
--
-- Additive only. No row is read, written or rewritten by this statement.

-- AlterEnum
ALTER TYPE "AdjustmentType" ADD VALUE IF NOT EXISTS 'REFUND_CLAWBACK';
