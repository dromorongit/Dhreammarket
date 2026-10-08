import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downgradeExpiredInfluencerTrials, notifyExpiringInfluencerTrials } from '@/lib/influencer/vendor-trial'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(() => Promise.resolve()),
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
      findUnique: vi.fn(async ({ where }: any) => subscriptions.find((s) => s.id === where.id) || null),
      findMany: vi.fn(async ({ where }: any) => {
        return subscriptions.filter((s) => {
          if (where.source && s.source !== where.source) return false
          if (where.planExpiresAt) {
            const { lt, gt, lte } = where.planExpiresAt as any
            if (lt && !(s.planExpiresAt < lt)) return false
            if (gt && !(s.planExpiresAt > gt)) return false
            if (lte && !(s.planExpiresAt <= lte)) return false
          }
          if (where.status?.in && !where.status.in.includes(s.status)) return false
          if (where.plan?.name && s.plan?.name !== where.plan.name) return false
          return true
        })
      }),
      update: vi.fn(async ({ where, data }: any) => {
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
    $transaction: vi.fn(async (fn: any) => fn({
      vendorSubscription: {
        update: vi.fn(async ({ where, data }: any) => {
          const idx = subscriptions.findIndex((s) => s.id === where.id)
          if (idx >= 0) {
            subscriptions[idx] = { ...subscriptions[idx], ...data }
            return subscriptions[idx]
          }
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
    })),
  }

  return {
    mockPrisma,
    subscriptions,
    subscriptionPlans,
    subscriptionHistories,
    users,
  }
}

describe('Influencer vendor trial expiry', () => {
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockPrisma()
    mockGetPrisma.mockReturnValue(ctx.mockPrisma as any)
  })

  it('downgrades expired influencer trial to Free', async () => {
    const vendorId = 'vendor-1'
    const subId = 'sub-1'
    const now = new Date()

    ctx.subscriptionPlans.push(
      { id: 'plan-starter', name: 'Starter', priceMonthly: 0 },
      { id: 'plan-free', name: 'Free', priceMonthly: 0 }
    )
    ctx.subscriptions.push({
      id: subId,
      vendorId,
      planId: 'plan-starter',
      status: 'ACTIVE',
      source: 'INFLUENCER',
      influencerCode: 'INF-CODE',
      planExpiresAt: new Date(now.getTime() - 1000),
      billingCycle: 'MONTHLY',
      currentPeriodEnd: now,
      nextRenewalAt: now,
      plan: { name: 'Starter' },
      vendor: { id: vendorId },
    })

    const result = await downgradeExpiredInfluencerTrials()

    expect(result.processed).toBe(1)
    const updated = ctx.subscriptions.find((s) => s.id === subId)
    expect(updated.planId).toBe('plan-free')
    expect(updated.source).toBeNull()
    expect(updated.influencerCode).toBeNull()
    expect(updated.planExpiresAt).toBeNull()
    expect(ctx.subscriptionHistories).toHaveLength(1)
  })

  it('does not downgrade paid vendor with Starter plan but no INFLUENCER source', async () => {
    const now = new Date()
    ctx.subscriptionPlans.push(
      { id: 'plan-starter', name: 'Starter', priceMonthly: 500 },
      { id: 'plan-free', name: 'Free', priceMonthly: 0 }
    )
    ctx.subscriptions.push({
      id: 'sub-paid',
      vendorId: 'vendor-2',
      planId: 'plan-starter',
      status: 'ACTIVE',
      source: null,
      planExpiresAt: new Date(now.getTime() - 1000),
      billingCycle: 'MONTHLY',
      currentPeriodEnd: now,
      nextRenewalAt: now,
      plan: { name: 'Starter' },
      vendor: { id: 'vendor-2' },
    })

    const result = await downgradeExpiredInfluencerTrials()

    expect(result.processed).toBe(0)
    const sub = ctx.subscriptions.find((s) => s.id === 'sub-paid')
    expect(sub.planId).toBe('plan-starter')
    expect(sub.source).toBeNull()
  })

  it('is idempotent when run twice', async () => {
    const now = new Date()
    ctx.subscriptionPlans.push(
      { id: 'plan-starter', name: 'Starter', priceMonthly: 0 },
      { id: 'plan-free', name: 'Free', priceMonthly: 0 }
    )
    ctx.subscriptions.push({
      id: 'sub-1',
      vendorId: 'vendor-1',
      planId: 'plan-starter',
      status: 'ACTIVE',
      source: 'INFLUENCER',
      planExpiresAt: new Date(now.getTime() - 1000),
      billingCycle: 'MONTHLY',
      currentPeriodEnd: now,
      nextRenewalAt: now,
      plan: { name: 'Starter' },
      vendor: { id: 'vendor-1' },
    })

    await downgradeExpiredInfluencerTrials()
    const firstHistoryCount = ctx.subscriptionHistories.length
    const firstSub = ctx.subscriptions.find((s) => s.id === 'sub-1')

    await downgradeExpiredInfluencerTrials()

    expect(ctx.subscriptionHistories.length).toBe(firstHistoryCount)
    const secondSub = ctx.subscriptions.find((s) => s.id === 'sub-1')
    expect(secondSub.planId).toBe(firstSub.planId)
  })

  it('does not modify anything in dryRun mode', async () => {
    const now = new Date()
    ctx.subscriptionPlans.push(
      { id: 'plan-starter', name: 'Starter', priceMonthly: 0 },
      { id: 'plan-free', name: 'Free', priceMonthly: 0 }
    )
    ctx.subscriptions.push({
      id: 'sub-1',
      vendorId: 'vendor-1',
      planId: 'plan-starter',
      status: 'ACTIVE',
      source: 'INFLUENCER',
      planExpiresAt: new Date(now.getTime() - 1000),
      billingCycle: 'MONTHLY',
      currentPeriodEnd: now,
      nextRenewalAt: now,
      plan: { name: 'Starter' },
      vendor: { id: 'vendor-1' },
    })

    const result = await downgradeExpiredInfluencerTrials(true)

    expect(result.processed).toBe(1)
    const sub = ctx.subscriptions.find((s) => s.id === 'sub-1')
    expect(sub.planId).toBe('plan-starter')
    expect(ctx.subscriptionHistories).toHaveLength(0)
  })
})
