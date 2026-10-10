import { describe, it, expect, vi, beforeEach } from 'vitest'
import { creditInfluencerOrderCashback, reverseInfluencerOrderCashback } from '@/lib/influencer/order-cashback'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/notifications', () => ({
  createNotification: vi.fn(() => Promise.resolve()),
}))

import { getPrisma } from '@/lib/prisma'
import { CashbackSource } from '@prisma/client'

const mockGetPrisma = vi.mocked(getPrisma)

function buildMockPrisma() {
  const cashbackBalances: any[] = []
  const cashbackTransactions: any[] = []
  const influencerCashbacks: any[] = []
  const users: any[] = []
  const influencers: any[] = []

  const tx = {
    cashbackBalance: {
      upsert: vi.fn(async ({ where, update, create }: any) => {
        const idx = cashbackBalances.findIndex((cb) => cb.userId === where.userId)
        if (idx >= 0) {
          cashbackBalances[idx] = {
            ...cashbackBalances[idx],
            ...update,
            balance: (cashbackBalances[idx].balance || 0) + (update.balance?.increment || 0),
            totalEarned: (cashbackBalances[idx].totalEarned || 0) + (update.totalEarned?.increment || 0),
          }
          return cashbackBalances[idx]
        }
        const created = { userId: where.userId, ...create }
        cashbackBalances.push(created)
        return created
      }),
      findUnique: vi.fn(async ({ where }: any) => cashbackBalances.find((cb) => cb.userId === where.userId) || null),
      update: vi.fn(async ({ where, data }: any) => {
        const idx = cashbackBalances.findIndex((cb) => cb.userId === where.userId)
        if (idx >= 0) {
          const newBalance = Math.round((cashbackBalances[idx].balance - (data.balance ? Math.abs(data.balance) : 0)) * 100) / 100
          cashbackBalances[idx] = { ...cashbackBalances[idx], ...data, balance: newBalance || 0 }
          return cashbackBalances[idx]
        }
        return null
      }),
    },
    cashbackTransaction: {
      create: vi.fn(async ({ data }: any) => {
        const created = { id: `ct-${cashbackTransactions.length + 1}`, ...data }
        cashbackTransactions.push(created)
        return created
      }),
    },
    influencerCashback: {
      findUnique: vi.fn(async ({ where }: any) => influencerCashbacks.find((ic) => ic.orderId === where.orderId) || null),
      create: vi.fn(async ({ data }: any) => {
        const created = { id: `ic-${influencerCashbacks.length + 1}`, ...data }
        influencerCashbacks.push(created)
        return created
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = influencerCashbacks.findIndex((ic) => ic.orderId === where.orderId)
        if (idx >= 0) {
          const deleted = influencerCashbacks[idx]
          influencerCashbacks.splice(idx, 1)
          return deleted
        }
        return null
      }),
    },
    user: {
      findUnique: vi.fn(async ({ where }: any) => users.find((u) => u.id === where.id) || null),
      update: vi.fn(async ({ where, data }: any) => {
        const user = users.find((u) => u.id === where.id)
        if (user) {
          if (data.influencerCashbackOrdersUsed?.increment) {
            user.influencerCashbackOrdersUsed = (user.influencerCashbackOrdersUsed || 0) + data.influencerCashbackOrdersUsed.increment
          }
          if (data.influencerCashbackOrdersUsed?.decrement) {
            user.influencerCashbackOrdersUsed = Math.max(0, (user.influencerCashbackOrdersUsed || 0) - data.influencerCashbackOrdersUsed.decrement)
          }
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
    cashbackBalance: tx.cashbackBalance,
    cashbackTransaction: tx.cashbackTransaction,
    influencerCashback: tx.influencerCashback,
    rewardPoints: {
      upsert: vi.fn(),
    },
  }

  return {
    mockPrisma,
    tx,
    cashbackBalances,
    cashbackTransactions,
    influencerCashbacks,
    users,
    influencers,
  }
}

describe('Influencer order cashback', () => {
  let ctx: ReturnType<typeof buildMockPrisma>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockPrisma()
    mockGetPrisma.mockReturnValue(ctx.mockPrisma as any)
  })

  it('credits cashback for orders 1-5', async () => {
    const userId = `user-${Date.now()}`
    const orderId = `order-${Date.now()}`
    const influencerCode = 'ACTIVE'
    const subtotal = 100

    ctx.influencers.push({
      id: 'inf-1',
      referralCode: influencerCode,
      active: true,
      customerCashbackPercent: 10,
      customerCashbackMaxOrders: 5,
    })
    ctx.users.push({ id: userId, influencerCashbackOrdersUsed: 0 })

    await creditInfluencerOrderCashback(userId, orderId, influencerCode, subtotal)

    expect(ctx.tx.cashbackBalance.upsert).toHaveBeenCalled()
    expect(ctx.tx.cashbackTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        amount: 10,
        source: CashbackSource.INFLUENCER,
      }),
    })
    expect(ctx.tx.influencerCashback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        orderId,
        cashbackAmount: 10,
      }),
    })
    expect(ctx.tx.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { influencerCashbackOrdersUsed: { increment: 1 } },
    })
  })

  it('does not credit cashback on order 6 when max orders reached', async () => {
    const userId = `user-${Date.now()}`
    const orderId = `order-${Date.now()}-6`
    const influencerCode = 'ACTIVE'

    ctx.influencers.push({
      id: 'inf-1',
      referralCode: influencerCode,
      active: true,
      customerCashbackPercent: 10,
      customerCashbackMaxOrders: 5,
    })
    ctx.users.push({ id: userId, influencerCashbackOrdersUsed: 5 })

    await creditInfluencerOrderCashback(userId, orderId, influencerCode, 100)

    expect(ctx.tx.cashbackBalance.upsert).not.toHaveBeenCalled()
    expect(ctx.tx.cashbackTransaction.create).not.toHaveBeenCalled()
    expect(ctx.tx.influencerCashback.create).not.toHaveBeenCalled()
  })

  it('reverses cashback on cancel and decrements order count', async () => {
    const userId = `user-${Date.now()}`
    const orderId = `order-${Date.now()}`

    ctx.cashbackBalances.push({ userId, balance: 10, totalEarned: 10, totalRedeemed: 0 })
    ctx.influencerCashbacks.push({
      id: 'ic-1',
      orderId,
      userId,
      cashbackAmount: 10,
    })
    ctx.users.push({ id: userId, influencerCashbackOrdersUsed: 1 })

    await reverseInfluencerOrderCashback(orderId)

    expect(ctx.tx.cashbackBalance.update).toHaveBeenCalled()
    expect(ctx.tx.cashbackTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId,
        amount: -10,
      }),
    })
    expect(ctx.tx.user.update).toHaveBeenCalledWith({
      where: { id: userId },
      data: { influencerCashbackOrdersUsed: { decrement: 1 } },
    })
    expect(ctx.tx.influencerCashback.delete).toHaveBeenCalledWith({
      where: { orderId },
    })
  })

  it('does nothing if cashback record does not exist for reversal', async () => {
    await reverseInfluencerOrderCashback('non-existent-order')

    expect(ctx.tx.cashbackBalance.update).not.toHaveBeenCalled()
    expect(ctx.tx.cashbackTransaction.create).not.toHaveBeenCalled()
    expect(ctx.tx.user.update).not.toHaveBeenCalled()
  })

  it('deletes the orphaned cashback record when the user was deleted and does not throw', async () => {
    const orderId = `order-${Date.now()}-orphan`
    ctx.influencerCashbacks.push({
      id: 'ic-orphan',
      orderId,
      userId: null,
      cashbackAmount: 10,
    })

    await expect(reverseInfluencerOrderCashback(orderId)).resolves.toBeUndefined()

    expect(ctx.tx.influencerCashback.delete).toHaveBeenCalledWith({ where: { orderId } })
    expect(ctx.tx.cashbackBalance.update).not.toHaveBeenCalled()
    expect(ctx.tx.cashbackTransaction.create).not.toHaveBeenCalled()
    expect(ctx.tx.user.update).not.toHaveBeenCalled()
  })
})
