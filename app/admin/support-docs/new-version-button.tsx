'use client'

import { useRouter, useState } from 'next/navigation'

interface NewVersionButtonProps {
  documentId: string
  documentSlug: string
  documentTitle: string
  documentStatus: string
}

export function NewVersionButton({
  documentId,
  documentSlug,
  documentTitle,
  documentStatus,
}: NewVersionButtonProps) {
  const router = useRouter()
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const handleNewVersion = async () => {
    setMessage(null)
    try {
      const res = await fetch(`/api/admin/support-documents/${documentId}/new-version`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; document?: any }
      if (!res.ok) {
        setMessage({ kind: 'error', text: body.error || 'New version failed' })
        return
      }
      setMessage({ kind: 'success', text: `New draft "${body.document.title}" v${body.document.version} created.` })
      router.push(`/admin/support-docs/${body.document.id}/edit`)
    } catch {
      setMessage({ kind: 'error', text: 'Network error. Please try again.' })
    }
  }

  const active = documentStatus === 'APPROVED' || documentStatus === 'PUBLISHED'

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
      {active ? (
        <button
          disabled={!active}
          onClick={handleNewVersion}
          className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          New version
        </button>
      ) : (
        <span className="text-xs text-gray-500">Not versionable</span>
      )}
    </div>
  )
}
