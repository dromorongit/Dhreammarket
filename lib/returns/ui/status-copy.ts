import type { ReturnStatus } from '@/lib/returns/state-machine'
import { getVendorResponseHours } from '@/lib/feature-flags'

export interface StatusCopy {
  label: string
  description: string
  tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  nextStep: string
}

export const STATUS_COPY: Record<ReturnStatus, StatusCopy> = {
  PENDING: {
    label: 'Waiting for the seller',
    description: `The seller has ${getVendorResponseHours()} hours to respond to your return request.`,
    tone: 'info',
    nextStep: 'The seller will review your request and respond. If they do not respond in time, Dhream reviews it.',
  },
  ITEM_IN_TRANSIT: {
    label: 'In progress',
    description: 'The item is on its way back to the seller.',
    tone: 'info',
    nextStep: 'Keep the item packaged until the seller confirms receipt.',
  },
  ITEM_RECEIVED: {
    label: 'In progress',
    description: 'The seller has received the returned item.',
    tone: 'info',
    nextStep: 'The seller is processing the returned item.',
  },
  AWAITING_REFUND: {
    label: 'Approved - refund in progress',
    description: 'Your return was approved and the refund is being processed.',
    tone: 'success',
    nextStep: 'The refund will be sent to your original payment method.',
  },
  ESCALATED: {
    label: 'Under review by Dhream',
    description: 'Our team is reviewing your return request.',
    tone: 'info',
    nextStep: 'Dhream will approve or decline the request and let you know the outcome.',
  },
  REJECTED: {
    label: 'Declined',
    description: 'Your return request was declined.',
    tone: 'danger',
    nextStep: 'Contact support if you have new information, or place a new request for another item.',
  },
  CLOSED: {
    label: 'Completed - refund sent',
    description: 'Your return is completed and the refund has been sent.',
    tone: 'success',
    nextStep: 'No further action is needed.',
  },
}

export function statusToneToBadgeVariant(tone: StatusCopy['tone']) {
  switch (tone) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'danger':
      return 'danger'
    case 'info':
      return 'info'
    case 'neutral':
    default:
      return 'default'
  }
}

export function getStatusCopy(status: string): StatusCopy {
  const known = status as ReturnStatus
  if (known in STATUS_COPY) return STATUS_COPY[known]
  return {
    label: 'Return request',
    description: 'Your return request is being handled.',
    tone: 'neutral',
    nextStep: 'Check back here for updates.',
  }
}

export function allStatusesWithCopy(): Array<{ status: ReturnStatus; copy: StatusCopy }> {
  const statuses = Object.keys(STATUS_COPY) as ReturnStatus[]
  return statuses.map((status) => ({ status, copy: STATUS_COPY[status] }))
}
