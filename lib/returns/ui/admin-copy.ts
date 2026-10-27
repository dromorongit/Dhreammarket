import type { ReturnStatus } from '@/lib/returns/state-machine'

export type AdminQueue =
  | 'needs-escalation'
  | 'needs-decision'
  | 'awaiting-refund'
  | 'ready-to-close'
  | 'done'

export interface AdminStatusCopy {
  label: string
  description: string
  tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral'
  queue: AdminQueue | null
}

export const QUEUE_COPY: Record<AdminQueue, { label: string; description: string }> = {
  'needs-escalation': {
    label: 'Needs escalation',
    description: 'Awaiting the seller response past the deadline; an admin can escalate.',
  },
  'needs-decision': {
    label: 'Needs decision',
    description: 'Escalated to Dhream; approve or deny the return.',
  },
  'awaiting-refund': {
    label: 'Awaiting refund',
    description: 'Approved; the linked refund has not been processed yet.',
  },
  'ready-to-close': {
    label: 'Ready to close',
    description: 'Approved and the refund is processed; an admin can close the return.',
  },
  done: {
    label: 'Done',
    description: 'Closed or declined; no further action.',
  },
}

export const ADMIN_STATUS_COPY: Record<ReturnStatus, AdminStatusCopy> = {
  PENDING: {
    label: 'With seller',
    description: 'Awaiting the seller response within the response window.',
    tone: 'info',
    queue: null,
  },
  ITEM_IN_TRANSIT: {
    label: 'Item in transit',
    description: 'The item is on its way back to the seller.',
    tone: 'info',
    queue: null,
  },
  ITEM_RECEIVED: {
    label: 'Item received',
    description: 'The seller has received the returned item.',
    tone: 'info',
    queue: null,
  },
  AWAITING_REFUND: {
    label: 'Approved - refund in progress',
    description: 'Approved; awaiting refund processing.',
    tone: 'success',
    queue: null,
  },
  ESCALATED: {
    label: 'Under review by Dhream',
    description: 'Escalated for an admin decision.',
    tone: 'info',
    queue: null,
  },
  REJECTED: {
    label: 'Declined by Dhream',
    description: 'Declined; terminal state.',
    tone: 'danger',
    queue: null,
  },
  CLOSED: {
    label: 'Completed',
    description: 'Closed after a processed refund.',
    tone: 'neutral',
    queue: null,
  },
}

export interface QueueContext {
  overdue?: boolean
  refundStatus?: string | null
}

export function adminQueue(status: ReturnStatus, context: QueueContext = {}): AdminQueue | null {
  const { overdue, refundStatus } = context
  switch (status) {
    case 'PENDING':
      return overdue === true ? 'needs-escalation' : null
    case 'ESCALATED':
      return 'needs-decision'
    case 'AWAITING_REFUND':
      return refundStatus === 'PROCESSED' ? 'ready-to-close' : 'awaiting-refund'
    case 'CLOSED':
    case 'REJECTED':
      return 'done'
    case 'ITEM_IN_TRANSIT':
    case 'ITEM_RECEIVED':
      return null
  }
}

export function adminQueueLabel(queue: AdminQueue): string {
  return QUEUE_COPY[queue].label
}
