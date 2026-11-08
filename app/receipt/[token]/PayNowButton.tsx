'use client'

import { useState } from 'react'
import { Button } from '@/components/Button'

interface PayNowButtonProps {
  token: string
  totalLabel: string
}

export default function PayNowButton({ token, totalLabel }: PayNowButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePay = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/receipt/${token}/pay`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Unable to start payment. Please try again.')
        return
      }
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl
        return
      }
      setError('Unable to start payment. Please try again.')
    } catch {
      setError('Unable to start payment. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="no-print mt-4">
      <Button fullWidth onClick={handlePay} loading={loading} disabled={loading} className="min-h-[48px]">
        Pay {totalLabel} now
      </Button>
      {error ? <p className="mt-2 text-sm text-rose-600 text-center">{error}</p> : null}
    </div>
  )
}
