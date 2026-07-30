'use client'

import useEmblaCarousel from 'embla-carousel-react'
import autoplay from 'embla-carousel-autoplay'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const BANNERS = [
  { id: 1, src: '/images/banner1.jpg', alt: 'Promotional Banner 1', href: '/marketplace' },
  { id: 2, src: '/images/banner2.jpg', alt: 'Promotional Banner 2', href: '/marketplace' },
  { id: 3, src: '/images/banner3.jpg', alt: 'Promotional Banner 3', href: '/marketplace' },
  { id: 4, src: '/images/banner4.jpg', alt: 'Promotional Banner 4', href: '/marketplace' },
]

const AUTOPLAY_DELAY = 3000
const TRANSITION_DURATION = 700

export default function BannerSlider() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [emblaRef] = useEmblaCarousel(
    {
      align: 'center',
      containScroll: 'trimSnaps',
      dragFree: false,
      loop: true,
      skipSnaps: false,
      slidesToScroll: 1,
      watchDrag: false,
    },
    [
        autoplay({
        delay: AUTOPLAY_DELAY,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        playOnInit: true,
      }),
    ]
  )

  if (prefersReducedMotion) {
    return (
      <section className="relative py-6 lg:py-8 bg-slate-50" aria-label="Promotional banners">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl overflow-hidden shadow-premium-xl bg-slate-200 aspect-video">
            <Image
              src={BANNERS[0].src}
              alt={BANNERS[0].alt}
              className="object-cover w-full h-full"
              fill
              priority
            />
            <Link href={BANNERS[0].href} className="absolute inset-0" aria-label={BANNERS[0].alt} />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-6 lg:py-8 bg-slate-50" aria-label="Promotional banners">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-2xl overflow-hidden shadow-premium-xl bg-slate-200 aspect-video">
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {BANNERS.map((banner) => (
                <div
                  key={banner.id}
                  className="flex-[0_0_100%] min-w-0 relative"
                  style={{ transition: `transform ${TRANSITION_DURATION}ms ease-in-out` }}
                >
                  <Link href={banner.href} className="block w-full h-full" aria-label={banner.alt}>
                    <Image
                      src={banner.src}
                      alt={banner.alt}
                      className="object-cover w-full h-full"
                      fill
                      loading={banner.id === 1 ? 'eager' : 'lazy'}
                      sizes="100vw"
                    />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}