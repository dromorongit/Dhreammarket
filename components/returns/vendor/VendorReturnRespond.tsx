'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'
import { ReturnConfirmStep } from '@/components/returns/vendor/ReturnConfirmStep'
import { parseAmountToPesewas, formatGhs, pesewasToGhsString } from '@/lib/returns/ui/amount'
import { confirmationText } from '@/lib/returns/ui/actions'
import { apiErrorToCopy } from '@/lib/returns/ui/errors'
import { reasonLabel } from '@/lib/returns/ui/reasons'
import { getSellerStatusCopy } from '@/lib/returns/ui/seller-copy'

interface VendorReturnRespondProps {
  returnId: string
  reason: string
  quantity: number
  amountPesewas: number
  deadline: string | null
  itemName: string
  itemImage: string | null
  refunds: Array<{ id: string; status: string; amount: number | string }>
}

type Mode =
  | 'summary'
  | 'accept'
  | 'acceptConfirm'
  | 'reject'
  | 'rejectConfirm'
  | 'success'
  | 'error'

const MAX_NOTE_LENGTH = 500

export function VendorReturnRespond({
  returnId,
  reason,
  quantity,
  amountPesewas,
  deadline,
  itemName,
  itemImage,
  refunds,
}: VendorReturnRespondProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('summary')
  const [amount, setAmount] = useState(pesewasToGhsString(amountPesewas))
  const [confirmAmountPesewas, setConfirmAmountPesewas] = useState<number | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [serverMessage, setServerMessage] = useState<{ message: string; action?: string } | null>(null)
  const [newStatus, setNewStatus] = useState<string | null>(null)

  const maxAmount = formatGhs(pesewasToGhsString(amountPesewas))
  const confirmOpen = mode === 'acceptConfirm' || mode === 'rejectConfirm'

  useEffect(() => {
    if (!confirmOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMode(mode === 'acceptConfirm' ? 'accept' : 'reject')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [confirmOpen, mode])

  const validateAmount = useCallback((): number | null => {
    setAmountError(null)
    const parsed = parseAmountToPesewas(amount, amountPesewas)
    if (parsed.kind === 'err') {
      setAmountError(parsed.error.message)
      return null
    }
    return parsed.pesewas
  }, [amount, amountPesewas])

  const postRespond = async (decision: 'APPROVE' | 'DENY', amountGhs: string, noteValue: string) => {
    setSending(true)
    setServerMessage(null)
    try {
      const response = await fetch(`/api/vendor/returns/${encodeURIComponent(returnId)}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          ...(decision === 'APPROVE' ? { amount: amountGhs } : { note: noteValue }),
        }),
      })
      let json: any = {}
      try {
        json = await response.json()
      } catch {
        /* ignore */
      }
      if (response.ok) {
        setNewStatus(json.returnRequest?.status ?? null)
        setMode('success')
        return
      }
      if (response.status === 409) {
        if (json.code === 'INVALID_AMOUNT' || json.code === 'ITEM_CAP_EXCEEDED') {
          setAmountError('The amount is more than can be refunded for this item. Enter a lower amount.')
          setMode('accept')
        } else {
          setServerMessage(apiErrorToCopy(409, json.code))
          setMode('error')
        }
        return
      }
      setServerMessage(apiErrorToCopy(response.status, json.code))
      setMode('error')
    } catch {
      setServerMessage({
        message: 'No internet connection.',
        action: 'Check your connection and try again.',
      })
      setMode('error')
    } finally {
      setSending(false)
    }
  }

  const handleAcceptContinue = () => {
    const pesewas = validateAmount()
    if (pesewas === null) return
    setConfirmAmountPesewas(pesewas)
    setMode('acceptConfirm')
  }

  const handleRejectContinue = () => {
    const trimmed = note.trim()
    const error =
      trimmed === ''
        ? 'A rejection note is required'
        : trimmed.length > MAX_NOTE_LENGTH
          ? `Maximum ${MAX_NOTE_LENGTH} characters`
          : null
    setNoteError(error)
    if (error !== null) return
    setMode('rejectConfirm')
  }

  const handleConfirm = async () => {
    if (mode === 'acceptConfirm') {
      await postRespond('APPROVE', pesewasToGhsString(confirmAmountPesewas ?? amountPesewas), '')
    } else {
      await postRespond('DENY', '', note.trim())
    }
  }

  const statusCopy = getSellerStatusCopy(newStatus ?? 'PENDING')

  return (
    <div className="space-y-6">
      <div>
        {itemImage && (
          <img
            src={itemImage}
            alt=""
            className="w-24 h-24 rounded-xl object-cover border border-slate-200 bg-slate-50 mb-4"
          />
        )}
        <h2 className="text-xl font-semibold text-deep-navy">{itemName}</h2>
        <p className="text-sm text-slate-500">
          {reasonLabel(reason)} \u00b7 {quantity} item{quantity !== 1 ? 's' : ''}
        </p>
        {deadline && (
          <p className="text-sm text-slate-500">
            Respond by:{' '}
            {new Date(deadline).toLocaleDateString('en-GH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </div>

      {mode === 'summary' && (
        <>
          <div className="rounded-2xl border border-slate-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-700">
              Accepting this return refunds the customer now ({maxAmount}) and the amount is deducted from your earnings.
            </p>
          </div>
          <div className="flex gap-3 sm:flex-col sm:w-full">
            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={sending}
              onClick={() => setMode('accept')}
            >
              {sending ? 'Working...' : 'Accept and refund'}
            </Button>
            <Button
              variant="danger"
              size="lg"
              fullWidth
              disabled={sending}
              onClick={() => setMode('reject')}
            >
              {sending ? 'Working...' : 'Reject'}
            </Button>
          </div>
        </>
      )}

      {mode === 'accept' && (
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">Refund amount</h3>
            <p className="text-xs text-slate-500 mb-3">
              Maximum refundable: {maxAmount}. Enter a partial amount or keep the maximum.
            </p>
            <Input
              label="Amount (GHS)"
              id="refund-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              error={amountError ?? undefined}
              className="w-full sm:w-48"
            />
            {amountError && (
              <p id="amount-error" className="text-sm text-rose-600 mt-1" role="alert">
                {amountError}
              </p>
            )}
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setMode('summary')} disabled={sending}>
              Back
            </Button>
            <Button variant="primary" onClick={handleAcceptContinue} disabled={sending || amountError !== null}>
              Review refund
            </Button>
          </div>
        </Card>
      )}

      {mode === 'reject' && (
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">Rejection note</h3>
            <p className="text-xs text-slate-500 mb-3">
              Explain why you are declining. The customer will not receive a refund.
            </p>
            <Textarea
              id="rejection-note"
              label="Note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              error={noteError ?? undefined}
              maxLength={MAX_NOTE_LENGTH}
            />
            {noteError && (
              <p id="note-error" className="text-sm text-rose-600 mt-1" role="alert">
                {noteError}
              </p>
            )}
          </div>
          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => setMode('summary')} disabled={sending}>
              Back
            </Button>
            <Button variant="primary" onClick={handleRejectContinue} disabled={sending || noteError !== null}>
              Review rejection
            </Button>
          </div>
        </Card>
      )}

      {confirmOpen && (
        <ReturnConfirmStep
          title={mode === 'acceptConfirm' ? 'Confirm refund' : 'Confirm rejection'}
          description={
            mode === 'acceptConfirm'
              ? confirmationText({
                  decision: 'APPROVE',
                  amountPesewas: confirmAmountPesewas ?? amountPesewas,
                  role: 'VENDOR',
                })
              : confirmationText({ decision: 'DENY', amountPesewas: null, role: 'VENDOR' })
          }
          confirmLabel={mode === 'acceptConfirm' ? 'Confirm refund' : 'Confirm rejection'}
          cancelLabel="Cancel"
          onConfirm={handleConfirm}
          onCancel={() => setMode(mode === 'acceptConfirm' ? 'accept' : 'reject')}
          sending={sending}
        />
      )}

      {mode === 'success' && (
        <Card className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
          <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold mb-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Return request updated</h3>
          <p className="text-sm text-slate-600 mb-6">
            {newStatus ? `Status: ${statusCopy.label}` : 'The return request was updated.'}
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/vendor/returns">Return to returns</Link>
            </Button>
            <Button onClick={() => router.refresh()} size="sm">
              Refresh
            </Button>
          </div>
        </Card>
      )}

      {mode === 'error' && serverMessage && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm text-rose-800">{serverMessage.message}</p>
          {serverMessage.action && (
            <p className="text-xs text-rose-600 mt-1">{serverMessage.action}</p>
          )}
          <div className="flex gap-3 mt-4">
            <Button onClick={() => router.refresh()} disabled={sending}>
              Refresh
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/vendor/returns">Return to returns</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
