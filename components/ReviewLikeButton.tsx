'use client'

import { useState } from 'react'
import { Button } from './Button'
import { Badge } from './Badge'

interface ReviewLikeButtonProps {
  reviewId: string
  initialLikes?: number
  userId?: string
}

export function ReviewLikeButton({ reviewId, initialLikes = 0, userId }: ReviewLikeButtonProps) {
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(initialLikes)

  const toggleLike = async () => {
    if (!userId) return

    try {
      const response = await fetch(`/api/products/${reviewId}/reviews/${reviewId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        setLiked(data.liked)
        setLikeCount((prev) => (data.liked ? prev + 1 : prev - 1))
      }
    } catch (error) {
      console.error('Error toggling review like:', error)
    }
  }

  return (
    <button
      onClick={toggleLike}
      className={`flex items-center gap-1 text-sm transition-colors ${liked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
      aria-label={liked ? 'Unlike review' : 'Like review'}
    >
      <svg className="w-4 h-4" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
      <span>{likeCount}</span>
    </button>
  )
}