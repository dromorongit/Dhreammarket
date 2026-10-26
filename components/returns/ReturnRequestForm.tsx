'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { parseAmountToPesewas, formatGhs } from '@/lib/returns/ui/amount'
import { validateReturnForm, type ReturnFormFieldErrors } from '@/lib/returns/ui/form'
import { reasonLabel, REASON_ORDER, type ReturnReason } from '@/lib/returns/ui/reasons'
import { apiErrorToCopy, networkErrorCopy } from '@/lib/returns/ui/errors'

interface ReturnRequestFormProps {
  orderItemId: string
  itemName: string
  itemQuantity: number
  maxRefundAmount: string
  windowDays: number
  vendorResponseHours: number
}

export function ReturnRequestForm({
  orderItemId,
  itemName,
  itemQuantity,
  maxRefundAmount,
  windowDays,
  vendorResponseHours,
}: ReturnRequestFormProps) {
  const [reason, setReason] = useState(REASON_ORDER[0])
  const [requestedAmount, setRequestedAmount] = useState(maxRefundAmount)
  const [quantity, setQuantity] = useState(1)
  const [sending, setSending] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<ReturnFormFieldErrors>({})
  const [serverError, setServerError] = useState<{ message: string; action?: string } | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const maxResult = parseAmountToPesewas(maxRefundAmount)
  const maxPesewas = maxResult.kind === 'ok' ? maxResult.pesewas : 0

  const validate = useCallback((): boolean => {
    const result = validateReturnForm({
      reason,
      requestedAmount,
      quantity,
      itemQuantity,
      maxPesewas,
      maxRefundAmount,
    })
    setFieldErrors(result.fieldErrors)
    return result.ok
  }, [reason, requestedAmount, quantity, itemQuantity, maxPesewas, maxRefundAmount])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setServerError(null)
    if (!validate()) return

    setSending(true)
    try {
      const body: any = { orderItemId, reason, requestedAmount }
      if (itemQuantity > 1) body.quantity = Number(quantity)
      const response = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      let json: any = {}
      try {
        json = await response.json()
      } catch {
        /* ignore */
      }

      if (response.ok) {
        setSuccessId(json.returnRequest?.id ?? null)
        return
      }

      const code = json.code
      if (response.status === 409 && code === 'OPEN_REQUEST_EXISTS') {
        setServerError(apiErrorToCopy(409, code))
        return
      }
      if (response.status === 400 && code === 'INVALID_AMOUNT') {
        setFieldErrors({ amount: 'The requested amount is invalid.' })
        return
      }
      setServerError(apiErrorToCopy(response.status, code))
    } catch {
      setServerError(networkErrorCopy())
    } finally {
      setSending(false)
    }
  }

  if (successId) {
    return (
      <div className="space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold mx-auto">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 text-center">Return request opened</h2>
        <p className="text-sm text-slate-600 text-center">
          Your return request has been submitted. The seller will respond within {vendorResponseHours} hours.
        </p>
        <Link href={`/dashboard/customer/returns/${successId}`}>
          <Button variant="primary" fullWidth size="md">
            View return request
          </Button>
        </Link>
      </div>
    )
  }

  const canRequestQuantity = itemQuantity > 1

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {serverError && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-800">{serverError.message}</p>
          {serverError.action && (
            <p className="text-xs text-rose-600 mt-1">{serverError.action}</p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="return-reason" className="block text-sm font-medium text-slate-700">
          Reason for return
        </label>
        <select
          id="return-reason"
          defaultValue={reason}
          onChange={(e) => setReason(e.target.value as ReturnReason)}
          className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue disabled:bg-slate-50 disabled:text-slate-400 cursor-not-allowed"
          disabled={sending}
        >
          {REASON_ORDER.map((r) => (
            <option key={r} value={r}>
              {reasonLabel(r)}
            </option>
          ))}
        </select>
        {fieldErrors.reason && submitted && (
          <p id="reason-error" className="text-sm text-rose-600 mt-1" role="alert">
            {fieldErrors.reason}
          </p>
        )}
      </div>

      {canRequestQuantity && (
        <div>
          <label htmlFor="return-quantity" className="block text-sm font-medium text-slate-700">
            Quantity
          </label>
          <input
            id="return-quantity"
            type="number"
            min="1"
            max={itemQuantity}
            defaultValue={quantity}
            onChange={(e) => setQuantity(e.target.valueAsNumber ?? 1)}
            className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue disabled:bg-slate-50 disabled:text-slate-400 cursor-not-allowed"
            disabled={sending}
            aria-describedby={fieldErrors.quantity ? 'quantity-error' : undefined}
          />
          {fieldErrors.quantity && submitted && (
            <p id="quantity-error" className="text-sm text-rose-600 mt-1" role="alert">
              {fieldErrors.quantity}
            </p>
          )}
        </div>
      )}

      <div>
        <label htmlFor="return-amount" className="block text-sm font-medium text-slate-700">
          Requested refund amount
        </label>
        <p className="text-xs text-slate-500 mb-2">
          Maximum refundable: {formatGhs(maxRefundAmount)}. You can request a partial refund.
        </p>
        <input
          id="return-amount"
          type="text"
          inputMode="decimal"
          defaultValue={requestedAmount}
          onChange={(e) => setRequestedAmount(e.target.value)}
          className="block w-full rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue disabled:bg-slate-50 disabled:text-slate-400 cursor-not-allowed"
          disabled={sending}
          aria-describedby={fieldErrors.amount ? 'amount-error' : undefined}
        />
        {fieldErrors.amount && submitted && (
          <p id="amount-error" className="text-sm text-rose-600 mt-1" role="alert">
            {fieldErrors.amount}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">
          You have {windowDays} days from delivery to open a return for this item. The seller has{' '}
          {vendorResponseHours} hours to respond. If the seller declines or does not respond, Dhream reviews the
          request.
        </p>
      </div>

      <div>
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={sending}>
          {sending ? 'Submitting...' : 'Request Return'}
        </Button>
      </div>
    </form>
  )
}
