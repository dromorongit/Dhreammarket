'use client'

import Image from 'next/image'

interface StaticBannerImageProps {
  src?: string
  alt?: string
}

export default function StaticBannerImage({ src = '/images/stationery1.jpg', alt = 'Banner' }: StaticBannerImageProps) {
  return (
    <div className='w-full'>
      <div className='relative aspect-[16/9] bg-white'>
        <Image
          src={src}
          alt={alt}
          fill
          priority
          className='object-contain'
        />
      </div>
    </div>
  )
}
