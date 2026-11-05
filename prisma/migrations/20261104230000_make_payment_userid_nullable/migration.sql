-- Make Payment.userId nullable (manual orders have no user) and add
-- authorizationUrl to store the pay-link authorization URL per payment.

-- AlterTable: make userId nullable on payments.
ALTER TABLE "payments" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable: add nullable authorizationUrl column to payments.
ALTER TABLE "payments" ADD COLUMN "authorizationUrl" TEXT;
