import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlatformPolicy } from '@prisma/client'

const prismaMock = vi.hoisted(() => ({
  platformPolicy: {
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  getPrisma: vi.fn(() => prismaMock),
}))

import { effectiveConfirmation, getPolicy } from '@/lib/delivery'

const DEFAULT_DAYS = 3

describe('effectiveConfirmation', () => {
  const basePolicy: PlatformPolicy = {
    id: 'singleton',
    systemCutoverTimestamp: null,
    returnWindowDays: 3,
    vendorResponseBusinessDays: 3,
    disputeResolutionBusinessDays: 7,
    autoConfirmDeliveryDays: DEFAULT_DAYS,
    payoutHoldDaysAfterConfirmation: 2,
    dispatchTargetDaysAfterPayment: 3,
    minOrdersBeforeShowingRate: 10,
    payoutMode: 'REPORT_ONLY',
    holidayList: [],
    refundProcessingWindowDays: 5,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const deliveredAt = new Date('2026-01-10T10:00:00.000Z')
  const confirmedAt = new Date('2026-01-12T15:00:00.000Z')

  it('returns deliveryConfirmedAt when set', () => {
    const result = effectiveConfirmation(
      { deliveredAt, deliveryConfirmedAt: confirmedAt, hasOpenCase: false },
      basePolicy,
      false
    )
    expect(result).toEqual(confirmedAt)
  })

  it('returns null when deliveryConfirmedAt is null and deliveredAt is null', () => {
    const result = effectiveConfirmation(
      { deliveredAt: null, deliveryConfirmedAt: null, hasOpenCase: false },
      basePolicy,
      false
    )
    expect(result).toBeNull()
  })

  it('returns auto-confirm date when deliveredAt set and no open case', () => {
    const result = effectiveConfirmation(
      { deliveredAt, deliveryConfirmedAt: null, hasOpenCase: false },
      basePolicy,
      false
    )
    const expected = new Date(deliveredAt.getTime() + DEFAULT_DAYS * 24 * 60 * 60 * 1000)
    expect(result).toEqual(expected)
  })

  it('returns null when deliveredAt set but open case exists', () => {
    const result = effectiveConfirmation(
      { deliveredAt, deliveryConfirmedAt: null, hasOpenCase: false },
      basePolicy,
      true // hasOpenCase
    )
    expect(result).toBeNull()
  })

  it('uses policy autoConfirmDeliveryDays when present', () => {
    const customPolicy = { ...basePolicy, autoConfirmDeliveryDays: 5 }
    const result = effectiveConfirmation(
      { deliveredAt, deliveryConfirmedAt: null, hasOpenCase: false },
      customPolicy,
      false
    )
    const expected = new Date(deliveredAt.getTime() + 5 * 24 * 60 * 60 * 1000)
    expect(result).toEqual(expected)
  })

  it('deliveryConfirmedAt takes precedence over auto-confirm even with open case', () => {
    const result = effectiveConfirmation(
      { deliveredAt, deliveryConfirmedAt: confirmedAt, hasOpenCase: false },
      basePolicy,
      true // hasOpenCase
    )
    expect(result).toEqual(confirmedAt)
  })
})

describe('getPolicy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns policy from database when row exists', async () => {
    const dbPolicy: PlatformPolicy = {
      ...prismaMock.platformPolicy.findUnique.mock.results[0]?.value || {
        id: 'singleton',
        systemCutoverTimestamp: null,
        returnWindowDays: 3,
        vendorResponseBusinessDays: 3,
        disputeResolutionBusinessDays: 7,
        autoConfirmDeliveryDays: 7,
        payoutHoldDaysAfterConfirmation: 2,
        dispatchTargetDaysAfterPayment: 3,
        minOrdersBeforeShowingRate: 10,
        payoutMode: 'REPORT_ONLY',
        holidayList: [],
        refundProcessingWindowDays: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }
    prismaMock.platformPolicy.findUnique.mockResolvedValue(dbPolicy)

    const policy = await getPolicy()
    expect(policy.autoConfirmDeliveryDays).toBe(7)
    expect(prismaMock.platformPolicy.findUnique).toHaveBeenCalledWith({ where: { id: 'singleton' } })
  })

  it('returns defaults when policy row is missing', async () => {
    prismaMock.platformPolicy.findUnique.mockResolvedValue(null)

    const policy = await getPolicy()
    expect(policy.id).toBe('singleton')
    expect(policy.autoConfirmDeliveryDays).toBe(DEFAULT_DAYS)
    expect(policy.returnWindowDays).toBe(3)
    expect(policy.vendorResponseBusinessDays).toBe(3)
    expect(policy.payoutMode).toBe('REPORT_ONLY')
  })
})