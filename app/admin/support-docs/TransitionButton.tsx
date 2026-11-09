'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface TransitionButtonProps {
  documentId: string
  currentStatus: string
  targets: string[]
}

export function TransitionButton({
  documentId,
  currentStatus,
  targets,
}: TransitionButtonProps) {
  const router = useRouter()
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const handleTransition = async (target: string) => {
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/support-documents/${documentId}/transition`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: target }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
      if (!res.ok) {
        setMessage({ kind: 'error', text: body.error || `Transition to ${target} failed` })
        return
      }
      setMessage({ kind: 'success', text: body.message || `Document ${target.toLowerCase()}` })
      router.refresh()
    } catch {
      setMessage({ kind: 'error', text: 'Network error. Please try again.' })
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
      {message && (
        <p
          className={`text-xs rounded border px-2 py-1.5 ${
            message.kind === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </p>
      )}
      {targets.map((target) => (
        <button
          key={target}
          onClick={() => handleTransition(target)}
          disabled={currentStatus === target}
          className="px-3 py-1.5 text-xs font-medium rounded border transition-colors hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
        >
          {target.toLowerCase()}
        </button>
      ))}
    </div>
  )
}
