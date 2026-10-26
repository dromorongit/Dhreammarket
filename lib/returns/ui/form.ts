import { parseAmountToPesewas } from './amount'

export type ReturnFormFieldErrors = {
  reason?: string
  amount?: string
  quantity?: string
}

export interface ReturnFormValidationInput {
  reason: string
  requestedAmount: string
  quantity: string | number
  itemQuantity: number
  maxPesewas: number
  maxRefundAmount: string
}

export interface ReturnFormValidationResult {
  ok: boolean
  fieldErrors: ReturnFormFieldErrors
}

const AMOUNT_ERROR_MESSAGES: Record<string, string> = {
  EMPTY: 'Enter an amount',
  NOT_A_NUMBER: 'Enter a valid amount',
  TOO_MANY_DECIMALS: 'Amount must have at most two decimal places',
  NOT_POSITIVE: 'Amount must be greater than zero',
}

export function validateReturnForm(input: ReturnFormValidationInput): ReturnFormValidationResult {
  const { reason, requestedAmount, quantity, itemQuantity, maxPesewas, maxRefundAmount } = input
  const fieldErrors: ReturnFormFieldErrors = {}
  let ok = true

  if (!reason) {
    fieldErrors.reason = 'Select a reason for the return'
    ok = false
  }

  const parsed = parseAmountToPesewas(requestedAmount, maxPesewas)
  if (parsed.kind === 'err') {
    fieldErrors.amount =
      parsed.error.code === 'ABOVE_MAX'
        ? `Amount cannot exceed ${maxRefundAmount}`
        : AMOUNT_ERROR_MESSAGES[parsed.error.code] ?? 'Enter a valid amount'
    ok = false
  }

  if (itemQuantity > 1) {
    const qty = Number(quantity)
    if (!Number.isInteger(qty) || qty < 1 || qty > itemQuantity) {
      fieldErrors.quantity = `Quantity must be between 1 and ${itemQuantity}`
      ok = false
    }
  }

  return { ok, fieldErrors }
}

export function submitReturnRequest(body: any): Promise<{ ok: true; returnId?: string } | { ok: false; message: string }> {
  return fetch('/api/returns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (response) => {
    if (response.ok) {
      const json = (await response.json().catch(() => ({}))) as any
      return { ok: true, returnId: json.returnRequest?.id }
    }
    let code: string | undefined
    try {
      const json = (await response.json().catch(() => ({}))) as any
      code = json?.code
    } catch {
      /* ignore */
    }
    if (response.status === 409 && code === 'OPEN_REQUEST_EXISTS') {
      return { ok: false, message: 'You already have an open return request for this item.' }
    }
    return { ok: false, message: 'Something went wrong. Please try again.' }
  })
}
