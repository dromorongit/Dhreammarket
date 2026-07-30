'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from './Button'

interface ReviewImage {
  id: string
  url: string
  alt?: string | null
}

interface ReviewImagesProps {
  productId: string
  images: ReviewImage[]
  canEdit?: boolean
  onDelete?: (imageId: string) => void
}

export function ReviewImages({ productId, images, canEdit, onDelete }: ReviewImagesProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (imageId: string) => {
    setDeletingId(imageId)
    try {
      await fetch(`/api/products/${productId}/reviews/images/${imageId}`, { method: 'DELETE' })
      onDelete?.(imageId)
    } catch (error) {
      console.error('Error deleting review image:', error)
    } finally {
      setDeletingId(null)
    }
  }

  if (images.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-3">
      {images.map((image) => (
        <div key={image.id} className="relative aspect-square rounded-lg overflow-hidden group">
          <Image
            src={image.url}
            alt={image.alt || 'Review image'}
            className="object-cover w-full h-full"
            fill
            loading="lazy"
          />
          {canEdit && (
            <button
              onClick={() => handleDelete(image.id)}
              disabled={deletingId === image.id}
              className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  )
}