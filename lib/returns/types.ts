import { Prisma } from '@prisma/client'

export type ReturnActor = 'CUSTOMER' | 'VENDOR' | 'ADMIN' | 'SYSTEM'

export const OPEN_RETURN_STATUSES = [
  'PENDING',
  'ITEM_IN_TRANSIT',
  'ITEM_RECEIVED',
  'AWAITING_REFUND',
  'ESCALATED',
] as const

export const TERMINAL_RETURN_STATUSES = ['REJECTED', 'CLOSED'] as const

export type OpenReturnStatus = (typeof OPEN_RETURN_STATUSES)[number]

export function isOpenReturnStatus(status: string): boolean {
  return (OPEN_RETURN_STATUSES as readonly string[]).includes(status)
}

export type ReturnError = Error & { status: number; code: string }

export function createReturnError(status: number, message: string, code: string): ReturnError {
  const err = new Error(message) as ReturnError
  err.status = status
  err.code = code
  err.name = 'ReturnError'
  return err
}

export type EligibilityResult =
  | { eligible: true; maxRefundAmount: Prisma.Decimal }
  | { eligible: false; reason: EligibilityReason }

export type EligibilityReason =
  | 'NOT_DELIVERED'
  | 'WINDOW_EXPIRED'
  | 'NOT_RETURNABLE_PRODUCT'
  | 'ORDER_NOT_PAID'
  | 'FULLY_REFUNDED'
  | 'OPEN_REQUEST_EXISTS'
  | 'INVALID_DELIVERY_DATE'

export type ReturnRequestLike = {
  id?: string
  status: string
  orderItemId?: string
  escalationDeadline?: Date | string | null
  createdAt?: Date | string
}

export type ClockInput = Date | string | number | { now?: Date | string | number } | undefined