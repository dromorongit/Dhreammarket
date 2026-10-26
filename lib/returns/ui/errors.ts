import type { EligibilityReason } from '@/lib/returns/types'

export interface ErrorCopy {
  message: string
  action?: string
}

export const ELIGIBILITY_ERROR_COPY: Record<EligibilityReason, ErrorCopy> = {
  NOT_DELIVERED: {
    message: "This item hasn't been delivered yet, so a return cannot be opened.",
    action: "Check your order's delivery status.",
  },
  WINDOW_EXPIRED: {
    message: 'The return window for this item has closed.',
    action: 'Contact support if there is still a problem with the item.',
  },
  NOT_RETURNABLE_PRODUCT: {
    message: 'This product cannot be returned.',
    action: 'Contact support if you believe this is a mistake.',
  },
  ORDER_NOT_PAID: {
    message: "The order hasn't been paid for yet.",
    action: 'Complete payment for the order first.',
  },
  FULLY_REFUNDED: {
    message: 'This item has already been fully refunded.',
    action: 'No further refund is available for this item.',
  },
  OPEN_REQUEST_EXISTS: {
    message: 'You already have an open return request for this item.',
    action: 'View it in My Returns.',
  },
  INVALID_DELIVERY_DATE: {
    message: "We couldn't confirm a delivery date for this item.",
    action: 'Contact support for help.',
  },
}

export const API_ERROR_COPY: Record<number, ErrorCopy> = {
  401: { message: 'Please sign in to continue.', action: 'Sign in.' },
  403: { message: 'You are not allowed to do this.', action: 'Sign in with the right account.' },
  404: { message: 'We could not find what you are looking for.', action: 'Return to My Returns.' },
  409: { message: 'This return request is already being handled.', action: 'View it in My Returns.' },
}

export function eligibilityReasonToCopy(reason: EligibilityReason): ErrorCopy {
  return ELIGIBILITY_ERROR_COPY[reason]
}

export function apiErrorToCopy(status: number, code?: string): ErrorCopy {
  if (code === 'OPEN_REQUEST_EXISTS') {
    return ELIGIBILITY_ERROR_COPY.OPEN_REQUEST_EXISTS
  }
  const byStatus = API_ERROR_COPY[status]
  if (byStatus) return byStatus
  if (status >= 500) {
    return { message: 'Something went wrong on our end. Please try again later.', action: 'Try again later.' }
  }
  return { message: 'Something went wrong. Please try again.' }
}

export function networkErrorCopy(): ErrorCopy {
  return {
    message: 'No internet connection.',
    action: 'Check your connection and try again.',
  }
}

export function allEligibilityReasonsWithCopy(): Array<{ reason: EligibilityReason; copy: ErrorCopy }> {
  const reasons = Object.keys(ELIGIBILITY_ERROR_COPY) as EligibilityReason[]
  return reasons.map((reason) => ({ reason, copy: ELIGIBILITY_ERROR_COPY[reason] }))
}
