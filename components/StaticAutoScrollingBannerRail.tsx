'use client'

import Image from 'next/image'
import { getBlurDataURL, HERO_IMAGE_SIZES } from '@/lib/image-utils'

const STATIC_BANNERS = [
  { id: 1, src: '/images/static1.jpg', alt: 'Static Banner 1' },
  { id: 2, src: '/images/static2.jpg', alt: 'Static Banner 2' },
  { id: 3, src: '/images/static3.jpg', alt: 'Static Banner 3' },
]

export default function StaticAutoScrollingBannerRail() {
  const duplicatedBanners = [...STATIC_BANNERS, ...STATIC_BANNERS]

  return (
    <section className="relative py-5 bg-slate-50 overflow-hidden" aria-label="Static promotional banners">
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-premium-xl rail-container">
        <div className="rail-track static-banner-rail-track">
          {duplicatedBanners.map((banner, index) => (
            <div
              key={`${banner.id}-${index}`}
              className="banner-item flex-[0_0_320px] h-[140px] sm:flex-[0_0_420px] sm:h-[180px] lg:flex-[0_0_520px] lg:h-[220px] relative overflow-hidden"
            >
              <Image
                src={banner.src}
                alt={banner.alt}
                className="object-cover w-full h-full"
                fill
                loading="lazy"
                sizes={HERO_IMAGE_SIZES}
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
