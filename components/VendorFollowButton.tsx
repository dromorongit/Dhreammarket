'use client'

import { useState } from 'react'
import { Button } from './Button'
import { Badge } from './Badge'

interface VendorFollowButtonProps {
  vendorId: string
  initialFollowerCount?: number
}

export function VendorFollowButton({ vendorId, initialFollowerCount = 0 }: VendorFollowButtonProps) {
  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)

  const toggleFollow = async () => {
    try {
      const response = await fetch(`/api/vendors/${vendorId}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        setFollowing(data.followed)
        setFollowerCount((prev) => (data.followed ? prev + 1 : prev - 1))
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={following ? 'primary' : 'outline'}
        size="sm"
        onClick={toggleFollow}
      >
        {following ? 'Following' : 'Follow'}
      </Button>
      <span className="text-sm text-gray-500">{followerCount} followers</span>
    </div>
  )
}