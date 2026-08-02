-- Add new NotificationType enum values for subscription events
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_ACTIVATED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_EXPIRING';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_RENEWED';
ALTER TYPE "NotificationType" ADD VALUE 'SUBSCRIPTION_CANCELLED';
ALTER TYPE "NotificationType" ADD VALUE 'INVOICE_GENERATED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_FAILED';

-- Create SubscriptionPlan table
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL UNIQUE,
    "price_monthly" DOUBLE PRECISION,
    "price_yearly" DOUBLE PRECISION,
    "products_limit" INTEGER NOT NULL DEFAULT 20,
    "services_limit" INTEGER NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "benefits" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "subscription_plans_name_unique" ON "subscription_plans"("name");
CREATE INDEX "subscription_plans_is_active_idx" ON "subscription_plans"("is_active");
CREATE INDEX "subscription_plans_display_order_idx" ON "subscription_plans"("display_order");

-- Create VendorSubscription table
CREATE TABLE "vendor_subscriptions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vendor_id" TEXT NOT NULL UNIQUE,
    "plan_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TRIAL',
    "billing_cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "next_renewal_at" TIMESTAMP(3) NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "paystack_customer_id" TEXT,
    "paystack_subscription_id" TEXT,
    "total_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "vendor_subscriptions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "users"("id") ON DELETE CASCADE,
    CONSTRAINT "vendor_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT
);

CREATE INDEX "vendor_subscriptions_plan_id_idx" ON "vendor_subscriptions"("plan_id");
CREATE INDEX "vendor_subscriptions_status_idx" ON "vendor_subscriptions"("status");
CREATE INDEX "vendor_subscriptions_current_period_end_idx" ON "vendor_subscriptions"("current_period_end");
CREATE INDEX "vendor_subscriptions_next_renewal_at_idx" ON "vendor_subscriptions"("next_renewal_at");

-- Create SubscriptionInvoice table
CREATE TABLE "subscription_invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscription_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL UNIQUE,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paystack_invoice_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "vendor_subscriptions"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "subscription_invoices_invoice_number_unique" ON "subscription_invoices"("invoice_number");
CREATE INDEX "subscription_invoices_status_idx" ON "subscription_invoices"("status");
CREATE INDEX "subscription_invoices_subscription_id_idx" ON "subscription_invoices"("subscription_id");

-- Create SubscriptionPayment table
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoice_id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "paystack_ref" TEXT,
    "paystack_payment_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payment_method" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "subscription_invoices"("id") ON DELETE CASCADE,
    CONSTRAINT "subscription_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "vendor_subscriptions"("id") ON DELETE CASCADE
);

CREATE INDEX "subscription_payments_paystack_ref_idx" ON "subscription_payments"("paystack_ref");
CREATE INDEX "subscription_payments_status_idx" ON "subscription_payments"("status");
CREATE INDEX "subscription_payments_subscription_id_idx" ON "subscription_payments"("subscription_id");

-- Create SubscriptionUsage table
CREATE TABLE "subscription_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscription_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "current_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limit" DOUBLE PRECISION,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_usage_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "vendor_subscriptions"("id") ON DELETE CASCADE
);

CREATE INDEX "subscription_usage_subscription_id_idx" ON "subscription_usage"("subscription_id");
CREATE INDEX "subscription_usage_metric_idx" ON "subscription_usage"("metric");

-- Create SubscriptionFeature table
CREATE TABLE "subscription_features" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "plan_id" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "limit" INTEGER,
    "current_usage" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscription_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "subscription_features_plan_id_feature_key_unique" ON "subscription_features"("plan_id", "feature_key");
CREATE INDEX "subscription_features_plan_id_idx" ON "subscription_features"("plan_id");
CREATE INDEX "subscription_features_feature_key_idx" ON "subscription_features"("feature_key");

-- Create SubscriptionHistory table
CREATE TABLE "subscription_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscription_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "from_plan_id" TEXT,
    "to_plan_id" TEXT,
    "amount" DOUBLE PRECISION,
    "billing_cycle" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_history_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "vendor_subscriptions"("id") ON DELETE CASCADE
);

CREATE INDEX "subscription_history_subscription_id_idx" ON "subscription_history"("subscription_id");
CREATE INDEX "subscription_history_action_idx" ON "subscription_history"("action");
CREATE INDEX "subscription_history_created_at_idx" ON "subscription_history"("created_at");