import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(),
}))

import { getPrisma } from '@/lib/prisma'
import { calculateFinancialBreakdown, invalidatePlatformFeeCache } from '@/lib/revenue'

describe('payment-link fee math (characterization)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidatePlatformFeeCache()
  })

  it('platformFee 2.5 settings row: stores identical values on Order and OrderItem', async () => {
    const mockPrisma = {
      superAdminSettings: {
        findFirst: vi.fn(async () => ({ platformFee: 2.5 })),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(mockPrisma as any)

    const grossAmount = 100 // original order total
    const actualChargedAmount = 100 // no pass-through processing fee
    const processorFee = Math.max(0, Math.round((actualChargedAmount - grossAmount) * 100) / 100)

    const orderBreakdown = await calculateFinancialBreakdown(grossAmount, 0)
    const storedOrder = {
      grossAmount: actualChargedAmount,
      processorFee,
      netAmount: orderBreakdown.netAmount,
      platformCommission: orderBreakdown.platformCommission,
      vendorEarnings: orderBreakdown.vendorEarnings,
      commissionRate: orderBreakdown.commissionRate,
    }

    const itemGross = 100
    const itemProcessorFee = Math.round((itemGross / grossAmount) * processorFee * 100) / 100
    const itemBreakdown = await calculateFinancialBreakdown(itemGross, 0)
    const storedItem = {
      grossAmount: itemBreakdown.grossAmount,
      processorFee: itemProcessorFee,
      netAmount: itemBreakdown.netAmount,
      platformCommission: itemBreakdown.platformCommission,
      vendorEarnings: itemBreakdown.vendorEarnings,
      commissionRate: itemBreakdown.commissionRate,
    }

    console.log('FEE_MATH_PLATFORM_2_5_ORDER', JSON.stringify(storedOrder))
    console.log('FEE_MATH_PLATFORM_2_5_ITEM', JSON.stringify(storedItem))

    expect(storedOrder).toEqual({
      grossAmount: 100,
      processorFee: 0,
      netAmount: 100,
      platformCommission: 2.5,
      vendorEarnings: 97.5,
      commissionRate: 0.025,
    })
    expect(storedItem).toEqual({
      grossAmount: 100,
      processorFee: 0,
      netAmount: 100,
      platformCommission: 2.5,
      vendorEarnings: 97.5,
      commissionRate: 0.025,
    })

    // platform net after Paystack real fee (1.95% of chargeTotal)
    const paystackFee = Math.round(actualChargedAmount * 0.0195 * 100) / 100
    const platformNet = Math.round((orderBreakdown.platformCommission - paystackFee) * 100) / 100
    console.log('FEE_MATH_PLATFORM_2_5_PLATFORM_NET_AFTER_PAYSTACK', platformNet, 'paystackFee', paystackFee)
    expect(platformNet).toBe(0.55)
  })

  it('no settings row (1% fallback): stores identical values on Order and OrderItem', async () => {
    const mockPrisma = {
      superAdminSettings: {
        findFirst: vi.fn(async () => null),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(mockPrisma as any)

    const grossAmount = 100
    const actualChargedAmount = 100
    const processorFee = Math.max(0, Math.round((actualChargedAmount - grossAmount) * 100) / 100)

    const orderBreakdown = await calculateFinancialBreakdown(grossAmount, 0)
    const storedOrder = {
      grossAmount: actualChargedAmount,
      processorFee,
      netAmount: orderBreakdown.netAmount,
      platformCommission: orderBreakdown.platformCommission,
      vendorEarnings: orderBreakdown.vendorEarnings,
      commissionRate: orderBreakdown.commissionRate,
    }

    console.log('FEE_MATH_FALLBACK_1PCT_ORDER', JSON.stringify(storedOrder))
    expect(storedOrder).toEqual({
      grossAmount: 100,
      processorFee: 0,
      netAmount: 100,
      platformCommission: 1,
      vendorEarnings: 99,
      commissionRate: 0.01,
    })

    const paystackFee = Math.round(actualChargedAmount * 0.0195 * 100) / 100
    const platformNet = Math.round((orderBreakdown.platformCommission - paystackFee) * 100) / 100
    console.log('FEE_MATH_FALLBACK_1PCT_PLATFORM_NET_AFTER_PAYSTACK', platformNet, 'paystackFee', paystackFee)
    expect(platformNet).toBe(-0.95)
  })

  it('platformFee 2.5 settings row, real flow: customer charged 101.99 on a 100 order', async () => {
    const mockPrisma = {
      superAdminSettings: {
        findFirst: vi.fn(async () => ({ platformFee: 2.5 })),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(mockPrisma as any)

    const grossAmount = 100 // original order total
    const actualChargedAmount = 101.99 // customer pays the processing fee on top
    const processorFee = Math.max(0, Math.round((actualChargedAmount - grossAmount) * 100) / 100)

    const orderBreakdown = await calculateFinancialBreakdown(grossAmount, 0)
    const storedOrder = {
      grossAmount: actualChargedAmount,
      processorFee,
      netAmount: orderBreakdown.netAmount,
      platformCommission: orderBreakdown.platformCommission,
      vendorEarnings: orderBreakdown.vendorEarnings,
      commissionRate: orderBreakdown.commissionRate,
    }

    const itemGross = 100
    const itemProcessorFee = Math.round((itemGross / grossAmount) * processorFee * 100) / 100
    const itemBreakdown = await calculateFinancialBreakdown(itemGross, 0)
    const storedItem = {
      grossAmount: itemBreakdown.grossAmount,
      processorFee: itemProcessorFee,
      netAmount: itemBreakdown.netAmount,
      platformCommission: itemBreakdown.platformCommission,
      vendorEarnings: itemBreakdown.vendorEarnings,
      commissionRate: itemBreakdown.commissionRate,
    }

    console.log('FEE_MATH_REAL_2_5_ORDER', JSON.stringify(storedOrder))
    console.log('FEE_MATH_REAL_2_5_ITEM', JSON.stringify(storedItem))

    expect(storedOrder).toEqual({
      grossAmount: 101.99,
      processorFee: 1.99,
      netAmount: 100,
      platformCommission: 2.5,
      vendorEarnings: 97.5,
      commissionRate: 0.025,
    })
    expect(storedItem).toEqual({
      grossAmount: 100,
      processorFee: 1.99,
      netAmount: 100,
      platformCommission: 2.5,
      vendorEarnings: 97.5,
      commissionRate: 0.025,
    })

    const paystackFee = Math.round(actualChargedAmount * 0.0195 * 100) / 100
    const platformNet = Math.round((orderBreakdown.platformCommission - paystackFee) * 100) / 100
    console.log('FEE_MATH_REAL_2_5_PLATFORM_NET_AFTER_PAYSTACK', platformNet, 'paystackFee', paystackFee)
    expect(platformNet).toBe(0.51)
  })

  it('no settings row (1% fallback), real flow: customer charged 101.99 on a 100 order', async () => {
    const mockPrisma = {
      superAdminSettings: {
        findFirst: vi.fn(async () => null),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(mockPrisma as any)

    const grossAmount = 100 // original order total
    const actualChargedAmount = 101.99 // customer pays the processing fee on top
    const processorFee = Math.max(0, Math.round((actualChargedAmount - grossAmount) * 100) / 100)

    const orderBreakdown = await calculateFinancialBreakdown(grossAmount, 0)
    const storedOrder = {
      grossAmount: actualChargedAmount,
      processorFee,
      netAmount: orderBreakdown.netAmount,
      platformCommission: orderBreakdown.platformCommission,
      vendorEarnings: orderBreakdown.vendorEarnings,
      commissionRate: orderBreakdown.commissionRate,
    }

    console.log('FEE_MATH_REAL_FALLBACK_ORDER', JSON.stringify(storedOrder))

    expect(storedOrder).toEqual({
      grossAmount: 101.99,
      processorFee: 1.99,
      netAmount: 100,
      platformCommission: 1,
      vendorEarnings: 99,
      commissionRate: 0.01,
    })

    const paystackFee = Math.round(actualChargedAmount * 0.0195 * 100) / 100
    const platformNet = Math.round((orderBreakdown.platformCommission - paystackFee) * 100) / 100
    console.log('FEE_MATH_REAL_FALLBACK_PLATFORM_NET_AFTER_PAYSTACK', platformNet, 'paystackFee', paystackFee)
    expect(platformNet).toBe(-0.99)
  })
})
