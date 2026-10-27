import type { ReturnStatus } from '@/lib/returns/state-machine'
import { formatGhs, pesewasToGhsString } from './amount'

export type ReturnRole = 'VENDOR' | 'ADMIN'
export type ReturnAction = 'RESPOND' | 'ESCALATE' | 'APPROVE' | 'DENY' | 'CLOSE'

export interface ActionContext {
  overdue?: boolean
  refundStatus?: string | null
}

export function available(
  status: ReturnStatus,
  role: ReturnRole,
  context: ActionContext = {}
): ReturnAction[] {
  const { overdue, refundStatus } = context

  if (role === 'VENDOR') {
    return status === 'PENDING' ? ['RESPOND'] : []
  }

  // SUPER_ADMIN
  if (status === 'ESCALATED') return ['APPROVE', 'DENY']
  if (status === 'PENDING' && overdue === true) return ['ESCALATE']
  if (status === 'AWAITING_REFUND' && refundStatus === 'PROCESSED') return ['CLOSE']
  return []
}

export function actionLabel(action: ReturnAction): string {
  const labels: Record<ReturnAction, string> = {
    RESPOND: 'Respond',
    ESCALATE: 'Escalate to Dhream',
    APPROVE: 'Approve refund',
    DENY: 'Deny',
    CLOSE: 'Close return',
  }
  return labels[action]
}

export function actionVariant(action: ReturnAction): 'primary' | 'outline' | 'danger' | 'ghost' {
  const variants: Record<ReturnAction, 'primary' | 'outline' | 'danger' | 'ghost'> = {
    RESPOND: 'primary',
    ESCALATE: 'outline',
    APPROVE: 'primary',
    DENY: 'danger',
    CLOSE: 'outline',
  }
  return variants[action]
}

export interface ConfirmationTextInput {
  decision: 'APPROVE' | 'DENY'
  amountPesewas: number | null
  role: ReturnRole
}

export function confirmationText(input: ConfirmationTextInput): string {
  const { decision, amountPesewas, role } = input
  const amount =
    amountPesewas === null ? null : formatGhs(pesewasToGhsString(amountPesewas))

  if (decision === 'APPROVE') {
    const base = amount ? `Refund ${amount} to the customer now.` : 'Refund the customer now.'
    if (role === 'VENDOR') {
      return `${base} The amount will be deducted from your earnings.`
    }
    return base
  }

  return 'Reject this return request. The customer will not be refunded.'
}
