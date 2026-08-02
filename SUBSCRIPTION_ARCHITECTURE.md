# Vendor Subscription & Monetization Platform - Architecture Documentation

## Overview

The Vendor Subscription & Monetization Platform is an enterprise-grade system that enables recurring revenue through subscription plans while integrating seamlessly with the existing Dhream Market platform.

## Architecture

### Database Models

The following models were added to the Prisma schema:

1. **SubscriptionPlan** - Defines subscription tiers (Free, Starter, Business, Professional, Enterprise) with pricing, limits, and benefits
2. **VendorSubscription** - Tracks each vendor's active subscription, status, billing cycle, and payment history
3. **SubscriptionInvoice** - Generates and tracks invoices for subscription payments
4. **SubscriptionPayment** - Records individual payments against invoices
5. **SubscriptionUsage** - Tracks vendor usage of plan limits (products, services)
6. **SubscriptionFeature** - Per-plan feature permissions and usage tracking
7. **SubscriptionHistory** - Audit trail of all subscription state changes

### Service Layer

Located in `lib/subscription/`:

- **types.ts** - Plan definitions, benefit mappings, feature restriction mappings, and type interfaces
- **subscription-service.ts** - Core CRUD operations for subscriptions, plans, invoices, and payments
- **billing-service.ts** - Paystack payment integration, manual payment processing, invoice generation
- **feature-restriction.ts** - Automatic enforcement of plan-based feature restrictions
- **ai-integration.ts** - AI-powered plan upgrade recommendations, vendor growth prediction, feature suggestions
- **homepage-integration.ts** - Subscription-based vendor filtering for homepage merchandising
- **notification-integration.ts** - Subscription lifecycle notifications

### API Routes

- `app/api/subscription/vendor/route.ts` - Vendor subscription management (GET, POST, PUT, DELETE)
- `app/api/subscription/admin/route.ts` - Super admin plan management and analytics
- `app/api/subscription/billing/route.ts` - Payment processing and invoice generation
- `app/api/dashboard/vendor/subscription/route.ts` - Vendor subscription dashboard data
- `app/api/dashboard/super-admin/subscription/route.ts` - Super admin subscription analytics

### Dashboard Pages

- `app/dashboard/vendor/subscription/page.tsx` - Vendor subscription dashboard
- `app/dashboard/vendor/subscription/page.client.tsx` - Interactive subscription management UI
- `app/dashboard/vendor/subscription/validation.tsx` - Server-side auth validation
- `app/dashboard/super-admin/subscription/page.tsx` - Super admin subscription management
- `app/dashboard/super-admin/subscription/page.client.tsx` - Interactive admin UI
- `app/dashboard/super-admin/subscription/validation.tsx` - Server-side auth validation

## Feature Restrictions

The system automatically enforces plan-based restrictions:

| Feature | Free | Starter | Business | Professional | Enterprise |
|---------|------|---------|----------|-------------|------------|
| Product Limits | 20 | 100 | Unlimited | Unlimited | Unlimited |
| Service Limits | 10 | 40 | Unlimited | Unlimited | Unlimited |
| Homepage Promotions | No | No | Yes | Yes | Yes |
| Sponsored Products | No | No | No | Yes | Yes |
| Sponsored Services | No | No | No | Yes | Yes |
| Premium Analytics | No | No | Yes | Yes | Yes |
| Advanced AI | No | Yes | Yes | Yes | Yes |
| Cashback Campaigns | No | No | Yes | Yes | Yes |
| Reward Campaigns | No | No | Yes | Yes | Yes |
| Vendor Advertisements | No | No | No | Yes | Yes |

## Subscription Lifecycle

1. **Trial** - New vendors get a trial period
2. **Active** - Subscription is active and all features are available
3. **Past Due** - Payment is overdue
4. **Suspended** - Subscription is suspended due to non-payment
5. **Cancelled** - Vendor cancelled the subscription
6. **Expired** - Subscription period has ended

## Payment Integration

- **Paystack** - Primary payment processor for subscription payments
- **Manual Payment** - Super admin can process manual payments
- **Automatic Renewal** - Configurable auto-renewal with Paystack
- **Invoice Generation** - Automatic invoice generation for each billing cycle

## Analytics

The system provides the following analytics:
- Monthly Recurring Revenue (MRR)
- Annual Recurring Revenue (ARR)
- Total Revenue
- Active Subscriptions Count
- Plan Distribution
- Top Paying Vendors
- Churn Rate
- Renewal Rate
- Upcoming Renewals
- Expired Subscriptions

## AI Integration

The AI module provides:
- Plan upgrade recommendations based on vendor usage and revenue
- Vendor growth prediction
- Premium feature recommendations
- Vendor subscription insights

## Homepage Integration

Subscription-based vendor filtering for:
- Featured Vendors (Business, Professional, Enterprise)
- Sponsored Vendors (Professional, Enterprise)
- Homepage Promotion Credits (Business, Professional, Enterprise)
- Priority Merchandising (Professional, Enterprise)

## Notification System

Subscription lifecycle notifications:
- Subscription Activated
- Subscription Expiring (7 days before renewal)
- Subscription Renewed
- Subscription Cancelled
- Invoice Generated
- Payment Successful
- Payment Failed

## Security

- All API routes require authentication via JWT tokens
- Role-based access control (VENDOR, SUPER_ADMIN)
- Subscription restrictions are enforced server-side
- Feature access checks are performed on every request