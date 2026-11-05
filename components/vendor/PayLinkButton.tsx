'use client'

import { useState } from 'react'
import { Button } from '@/components/Button'
import { buildWhatsAppShareLink, orderDisplayNumber } from '@/lib/manual-orders'

interface PayLinkButtonProps {
  orderId: string
  source: string
  paymentStatus: string
  status: string
  customerPhone?: string | null
}

const GENERIC_ERROR = 'Failed to create pay link. Please try again.'

const PAYLINK_ENABLED = process.env.NEXT_PUBLIC_PAYLINK_ENABLED === 'true'

export default function PayLinkButton({ orderId, source, paymentStatus, status, customerPhone }: PayLinkButtonProps) {
  const [loading, setLoading] = useState(false)
  const [payLink, setPayLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!PAYLINK_ENABLED) return null
  const eligible = source === 'MANUAL' && paymentStatus !== 'PAID' && status !== 'CANCELLED'
  if (!eligible) return null

  const handleCreate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/vendor/manual-orders/${orderId}/pay-link`, {
        method: 'POST',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 503) {
          setError('Pay links are not available yet')
        } else if (res.status === 409) {
          setError(data.error || 'Conflict creating pay link')
        } else {
          setError(GENERIC_ERROR)
        }
        return
      }
      setPayLink(data.authorizationUrl || data.receiptUrl || null)
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (!payLink) return
    navigator.clipboard.writeText(payLink)
  }

  const handleWhatsApp = () => {
    if (!payLink || !customerPhone) return
    const link = buildWhatsAppShareLink(customerPhone, payLink, `Pay for order #${orderDisplayNumber(orderId)}: ${payLink}`)
    window.open(link, '_blank')
  }

  if (payLink) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-600 break-all">{payLink}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} className="min-h-[44px] text-xs px-3">
            Copy link
          </Button>
          <Button variant="outline" size="sm" onClick={handleWhatsApp} disabled={!customerPhone} className="min-h-[44px] text-xs px-3">
            Share on WhatsApp
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        loading={loading}
        disabled={loading}
        onClick={handleCreate}
        className="min-h-[44px] text-xs px-3"
      >
        Send pay link
      </Button>
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
    </div>
  )
}
