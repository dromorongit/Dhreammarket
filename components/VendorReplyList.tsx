'use client'

import { useState } from 'react'
import { Button } from './Button'
import { Badge } from './Badge'
import { StarRating } from './StarRating'

interface VendorReplyListProps {
  reviewId: string
}

export function VendorReplyList({ reviewId }: VendorReplyListProps) {
  const [replies, setReplies] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchReplies = async () => {
    try {
      const response = await fetch(`/api/products/${reviewId}/reviews/${reviewId}/vendor-reply`)
      if (response.ok) {
        const data = await response.json()
        setReplies(data.replies || [])
      }
    } catch (error) {
      console.error('Error fetching vendor replies:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch(`/api/products/${reviewId}/reviews/${reviewId}/vendor-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })

      if (response.ok) {
        setMessage('')
        setShowForm(false)
        fetchReplies()
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to post reply')
      }
    } catch (error) {
      console.error('Error posting vendor reply:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {replies.map((reply) => (
        <div key={reply.id} className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900">
              {reply.vendor?.profile?.firstName || 'Vendor'}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(reply.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-gray-700">{reply.message}</p>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your reply..."
            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
            rows={3}
            required
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? 'Posting...' : 'Post Reply'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          Write a Reply
        </Button>
      )}
    </div>
  )
}