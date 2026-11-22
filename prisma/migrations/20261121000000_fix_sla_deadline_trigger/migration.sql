-- Fix SLA deadline trigger behaviour on orders.
--
-- Migration 20261120000000_add_sla_deadline already added the slaDeadline
-- columns, the sla_deadline_audit table, and the original calc_sla_deadline
-- trigger. This migration drops and recreates only the function and trigger
-- so the applied migration is not edited.
--
-- Contract enforced by the trigger:
--   (a) Only ONLINE orders are considered.
--   (b) Lock check FIRST: if slaDeadline is being changed and was already set,
--       the change requires app.admin_override='true', a non-empty app.user_id,
--       and a trimmed non-empty app.override_reason; the trigger writes the
--       'override' audit row (actor + reason) itself and returns.
--   (c) Only after the lock check, the NULL -> paid transition stamps
--       slaDeadline. Stamping is transition-only (OLD.paymentConfirmedAt IS
--       NULL); there is no LEGACY_CUTOFF in SQL because an order already paid
--       at INSERT time is not restamped, and orders already paid are never
--       stamped on later updates. Dispatch and delivery window days are read
--       from the NEW slaPolicy*Days columns when set, otherwise defaulting to
--       3, and written back onto NEW.

DROP TRIGGER IF EXISTS "trg_orders_sla_deadline" ON "orders";

CREATE OR REPLACE FUNCTION "calc_sla_deadline"() RETURNS TRIGGER AS $$
DECLARE
    v_source TEXT;
    v_override BOOLEAN;
    v_override_reason TEXT;
    v_actor TEXT;
    v_prev TIMESTAMP(3);
    v_audit_id TEXT;
    v_dispatch INTEGER;
    v_window INTEGER;
    v_deadline TIMESTAMP(3);
BEGIN
    -- (a) Only ONLINE orders get an SLA deadline.
    v_source := COALESCE(NEW."source", OLD."source");
    IF COALESCE(v_source, '') <> 'ONLINE' THEN
        RETURN NEW;
    END IF;

    -- (b) Lock check FIRST: a change to an already-set slaDeadline is locked
    --     unless an admin override is active with a non-empty actor and reason.
    IF NEW."slaDeadline" IS DISTINCT FROM OLD."slaDeadline"
       AND OLD."slaDeadline" IS NOT NULL THEN
        v_override := COALESCE(current_setting('app.admin_override', true), '') = 'true';
        IF NOT v_override THEN
            RAISE EXCEPTION
                'slaDeadline is locked after first set; set app.admin_override=true to change it';
        END IF;

        v_actor := COALESCE(current_setting('app.user_id', true), '');
        IF v_actor = '' THEN
            RAISE EXCEPTION
                'app.user_id is required to override slaDeadline';
        END IF;

        v_override_reason := trim(COALESCE(current_setting('app.override_reason', true), ''));
        IF v_override_reason = '' THEN
            RAISE EXCEPTION
                'app.override_reason is required to override slaDeadline';
        END IF;

        v_prev := OLD."slaDeadline";

        -- The trigger itself writes the override audit row (actor + reason).
        v_audit_id := 'sda_' || replace((gen_random_uuid())::text, '-'::text, ''::text);
        INSERT INTO "sla_deadline_audit" (
            "id", "orderId", "previousDeadline", "newDeadline",
            "dispatchDays", "deliveryWindowDays", "source", "reason", "metadata", "createdAt"
        ) VALUES (
            v_audit_id, NEW."id", v_prev, NEW."slaDeadline",
            COALESCE(NEW."slaPolicyDispatchDays", 3),
            COALESCE(NEW."slaPolicyDeliveryWindowDays", 3),
            'override', v_override_reason,
            jsonb_build_object('actor', v_actor),
            CURRENT_TIMESTAMP
        );
        RETURN NEW;
    END IF;

    -- (c) Only after the lock check: handle the NULL -> paid transition.
    IF NEW."paymentConfirmedAt" IS NULL THEN
        RETURN NEW;
    END IF;

    -- Transition-only: already-paid orders are never restamped.
    IF OLD."paymentConfirmedAt" IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Already stamped deadlines are never restamped (clear + re-set).
    IF OLD."slaDeadline" IS NOT NULL THEN
        RETURN NEW;
    END IF;

    -- Read dispatch and window days from NEW columns when set, otherwise
    -- default to 3, and write the values used back onto NEW.
    v_dispatch := COALESCE(NEW."slaPolicyDispatchDays", (SELECT "dispatchTargetDaysAfterPayment" FROM "platform_policy" LIMIT 1), 3);
    v_window := COALESCE(NEW."slaPolicyDeliveryWindowDays", 3);

    NEW."slaPolicyDispatchDays" := v_dispatch;
    NEW."slaPolicyDeliveryWindowDays" := v_window;

    v_deadline := NEW."paymentConfirmedAt"
                  + (v_dispatch || ' days')::INTERVAL
                  + (v_window || ' days')::INTERVAL;

    NEW."slaDeadline" := v_deadline;

    -- Write the 'calculated' audit row itself.
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

CREATE TRIGGER "trg_orders_sla_deadline"
    BEFORE UPDATE OF "paymentConfirmedAt", "slaDeadline" ON "orders"
    FOR EACH ROW
    EXECUTE FUNCTION "calc_sla_deadline"();
