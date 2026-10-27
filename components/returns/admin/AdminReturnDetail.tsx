'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'
import { ReturnConfirmStep } from '@/components/returns/vendor/ReturnConfirmStep'
import { ReturnStatusBadge } from '@/components/returns/ReturnStatusBadge'
import { ReturnTimeline } from '@/components/returns/ReturnTimeline'
import { parseAmountToPesewas, formatGhs, pesewasToGhsString } from '@/lib/returns/ui/amount'
import { confirmationText } from '@/lib/returns/ui/actions'
import { apiErrorToCopy } from '@/lib/returns/ui/errors'
import { reasonLabel } from '@/lib/returns/ui/reasons'
import { getSellerStatusCopy } from '@/lib/returns/ui/seller-copy'
import { adminQueue } from '@/lib/returns/ui/admin-copy'

interface AdminReturnDetailProps {
  returnId: string
  status: string
  reason: string
  quantity: number
  amountPesewas: number
  deadline: string | null
  itemName: string
  itemImage: string | null
  orderReference: string
  refund: { id: string; status: string; amount: number | string } | null
  events: Array<{ id: string; eventType: string; createdAt: string; createdBy: string | null }>
  isOverdue: boolean
}

type Mode =
  | 'summary'
  | 'approve'
  | 'approveConfirm'
  | 'deny'
  | 'denyConfirm'
  | 'success'
  | 'error'
  | 'conflict'

const MAX_NOTE_LENGTH = 500

function eventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    OPENED: 'Return request opened',
    VENDOR_ACCEPTED: 'Seller accepted the return',
    VENDOR_REJECTED: 'Seller rejected the return',
    ESCALATED: 'Escalated to Dhream',
    ADMIN_APPROVED: 'Dhream approved the return',
    ADMIN_DENIED: 'Dhream declined the return',
    RETURN_CLOSED: 'Return closed',
  }
  return map[type] ?? type.replace(/_/g, ' ')
}

function eventActor(createdBy: string | null): 'You' | 'Seller' | 'Dhream' | 'System' {
  if (!createdBy) return 'System'
  if (createdBy === 'customer') return 'You'
  if (createdBy === 'vendor') return 'Seller'
  return 'Dhream'
}

