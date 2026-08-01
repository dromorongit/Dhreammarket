'use client'

import Image from 'next/image'
import Link from 'next/link'
import { getBlurDataURL, HERO_IMAGE_SIZES } from '@/lib/image-utils'

const BANNERS = [
  { id: 1, src: '/images/banner1.jpg', alt: 'Promotional Banner 1', href: '/marketplace' },
  { id: 2, src: '/images/banner2.jpg', alt: 'Promotional Banner 2', href: '/marketplace' },
  { id: 3, src: '/images/banner3.jpg', alt: 'Promotional Banner 3', href: '/marketplace' },
  { id: 4, src: '/images/banner4.jpg', alt: 'Promotional Banner 4', href: '/marketplace' },
]

export default function InfiniteBannerRail() {
  const duplicatedBanners = [...BANNERS, ...BANNERS]

  return (
    <section className="relative py-5 bg-slate-50 overflow-hidden" aria-label="Promotional banners">
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-premium-xl rail-container">
        <div className="rail-track banner-rail-track">
          {duplicatedBanners.map((banner, index) => (
            <div
              key={`${banner.id}-${index}`}
              className="banner-item flex-[0_0_320px] h-[140px] sm:flex-[0_0_420px] sm:h-[180px] lg:flex-[0_0_520px] lg:h-[220px] relative overflow-hidden"
            >
              <Link href={banner.href} className="block w-full h-full" aria-label={banner.alt}>
                <Image
                  src={banner.src}
                  alt={banner.alt}
                  className="object-cover w-full h-full"
                  fill
                  loading="eager"
                  sizes={HERO_IMAGE_SIZES}
                  placeholder="blur"
                  blurDataURL={getBlurDataURL()}
                />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}