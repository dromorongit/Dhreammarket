'use client'

import Link from 'next/link'
import Image from 'next/image'

interface Advertisement {
  id: string
  slot: string
  title: string
  imageUrl: string
  linkUrl: string
  vendorId: string | null
  productId: string | null
  startDate: string
  endDate: string
  isActive: boolean
}

interface AdSlotProps {
  ad: Advertisement | null
}

export default function AdSlot({ ad }: AdSlotProps) {
  if (!ad) return null

  return (
    <div className="w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href={ad.linkUrl} className="block">
          <div className="relative w-full h-24 sm:h-32 md:h-40 lg:h-48 rounded-xl overflow-hidden">
            <Image
              src={ad.imageUrl}
              alt={ad.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        </Link>
      </div>
    </div>
  )
}
