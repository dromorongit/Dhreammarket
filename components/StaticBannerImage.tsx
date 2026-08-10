'use client'

import Image from 'next/image'

export default function StaticBannerImage() {
  return (
    <div className='w-full'>
      <div className='relative aspect-[16/9] bg-white'>
        <Image
          src='/images/stationery1.jpg'
          alt='Stationery'
          fill
          priority
          className='object-contain'
        />
      </div>
    </div>
  )
}
