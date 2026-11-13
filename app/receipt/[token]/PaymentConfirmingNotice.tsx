'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const MAX_REFRESHES = 10
const INTERVAL_MS = 3000

export default function PaymentConfirmingNotice() {
  const router = useRouter()
  const count = useRef(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) return
    const id = setInterval(() => {
      count.current += 1
      if (count.current >= MAX_REFRESHES) {
        setDone(true)
        return
      }
      router.refresh()
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [done])

  if (done) {
    return (
      <p className="text-sm text-rose-600">
        Still confirming. If you were charged, please contact the seller.
      </p>
    )
  }

  return <p className="text-sm text-gray-600">Confirming your payment…</p>
}
