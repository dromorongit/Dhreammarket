import { describe, it, expect, vi, beforeEach } from 'vitest'
import { creditInfluencerSignupBonus } from '@/lib/influencer/signup-bonus'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}))

import { getPrisma } from '@/lib/prisma'
import { RewardCategory, TransactionType } from '@prisma/client'

const mockGetPrisma = vi.mocked(getPrisma)

function buildMockPrisma() {
  const rewardPoints: any[] = []
  const rewardTransactions: any[] = []
  const users: any[] = []
  const influencers: any[] = []

  const tx = {
    rewardPoints: {
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const idx = rewardPoints.findIndex((rp) => rp.userId === where.userId)
        if (idx >= 0) {
          rewardPoints[idx] = { ...rewardPoints[idx], ...update, balance: (rewardPoints[idx].balance || 0) + (update.balance?.increment || 0) }
          return rewardPoints[idx]
        }
        const created = { userId: where.userId, ...create }
        rewardPoints.push(created)
        return created
      }),
    },
    rewardTransaction: {
      create: vi.fn(async ({ data }: any) => {
        const created = { id: `rt-${rewardTransactions.length + 1}`, ...data }
        rewardTransactions.push(created)
        return created
      }),
    },
    user: {
      update: vi.fn(async ({ where, data }: any) => {
        const user = users.find((u) => u.id === where.id)
        if (user) {
          Object.assign(user, data)
          return user
        }
        return null
      }),
    },
  }

  const mockPrisma = {
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.find((u) => u.id === where.id) || null),
    },
    influencer: {
      findUnique: vi.fn(async ({ where }: any) => influencers.find((i) => i.referralCode === where.referralCode) || null),
    },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    rewardPoints: tx.rewardPoints,
    rewardTransaction: tx.rewardTransaction,
  }

  return {
    mockPrisma,
    tx,
    rewardPoints,
    rewardTransactions,
    users,
    influencers,
  }
}

describe('Influencer signup bonus', () => {
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockPrisma()
    mockGetPrisma.mockReturnValue(ctx.mockPrisma as any)
  })

  it('grants 500 points once for a new user via active influencer code', async () => {
    const userId = `user-${Date.now()}`
    const influencerCode = 'ACTIVE-CODE'
    const influencerId = `inf-${Date.now()}`

    ctx.influencers.push({
      id: influencerId,
      referralCode: influencerCode,
      active: true,
      customerSignupPoints: 500,
    })
    ctx.users.push({ id: userId, influencerBonusGrantedAt: null })

    await creditInfluencerSignupBonus(userId, influencerCode)

    expect(ctx.tx.rewardPoints.upsert).toHaveBeenCalled()
    expect(ctx.tx.rewardTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        type: TransactionType.BONUS,
        category: RewardCategory.SPECIAL_OFFER,
        amount: 500,
      }),
    })
    expect(ctx.tx.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { influencerBonusGrantedAt: expect.any(Date) },
    })
  })

  it('does not grant points if bonus already granted', async () => {
    const userId = `user-${Date.now()}`
    ctx.users.push({ id: userId, influencerBonusGrantedAt: new Date() })

    await creditInfluencerSignupBonus(userId, 'ANY-CODE')

    expect(ctx.tx.rewardPoints.upsert).not.toHaveBeenCalled()
    expect(ctx.tx.rewardTransaction.create).not.toHaveBeenCalled()
  })

  it('does not grant points for inactive influencer code', async () => {
    const userId = `user-${Date.now()}`
    ctx.influencers.push({
      id: 'inf-inactive',
      referralCode: 'INACTIVE',
      active: false,
      customerSignupPoints: 500,
    })
    ctx.users.push({ id: userId, influencerBonusGrantedAt: null })

    await creditInfluencerSignupBonus(userId, 'INACTIVE')

    expect(ctx.tx.rewardPoints.upsert).not.toHaveBeenCalled()
    expect(ctx.tx.rewardTransaction.create).not.toHaveBeenCalled()
  })

  it('does not grant points for non-existent influencer code', async () => {
    const userId = `user-${Date.now()}`
    ctx.users.push({ id: userId, influencerBonusGrantedAt: null })

    await creditInfluencerSignupBonus(userId, 'NON-EXISTENT')

    expect(ctx.tx.rewardPoints.upsert).not.toHaveBeenCalled()
    expect(ctx.tx.rewardTransaction.create).not.toHaveBeenCalled()
  })
})
