import { getPrisma } from './prisma'
import { PlatformPolicy } from '@prisma/client'

const DEFAULT_AUTO_CONFIRM_DAYS = 3

export interface DeliveryConfirmationInput {
  deliveredAt: Date | null
  deliveryConfirmedAt: Date | null
  hasOpenCase: boolean
}

export function effectiveConfirmation(
  item: DeliveryConfirmationInput,
  policy: PlatformPolicy,
  hasOpenCase: boolean = false
): Date | null {
  if (item.deliveryConfirmedAt) {
    return item.deliveryConfirmedAt
  }
  if (item.deliveredAt && !hasOpenCase) {
    const autoConfirmDays = policy.autoConfirmDeliveryDays ?? DEFAULT_AUTO_CONFIRM_DAYS
    const confirmedAt = new Date(item.deliveredAt.getTime() + autoConfirmDays * 24 * 60 * 60 * 1000)
    return confirmedAt
  }
  return null
}

export async function getPolicy(): Promise<PlatformPolicy> {
  const prisma = getPrisma()
  const policy = await prisma.platformPolicy.findUnique({
    where: { id: 'singleton' }
  })
  
  if (!policy) {
    return {
      id: 'singleton',
      systemCutoverTimestamp: null,
      returnWindowDays: 3,
      vendorResponseBusinessDays: 3,
      disputeResolutionBusinessDays: 7,
      autoConfirmDeliveryDays: DEFAULT_AUTO_CONFIRM_DAYS,
      payoutHoldDaysAfterConfirmation: 2,
      dispatchTargetDaysAfterPayment: 3,
      minOrdersBeforeShowingRate: 10,
      payoutMode: 'REPORT_ONLY',
      holidayList: [],
      refundProcessingWindowDays: 5,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
  
  return policy
}