-- Add SLA deadline tracking to orders and an audit table with a trigger.
--
-- The trigger auto-calculates slaDeadline when paymentConfirmedAt is set on
-- ONLINE orders only. Manual orders (source = 'MANUAL') never receive an
-- slaDeadline: the trigger skips them, and the application never writes one.
--
-- Formula (enforced by the trigger, not application code):
--   slaDeadline = paymentConfirmedAt
--                 + INTERVAL '1 day' * slaPolicyDispatchDays
--                 + INTERVAL '1 day' * slaPolicyDeliveryWindowDays
--
-- slaPolicyDispatchDays defaults to platform_policy.dispatchTargetDaysAfterPayment
-- (3). slaPolicyDeliveryWindowDays defaults to 3 (the delivery window used by
-- stampOrderItems for expectedArrivalDate). Both are snapshot columns: they
-- are copied from platform_policy at payment-confirmation time so a later
-- policy change does not retroactively alter existing deadlines.

-- AlterTable: add SLA columns to orders (all nullable; no existing column touched)
ALTER TABLE "orders" ADD COLUMN "slaDeadline" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "slaPolicyDispatchDays" INTEGER;
ALTER TABLE "orders" ADD COLUMN "slaPolicyDeliveryWindowDays" INTEGER;
ALTER TABLE "orders" ADD COLUMN "deliveryConfirmedSource" TEXT;
ALTER TABLE "orders" ADD COLUMN "slaExcusedReason" TEXT;

-- CreateTable: sla_deadline_audit
-- Records every change to slaDeadline (initial calculation, override, excuse).
-- The trigger writes the 'calculated' row; application code writes
-- 'override' and 'excused' rows when it explicitly changes the deadline.
CREATE TABLE "sla_deadline_audit" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "previousDeadline" TIMESTAMP(3),
    "newDeadline" TIMESTAMP(3),
    "dispatchDays" INTEGER,
    "deliveryWindowDays" INTEGER,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_deadline_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: lookup by order, newest first
CREATE INDEX "sla_deadline_audit_orderId_createdAt_idx" ON "sla_deadline_audit"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "sla_deadline_audit" ADD CONSTRAINT "sla_deadline_audit_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigger: auto-calculate slaDeadline when paymentConfirmedAt is set on ONLINE orders.
-- Runs AFTER each row update. If the row is ONLINE and paymentConfirmedAt was
-- just set (or changed) and slaDeadline is currently NULL, compute the deadline
-- from the snapshot policy columns and write an audit row.
CREATE OR REPLACE FUNCTION "calc_sla_deadline"() RETURNS TRIGGER AS $$
DECLARE
    v_source TEXT;
    v_dispatch INTEGER;
    v_window INTEGER;
    v_deadline TIMESTAMP(3);
    v_audit_id TEXT;
BEGIN
    -- Only ONLINE orders get an SLA deadline.
    v_source := COALESCE(NEW."source", OLD."source");
    IF v_source <> 'ONLINE' THEN
        RETURN NEW;
    END IF;

    -- Only act when paymentConfirmedAt is set and slaDeadline is NULL.
    IF NEW."paymentConfirmedAt" IS NULL OR NEW."slaDeadline" IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Snapshot the policy values that were in effect at payment time.
    -- Defaults match platform_policy defaults (dispatchTargetDaysAfterPayment = 3)
    -- and the delivery window constant (DELIVERY_WINDOW_DAYS = 3).
    v_dispatch := COALESCE(NEW."slaPolicyDispatchDays", 3);
    v_window := COALESCE(NEW."slaPolicyDeliveryWindowDays", 3);

    v_deadline := NEW."paymentConfirmedAt"
                  + (v_dispatch || ' days')::INTERVAL
                  + (v_window || ' days')::INTERVAL;

    NEW."slaDeadline" := v_deadline;

    -- Write an audit row (outside the trigger's own table, so no recursion).
    v_audit_id := 'sda_' || replace((gen_random_uuid())::text, '-'::text, ''::text);
    INSERT INTO "sla_deadline_audit" (
        "id", "orderId", "previousDeadline", "newDeadline",
        "dispatchDays", "deliveryWindowDays", "source", "reason", "createdAt"
    ) VALUES (
        v_audit_id, NEW."id", NULL, v_deadline,
        v_dispatch, v_window, 'calculated', NULL, CURRENT_TIMESTAMP
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_orders_sla_deadline" ON "orders";
CREATE TRIGGER "trg_orders_sla_deadline"
    BEFORE UPDATE ON "orders"
    FOR EACH ROW
    EXECUTE FUNCTION "calc_sla_deadline"();