export function AdminReturnDetail({
  returnId,
  status,
  reason,
  quantity,
  amountPesewas,
  deadline,
  itemName,
  itemImage,
  orderReference,
  refund,
  events,
  isOverdue,
}: AdminReturnDetailProps) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('summary')
  const [amount, setAmount] = useState(pesewasToGhsString(amountPesewas))
  const [amountError, setAmountError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [serverMessage, setServerMessage] = useState<{ message: string; action?: string } | null>(null)
  const [newStatus, setNewStatus] = useState<string | null>(null)
  const [confirmAmountPesewas, setConfirmAmountPesewas] = useState<number | null>(null)

  const maxAmount = formatGhs(pesewasToGhsString(amountPesewas))
  const confirmOpen = mode === 'approveConfirm' || mode === 'denyConfirm'

  useEffect(() => {
    if (!confirmOpen) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMode(mode === 'approveConfirm' ? 'approve' : 'deny')
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

  const post = async (path: string, body?: any) => {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  const handleEscalate = async () => {
    setSending(true)
    setServerMessage(null)
    try {
      const response = await post(`/api/admin/return-decisions/${encodeURIComponent(returnId)}/escalate`)
      let json: any = {}
      try {
        json = await response.json()
      } catch {
        /* ignore */
      }
      if (response.ok) {
        setNewStatus(json.status ?? 'ESCALATED')
        setMode('success')
        return
      }
      setServerMessage(apiErrorToCopy(response.status, json.code))
      setMode('error')
    } catch {
      setServerMessage({ message: 'No internet connection.', action: 'Check your connection and try again.' })
      setMode('error')
    } finally {
      setSending(false)
    }
  }

  const handleApproveContinue = () => {
    const pesewas = validateAmount()
    if (pesewas === null) return
    setConfirmAmountPesewas(pesewas)
    setMode('approveConfirm')
  }

  const handleApproveConfirm = async () => {
    setSending(true)
    setServerMessage(null)
    try {
      const response = await post(`/api/admin/return-decisions/${encodeURIComponent(returnId)}`, {
        decision: 'APPROVE',
        amount: pesewasToGhsString(confirmAmountPesewas ?? amountPesewas),
      })
      let json: any = {}
      try {
        json = await response.json()
      } catch {
        /* ignore */
      }
      if (response.ok) {
        setNewStatus(json.returnRequest?.status ?? 'AWAITING_REFUND')
        setMode('success')
        return
      }
      setServerMessage(apiErrorToCopy(response.status, json.code))
      setMode('error')
    } catch {
      setServerMessage({ message: 'No internet connection.', action: 'Check your connection and try again.' })
      setMode('error')
    } finally {
      setSending(false)
    }
  }

  const handleDenyContinue = () => {
    const trimmed = note.trim()
    const error =
      trimmed === ''
        ? 'A rejection note is required'
        : trimmed.length > MAX_NOTE_LENGTH
          ? `Maximum ${MAX_NOTE_LENGTH} characters`
          : null
    setNoteError(error)
    if (error !== null) return
    setMode('denyConfirm')
  }

  const handleDenyConfirm = async () => {
    setSending(true)
    setServerMessage(null)
    try {
      const response = await post(`/api/admin/return-decisions/${encodeURIComponent(returnId)}`, {
        decision: 'DENY',
        note: note.trim(),
      })
      let json: any = {}
      try {
        json = await response.json()
      } catch {
        /* ignore */
      }
      if (response.ok) {
        setNewStatus(json.returnRequest?.status ?? 'REJECTED')
        setMode('success')
        return
      }
      setServerMessage(apiErrorToCopy(response.status, json.code))
      setMode('error')
    } catch {
      setServerMessage({ message: 'No internet connection.', action: 'Check your connection and try again.' })
      setMode('error')
    } finally {
      setSending(false)
    }
  }

  const handleClose = async () => {
    setSending(true)
    setServerMessage(null)
    try {
      const response = await post(`/api/admin/return-decisions/${encodeURIComponent(returnId)}/close`)
      let json: any = {}
      try {
        json = await response.json()
      } catch {
        /* ignore */
      }
      if (response.ok) {
        setNewStatus(json.returnRequest?.status ?? 'CLOSED')
        setMode('success')
        return
      }
      if (response.status === 409) {
        if (json.code === 'REFUND_NOT_PROCESSED') {
          setServerMessage({
            message: `The refund has not been processed yet (status: ${json.refundStatus ?? refund?.status ?? 'unknown'}).`,
            action: 'Wait for the refund to be processed before closing.',
          })
        } else if (json.code === 'NO_REFUND') {
          setServerMessage({ message: 'No linked refund exists for this return.', action: 'Approve the return first.' })
        }
        setMode('conflict')
        return
      }
      setServerMessage(apiErrorToCopy(response.status, json.code))
      setMode('error')
    } catch {
      setServerMessage({ message: 'No internet connection.', action: 'Check your connection and try again.' })
      setMode('error')
    } finally {
      setSending(false)
    }
  }

  const handleConfirm = async () => {
    if (mode === 'approveConfirm') {
      await handleApproveConfirm()
    } else {
      await handleDenyConfirm()
    }
  }

  const timelineEvents = events.map((event) => ({
    when: event.createdAt,
    actor: eventActor(event.createdBy),
    what: eventTypeLabel(event.eventType),
  }))

  const copy = getSellerStatusCopy(newStatus ?? status)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold text-deep-navy">{itemName}</h2>
          <p className="text-sm text-slate-500">
            {reasonLabel(reason)} \u00b7 {quantity} item{quantity !== 1 ? 's' : ''}
          </p>
          <p className="text-xs text-slate-500">{orderReference}</p>
        </div>
        <ReturnStatusBadge status={newStatus ?? status} />
      </div>

      {itemImage && (
        <img
          src={itemImage}
          alt=""
          className="w-24 h-24 rounded-xl object-cover border border-slate-200 bg-slate-50"
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Reference amount</p>
          <p className="text-sm font-medium text-slate-900">
            {formatGhs(pesewasToGhsString(amountPesewas))}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Refund</p>
          <p className="text-sm text-slate-900">
            {refund ? `${formatGhs(String(refund.amount))} - ${refund.status}` : 'No linked refund yet'}
          </p>
        </div>
        {deadline && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Respond by</p>
            <p className="text-sm font-medium text-slate-900">
              {new Date(deadline).toLocaleDateString('en-GH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Status</p>
          <p className="text-sm text-slate-900">{copy.description}</p>
        </div>
      </div>

      {mode === 'summary' && (
        <div className="flex flex-wrap gap-3">
          {isOverdue && status === 'PENDING' && (
            <Button variant="outline" disabled={sending} onClick={handleEscalate}>
              {sending ? 'Working...' : 'Escalate to Dhream'}
            </Button>
          )}
          {status === 'ESCALATED' && (
            <>
              <Button variant="primary" disabled={sending} onClick={() => setMode('approve')}>
                Approve refund
              </Button>
              <Button variant="danger" disabled={sending} onClick={() => setMode('deny')}>
                Deny
              </Button>
            </>
          )}
          {status === 'AWAITING_REFUND' && refund?.status === 'PROCESSED' && (
            <Button variant="outline" disabled={sending} onClick={handleClose}>
              {sending ? 'Working...' : 'Close return'}
            </Button>
          )}
        </div>
      )}

      {mode === 'approve' && (
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">Refund amount</h3>
            <p className="text-xs text-slate-500 mb-3">
              Maximum refundable: {maxAmount}. Enter a partial amount or keep the maximum.
            </p>
            <Input
              label="Amount (GHS)"
              id="approve-amount"
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
            <Button variant="primary" onClick={handleApproveContinue} disabled={sending || amountError !== null}>
              Review refund
            </Button>
          </div>
        </Card>
      )}

      {mode === 'deny' && (
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div>
            <h3 className="text-base font-semibold text-slate-900 mb-2">Rejection note</h3>
            <p className="text-xs text-slate-500 mb-3">
              Explain why the return is being declined. The customer will not receive a refund.
            </p>
            <Textarea
              id="denial-note"
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
            <Button variant="primary" onClick={handleDenyContinue} disabled={sending || noteError !== null}>
              Review rejection
            </Button>
          </div>
        </Card>
      )}

      {confirmOpen && (
        <ReturnConfirmStep
          title={mode === 'approveConfirm' ? 'Confirm refund' : 'Confirm rejection'}
          description={
            mode === 'approveConfirm'
              ? confirmationText({
                  decision: 'APPROVE',
                  amountPesewas: confirmAmountPesewas ?? amountPesewas,
                  role: 'ADMIN',
                })
              : confirmationText({ decision: 'DENY', amountPesewas: null, role: 'ADMIN' })
          }
          confirmLabel={mode === 'approveConfirm' ? 'Confirm refund' : 'Confirm rejection'}
          cancelLabel="Cancel"
          onConfirm={handleConfirm}
          onCancel={() => setMode(mode === 'approveConfirm' ? 'approve' : 'deny')}
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
            {newStatus ? `Status: ${newStatus.replace(/_/g, ' ')}` : 'The return request was updated.'}
          </p>
          <div className="flex gap-3">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/admin/returns">Return to queue</Link>
            </Button>
            <Button onClick={() => router.refresh()} size="sm">
              Refresh
            </Button>
          </div>
        </Card>
      )}

      {mode === 'conflict' && serverMessage && (
        <div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">{serverMessage.message}</p>
          {serverMessage.action && (
            <p className="text-xs text-amber-700 mt-1">{serverMessage.action}</p>
          )}
          <div className="flex gap-3 mt-4">
            <Button onClick={() => router.refresh()} disabled={sending}>
              Refresh
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard/admin/returns">Return to queue</Link>
            </Button>
          </div>
        </div>
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
              <Link href="/dashboard/admin/returns">Return to queue</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="pt-6 border-t border-slate-200">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Timeline</h3>
        <ReturnTimeline
          events={timelineEvents}
        />
      </div>
    </div>
  )
}
