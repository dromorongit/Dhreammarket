'use client'

import { useRouter, useState } from 'next/navigation'

interface CreateDocumentFormProps {}

export function CreateDocumentForm(): JSX.Element {
  const router = useRouter()
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ slug: '', title: '', content: '', intent: '' })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMessage(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/support-documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          slug: form.slug.trim(),
          title: form.title.trim(),
          content: form.content,
          intent: form.intent.trim(),
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; document?: any }
      if (!res.ok) {
        setMessage({ kind: 'error', text: body.error || 'Create failed' })
        return
      }
      setMessage({ kind: 'success', text: `Draft "${body.document.title}" created.` })
      setForm({ slug: '', title: '', content: '', intent: '' })
      router.push(`/admin/support-docs/${body.document.id}/edit`)
    } catch {
      setMessage({ kind: 'error', text: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded border border-gray-200 bg-white p-4 sm:p-6 shadow-sm max-w-xl">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Slug</label>
        <input
          name="slug"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
          placeholder="e.g. delivery-info"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
        <input
          name="title"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="e.g. Delivery times"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Intent</label>
        <input
          name="intent"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={form.intent}
          onChange={(e) => setForm({ ...form, intent: e.target.value })}
          placeholder="e.g. buyer.delivery_info"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Content</label>
        <textarea
          name="content"
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          minRows={8}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="Write the document content in plain text..."
        />
      </div>
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
          {submitting ? 'Creating...' : 'Create draft'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium rounded border border-gray-300 bg-white hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
