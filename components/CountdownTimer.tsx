'use client'

import { useEffect, useState } from 'react'
import { FiClock } from 'react-icons/fi'

interface CountdownTimerProps {
  endDate: Date | string
  onExpire?: () => void
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'Deal Ended'

  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days.toString().padStart(2, '0')}d ${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
  }

  return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`
}

export default function CountdownTimer({ endDate, onExpire }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => {
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate
    return Math.max(0, end.getTime() - Date.now())
  })

  useEffect(() => {
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate
    const initialRemaining = Math.max(0, end.getTime() - Date.now())

    if (initialRemaining <= 0) {
      onExpire?.()
      return
    }

    setRemaining(initialRemaining)

    const interval = setInterval(() => {
      const now = Date.now()
      const left = end.getTime() - now

      if (left <= 0) {
        setRemaining(0)
        clearInterval(interval)
        onExpire?.()
        return
      }

      setRemaining(left)
    }, 1000)

    return () => clearInterval(interval)
  }, [endDate, onExpire])

  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 bg-gray-500/90 text-white text-xs font-bold px-2 py-1 rounded-md">
        <FiClock className="w-3 h-3" />
        Deal Ended
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 bg-black/80 text-white text-xs font-bold px-2 py-1 rounded-md">
      <FiClock className="w-3 h-3" />
      {formatRemaining(remaining)}
    </span>
  )
}
