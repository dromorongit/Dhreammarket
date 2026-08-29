'use client'

import Link from 'next/link'
import Image from 'next/image'
import { FaBullhorn } from 'react-icons/fa'

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
  return ad ? (
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
  ) : (
    <Link
      href="https://wa.me/447869840464"
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <div className="w-full h-24 sm:h-32 md:h-40 lg:h-48 rounded-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col items-center justify-center text-center px-4 transition-all duration-200 group-hover:scale-[1.01] group-hover:border-blue-400 group-hover:shadow-sm cursor-pointer">
        <FaBullhorn className="text-3xl sm:text-4xl text-gray-400 group-hover:text-blue-500 transition-colors mb-2" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">
          Advertise Here
        </h3>
        <p className="text-xs sm:text-sm text-gray-500 group-hover:text-blue-500 transition-colors max-w-xs">
          Reach thousands of shoppers — get your brand featured on this spot
        </p>
      </div>
    </Link>
  )
}
