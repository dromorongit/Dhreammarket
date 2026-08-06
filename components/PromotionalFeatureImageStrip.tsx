'use client'

import Image from 'next/image'
import { getBlurDataURL } from '@/lib/image-utils'

const PROMO_IMAGES = [
  { id: 1, src: '/images/discount.jpg', alt: 'Discount offers' },
  { id: 2, src: '/images/delivery.jpg', alt: 'Fast delivery' },
  { id: 3, src: '/images/call.jpg', alt: 'Customer support' },
  { id: 4, src: '/images/sales.jpg', alt: 'Sales and deals' },
]

export default function PromotionalFeatureImageStrip() {
  return (
    <section className="relative py-3 sm:py-4" aria-label="Promotional features">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-lg mx-auto">
          {PROMO_IMAGES.map((img) => (
            <div key={img.id} className="relative aspect-square">
              <Image
                src={img.src}
                alt={img.alt}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 20vw, 25vw"
                placeholder="blur"
                blurDataURL={getBlurDataURL()}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
