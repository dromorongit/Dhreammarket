import type { ReturnStatus } from '@/lib/returns/state-machine'

export interface SellerStatusCopy {
  label: string
  description: string
  tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  nextStep: string
}

export const SELLER_STATUS_COPY: Record<ReturnStatus, SellerStatusCopy> = {
  PENDING: {
    label: 'Needs your response',
    description: 'A customer is waiting for your decision. Respond before the deadline passes.',
    tone: 'warning',
    nextStep: 'Accept or reject the return before the response deadline.',
  },
  ITEM_IN_TRANSIT: {
    label: 'Item in transit',
    description: 'The customer is sending the item back to you.',
    tone: 'info',
    nextStep: 'Wait for the item to arrive, then confirm receipt.',
  },
  ITEM_RECEIVED: {
    label: 'Item received',
    description: 'You have received the returned item back.',
    tone: 'info',
    nextStep: 'No action needed from you right now.',
  },
  AWAITING_REFUND: {
    label: 'Accepted - refund in progress',
    description: 'You accepted the return and the refund is being processed.',
    tone: 'success',
    nextStep: 'The customer is being refunded now; the amount is deducted from your earnings.',
  },
  ESCALATED: {
    label: 'Under review by Dhream',
    description: 'Dhream is reviewing this return request.',
    tone: 'info',
    nextStep: 'Wait for Dhream\u2019s decision on the request.',
  },
  REJECTED: {
    label: 'Declined by Dhream',
    description: 'This return request was declined.',
    tone: 'danger',
    nextStep: 'No further action needed from you.',
  },
  CLOSED: {
    label: 'Completed',
    description: 'This return is closed.',
    tone: 'neutral',
    nextStep: 'No further action needed.',
  },
}

export function getSellerStatusCopy(status: string): SellerStatusCopy {
  const known = status as ReturnStatus
  if (known in SELLER_STATUS_COPY) return SELLER_STATUS_COPY[known]
  return {
    label: 'Return request',
    description: 'This return request is being handled.',
    tone: 'neutral',
    nextStep: 'Check back here for updates.',
  }
}

export function sellerStatusIsActionable(status: ReturnStatus): boolean {
  return status === 'PENDING'
}
