'use client'

import Image from 'next/image'
import Link from 'next/link'

const BANNERS = [
  { id: 1, src: '/images/banner1.jpg', alt: 'Promotional Banner 1', href: '/marketplace' },
  { id: 2, src: '/images/banner2.jpg', alt: 'Promotional Banner 2', href: '/marketplace' },
  { id: 3, src: '/images/banner3.jpg', alt: 'Promotional Banner 3', href: '/marketplace' },
  { id: 4, src: '/images/banner4.jpg', alt: 'Promotional Banner 4', href: '/marketplace' },
]

export default function InfiniteBannerRail() {
  const duplicatedBanners = [...BANNERS, ...BANNERS]

  return (
    <section className="relative py-4 lg:py-6 bg-slate-50 overflow-hidden" aria-label="Promotional banners">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl overflow-hidden bg-slate-200 rail-container">
          <div className="rail-track">
            {duplicatedBanners.map((banner, index) => (
              <div key={`${banner.id}-${index}`} className="flex-[0_0_auto] min-w-0 relative">
                <Link href={banner.href} className="block relative aspect-video" aria-label={banner.alt}>
                  <Image
                    src={banner.src}
                    alt={banner.alt}
                    className="object-cover w-full h-full"
                    fill
                    loading="eager"
                    sizes="100vw"
                  />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}