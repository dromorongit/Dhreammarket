'use client'

import { useState } from 'react'
import { FiHeart } from 'react-icons/fi'
import { event } from '@/lib/gtag'

interface WishlistButtonProps {
  productId: string
  initialIsWishlisted?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

function dispatchWishlistUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('wishlist-updated'))
    localStorage.setItem('wishlist-updated', Date.now().toString())
  }
}

export default function WishlistButton({
  productId,
  initialIsWishlisted = false,
  size = 'md',
  className = '',
}: WishlistButtonProps) {
  const [isWishlisted, setIsWishlisted] = useState(initialIsWishlisted)
  const [loading, setLoading] = useState(false)

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (loading) return

    const previousState = isWishlisted

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('token='))
        ?.split('=')[1]

      if (!token) {
        window.location.href = '/login'
        return
      }

      setIsWishlisted(!previousState)
      setLoading(true)

      if (previousState) {
        const response = await fetch(`/api/wishlist/${productId}`, {
          method: 'DELETE',
        })

        if (response.status === 401) {
          setIsWishlisted(previousState)
          window.location.href = '/login'
          return
        }
      } else {
        const response = await fetch('/api/wishlist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ productId }),
        })

        if (response.status === 401) {
          setIsWishlisted(previousState)
          window.location.href = '/login'
          return
        }
        if (!response.ok) {
          setIsWishlisted(previousState)
          throw new Error('Failed to add to wishlist')
        }
        event({ action: 'add_to_wishlist', category: 'engagement', label: productId })
      }
      dispatchWishlistUpdate()
    } catch (error) {
      setIsWishlisted(previousState)
      console.error('Error toggling wishlist:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`${sizeClasses[size]} rounded-full bg-white/90 shadow-sm hover:bg-white transition-colors flex items-center justify-center ${className}`}
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <FiHeart
        className={`${iconSizes[size]} ${isWishlisted ? 'fill-red-500 text-red-500' : 'text-slate-400'}`}
      />
    </button>
  )
}