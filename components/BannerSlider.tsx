'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const BANNERS = [
  { id: 1, src: '/images/banner1.jpg', alt: 'Promotional Banner 1', href: '/marketplace' },
  { id: 2, src: '/images/banner2.jpg', alt: 'Promotional Banner 2', href: '/marketplace' },
  { id: 3, src: '/images/banner3.jpg', alt: 'Promotional Banner 3', href: '/marketplace' },
  { id: 4, src: '/images/banner4.jpg', alt: 'Promotional Banner 4', href: '/marketplace' },
]

const SLIDE_DURATION = 600
const PAUSE_DURATION = 3000
const TOTAL_ACTIVE = SLIDE_DURATION + PAUSE_DURATION + SLIDE_DURATION
const CYCLE_DURATION = TOTAL_ACTIVE * BANNERS.length

export default function BannerSlider() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const isDesktopRef = useRef(true)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const checkDesktop = () => {
      isDesktopRef.current = window.matchMedia('(hover: hover)').matches
    }
    checkDesktop()
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

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
    <>
      <style>{`
        @keyframes bannerSlide {
          0% { transform: translateX(100%); }
          ${(SLIDE_DURATION / CYCLE_DURATION * 100).toFixed(2)}% { transform: translateX(0); }
          ${((SLIDE_DURATION + PAUSE_DURATION) / CYCLE_DURATION * 100).toFixed(2)}% { transform: translateX(0); }
          ${(TOTAL_ACTIVE / CYCLE_DURATION * 100).toFixed(2)}% { transform: translateX(-100%); }
          100% { transform: translateX(-100%); }
        }
        .banner-slide {
          animation: bannerSlide ${CYCLE_DURATION}ms ease-in-out infinite;
          will-change: transform;
        }
      `}</style>
      <section
        className="relative py-6 lg:py-8 bg-slate-50"
        aria-label="Promotional banners"
        onMouseEnter={() => { if (isDesktopRef.current) setIsHovered(true) }}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl overflow-hidden shadow-premium-xl bg-slate-200 aspect-video">
            {BANNERS.map((banner, index) => {
              const delay = -(CYCLE_DURATION - index * TOTAL_ACTIVE)
              const isFirst = index === 0

              return (
                <div
                  key={banner.id}
                  className="banner-slide absolute inset-0"
                  style={{
                    animationDelay: `${delay}ms`,
                    animationPlayState: isHovered ? 'paused' : 'running',
                  }}
                >
                  <Link href={banner.href} className="block w-full h-full" aria-label={banner.alt}>
                    <Image
                      src={banner.src}
                      alt={banner.alt}
                      className="object-cover w-full h-full"
                      fill
                      loading={isFirst ? 'eager' : 'lazy'}
                      sizes="100vw"
                    />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </>
  )
}