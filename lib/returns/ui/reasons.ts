import type { ReturnReason } from '@prisma/client'

export type { ReturnReason }

export const REASON_LABELS: Record<ReturnReason, string> = {
  NOT_AS_DESCRIBED: 'Not as described',
  DAMAGED: 'Damaged or broken',
  WRONG_ITEM: 'Wrong item',
  NOT_RECEIVED: 'Not received',
  CHANGE_OF_MIND: 'Change of mind',
  OTHER: 'Other',
}

export const REASON_ORDER: ReturnReason[] = [
  'NOT_AS_DESCRIBED',
  'DAMAGED',
  'WRONG_ITEM',
  'NOT_RECEIVED',
  'CHANGE_OF_MIND',
  'OTHER',
]

export function reasonLabel(reason: string): string {
  const known = reason as ReturnReason
  if (known in REASON_LABELS) return REASON_LABELS[known]
  return REASON_LABELS.OTHER
}
