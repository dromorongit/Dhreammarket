'use client'

import { useState } from 'react'
import { Button } from './Button'
import { Input } from './Input'
import { Textarea } from './Textarea'

interface ReviewReportFormProps {
  productId: string
  reviewId: string
  onReported?: () => void
}

export function ReviewReportForm({ productId, reviewId, onReported }: ReviewReportFormProps) {
  const [showForm, setShowForm] = useState(false)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch(`/api/products/${productId}/reviews/${reviewId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, comment }),
      })

      if (response.ok) {
        onReported?.()
        setShowForm(false)
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to report review')
      }
    } catch (error) {
      console.error('Error reporting review:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="text-xs text-gray-500 hover:text-red-500 transition-colors"
      >
        Report this review
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-2">
      <Input
        placeholder="Reason for reporting"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        required
      />
      <Textarea
        placeholder="Additional details (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Report'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}