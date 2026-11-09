'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface EditDocumentFormProps {
  document: {
    id: string
    slug: string
    title: string
    content: string
    intent: string
    status: string
  }
}

export function EditDocumentForm({ document }: EditDocumentFormProps): JSX.Element {
  const router = useRouter()
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    slug: document.slug,
    title: document.title,
    content: document.content,
    intent: document.intent,
  })

  useEffect(() => {
    setForm({ slug: document.slug, title: document.title, content: document.content, intent: document.intent })
  }, [document.slug, document.title, document.content, document.intent])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/support-documents/${document.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: form.slug.trim() || undefined,
          title: form.title.trim() || undefined,
          content: form.content,
          intent: form.intent.trim() || undefined,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; document?: any }
      if (!res.ok) {
        setMessage({ kind: 'error', text: body.error || 'Edit failed' })
        return
      }
      setMessage({ kind: 'success', text: 'Draft saved.' })
    } catch {
      setMessage({ kind: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded border border-gray-200 bg-white p-4 sm:p-6 shadow-sm max-w-xl">
      <div className="flex justify-between items-baseline gap-2">
        <label className="text-xs font-medium text-gray-700">Slug</label>
        <span className="text-xs text-gray-500 truncate max-w-xs">{document.id}</span>
      </div>
      <input
        name="slug"
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={form.slug}
        onChange={(e) => setForm({ ...form, slug: e.target.value })}
      />
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
        <input
          name="title"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Intent</label>
        <input
          name="intent"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.intent}
          onChange={(e) => setForm({ ...form, intent: e.target.value })}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Content</label>
        <textarea
          name="content"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
        />
      </div>
      <p className="text-xs text-gray-500">
        Only DRAFT documents can be edited. APPROVED/PUBLISHED content is immutable; create a new version instead.
      </p>
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
      <div className="flex gap-2 sm:flex-row">
        <button
          disabled={submitting}
          type="submit"
          className="px-4 py-2 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Saving...' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/support-docs')}
          className="px-4 py-2 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50"
        >
          Back
        </button>
      </div>
    </form>
  )
}
