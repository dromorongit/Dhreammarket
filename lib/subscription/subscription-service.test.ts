import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getVendorSubscription, ensureFreeSubscription, upgradeSubscription } from '@/lib/subscription/subscription-service'
import { canVendorCreateCampaign } from '@/lib/advertising/subscription-integration'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'

const mockGetPrisma = vi.mocked(getPrisma)

function buildMockPrisma() {
  const subscriptions: any[] = []
  const subscriptionPlans: any[] = []
  const subscriptionHistories: any[] = []
  const users: any[] = []

  const mockPrisma = {
    vendorSubscription: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.vendorId) {
          return subscriptions.find((s) => s.vendorId === where.vendorId) || null
        }
        if (where.id) {
          return subscriptions.find((s) => s.id === where.id) || null
        }
        return null
      }),
      create: vi.fn(async ({ data, include }: any) => {
        const created = {
          id: `sub-${subscriptions.length + 1}`,
          ...data,
          plan: subscriptionPlans.find((p) => p.id === data.planId) || null,
        }
        subscriptions.push(created)
        return created
      }),
      update: vi.fn(async ({ where, data, include }: any) => {
        const idx = subscriptions.findIndex((s) => s.id === where.id)
        if (idx >= 0) {
          subscriptions[idx] = { ...subscriptions[idx], ...data }
          return subscriptions[idx]
        }
        return null
      }),
    },
    subscriptionPlan: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where.name) return subscriptionPlans.find((p) => p.name === where.name) || null
        if (where.id) return subscriptionPlans.find((p) => p.id === where.id) || null
        return null
      }),
    },
    subscriptionHistory: {
      create: vi.fn(async ({ data }: any) => {
        const created = { id: `sh-${subscriptionHistories.length + 1}`, ...data }
        subscriptionHistories.push(created)
        return created
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.find((u) => u.id === where.id) || null),
    },
    $transaction: vi.fn(async (fn: any) => fn(mockPrisma)),
  }

  return {
    mockPrisma,
    subscriptions,
    subscriptionPlans,
    subscriptionHistories,
    users,
  }
}

describe('Subscription service', () => {
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockPrisma()
    mockGetPrisma.mockReturnValue(ctx.mockPrisma as any)
  })

  describe('ensureFreeSubscription', () => {
    it('creates a Free baseline subscription when vendor has no subscription', async () => {
      ctx.subscriptionPlans.push({ id: 'plan-free', name: 'Free', priceMonthly: 0, productsLimit: 20, servicesLimit: 10 })
      ctx.users.push({ id: 'vendor-1' })

      const subscription = await ensureFreeSubscription('vendor-1')

      expect(subscription).toBeDefined()
      expect(subscription.vendorId).toBe('vendor-1')
      expect(subscription.plan?.name).toBe('Free')
      expect(ctx.subscriptionHistories).toHaveLength(1)
    })

    it('returns existing subscription when one already exists', async () => {
      ctx.subscriptionPlans.push({ id: 'plan-free', name: 'Free', priceMonthly: 0, productsLimit: 20, servicesLimit: 10 })
      ctx.subscriptions.push({
        id: 'sub-1',
        vendorId: 'vendor-1',
        planId: 'plan-free',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(),
        nextRenewalAt: new Date(),
        plan: { name: 'Free' },
      })

      const subscription = await ensureFreeSubscription('vendor-1')

      expect(subscription.id).toBe('sub-1')
      expect(ctx.subscriptionHistories).toHaveLength(0)
    })
  })

  describe('upgradeSubscription', () => {
    it('clears source and planExpiresAt when upgrading from INFLUENCER source', async () => {
      const now = new Date()
      ctx.subscriptionPlans.push(
        { id: 'plan-starter', name: 'Starter', priceMonthly: 79, productsLimit: 100, servicesLimit: 40 },
        { id: 'plan-business', name: 'Business', priceMonthly: 199, productsLimit: -1, servicesLimit: -1 }
      )
      ctx.subscriptions.push({
        id: 'sub-1',
        vendorId: 'vendor-1',
        planId: 'plan-starter',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: now,
        nextRenewalAt: now,
        source: 'INFLUENCER',
        planExpiresAt: now,
        influencerCode: 'INF-CODE',
        plan: { name: 'Starter' },
      })

      await upgradeSubscription('vendor-1', 'Business')

      const updated = ctx.subscriptions.find((s) => s.id === 'sub-1')
      expect(updated.planId).toBe('plan-business')
      expect(updated.source).toBeNull()
      expect(updated.planExpiresAt).toBeNull()
      expect(ctx.subscriptionHistories).toHaveLength(1)
      expect(ctx.subscriptionHistories[0].action).toBe('UPGRADED')
    })

    it('preserves source and planExpiresAt when upgrading from non-INFLUENCER source', async () => {
      const now = new Date()
      ctx.subscriptionPlans.push(
        { id: 'plan-starter', name: 'Starter', priceMonthly: 79, productsLimit: 100, servicesLimit: 40 },
        { id: 'plan-business', name: 'Business', priceMonthly: 199, productsLimit: -1, servicesLimit: -1 }
      )
      ctx.subscriptions.push({
        id: 'sub-1',
        vendorId: 'vendor-1',
        planId: 'plan-starter',
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        currentPeriodStart: now,
        currentPeriodEnd: now,
        nextRenewalAt: now,
        source: null,
        planExpiresAt: null,
        plan: { name: 'Starter' },
      })

      await upgradeSubscription('vendor-1', 'Business')

      const updated = ctx.subscriptions.find((s) => s.id === 'sub-1')
      expect(updated.planId).toBe('plan-business')
      expect(updated.source).toBeNull()
      expect(updated.planExpiresAt).toBeNull()
    })
  })

  describe('vendor with no subscription', () => {
    it('treats vendor with no subscription as Free via canVendorCreateCampaign', async () => {
      ctx.subscriptionPlans.push({
        id: 'plan-free',
        name: 'Free',
        priceMonthly: 0,
        productsLimit: 20,
        servicesLimit: 10,
        featurePermissions: [],
      })

      const result = await canVendorCreateCampaign('vendor-no-sub')

      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('Free')
    })

    it('creates a Free subscription when getVendorSubscription is called after ensureFreeSubscription', async () => {
      ctx.subscriptionPlans.push({
        id: 'plan-free',
        name: 'Free',
        priceMonthly: 0,
        productsLimit: 20,
        servicesLimit: 10,
        featurePermissions: [],
      })
      ctx.users.push({ id: 'vendor-no-sub' })

      await ensureFreeSubscription('vendor-no-sub')
      const subscription = await getVendorSubscription('vendor-no-sub')

      expect(subscription).toBeDefined()
      expect(subscription?.plan?.name).toBe('Free')
    })
  })
})