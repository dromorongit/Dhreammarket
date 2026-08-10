'use client'

import Image from 'next/image'
import { getBlurDataURL } from '@/lib/image-utils'

const PROMO_IMAGES = [
  { id: 1, src: '/images/discount.jpg', alt: 'Discount offers', caption: 'Discounts up to 40%' },
  { id: 2, src: '/images/delivery.jpg', alt: 'Fast delivery', caption: 'Fast Seamless Deliveries' },
  { id: 3, src: '/images/call.jpg', alt: 'Customer support', caption: 'Call to Order' },
  { id: 4, src: '/images/sales.jpg', alt: 'Sales and deals', caption: 'Make More Sales on Dhream Market' },
]

export default function PromotionalFeatureImageStrip() {
  return (
     <section className="relative py-2 sm:py-3" aria-label="Promotional features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-lg mx-auto">
          {PROMO_IMAGES.map((img) => (
            <div key={img.id} className="flex flex-col items-center">
              <div className="relative aspect-square w-full rounded-none">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  className="object-cover rounded-none"
                  sizes="(max-width: 640px) 20vw, 25vw"
                  placeholder="blur"
                  blurDataURL={getBlurDataURL()}
                />
              </div>
              <p className="mt-1.5 text-[11px] sm:text-xs font-semibold text-center text-slate-700 leading-tight px-0.5">
                {img.caption}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
