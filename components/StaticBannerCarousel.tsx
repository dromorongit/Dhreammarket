'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { getBlurDataURL, HERO_IMAGE_SIZES } from '@/lib/image-utils'

const SLIDES = [
  { id: 1, src: '/images/static1.jpg', alt: 'Promotional Banner 1' },
  { id: 2, src: '/images/static2.jpg', alt: 'Promotional Banner 2' },
  { id: 3, src: '/images/static3.jpg', alt: 'Promotional Banner 3' },
]

const AUTO_PLAY_INTERVAL = 2000
const TRANSITION_DURATION = 500

const EXTENDED_SLIDES = [
  SLIDES[SLIDES.length - 1],
  ...SLIDES,
  SLIDES[0],
]

export default function StaticBannerCarousel() {
  const [trackIndex, setTrackIndex] = useState(1)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [useTransition, setUseTransition] = useState(true)
  const [isInteracting, setIsInteracting] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const trackIndexRef = useRef(1)
  const dragStartX = useRef(0)
  const dragCurrentX = useRef(0)
  const isDragging = useRef(false)

  useEffect(() => {
    trackIndexRef.current = trackIndex
  }, [trackIndex])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  const clearAutoPlay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startAutoPlay = useCallback(() => {
    clearAutoPlay()
    intervalRef.current = setInterval(() => {
      setTrackIndex((prev) => prev + 1)
    }, AUTO_PLAY_INTERVAL)
  }, [clearAutoPlay])

  useEffect(() => {
    if (!isInteracting) {
      startAutoPlay()
    }
    return clearAutoPlay
  }, [isInteracting, startAutoPlay, clearAutoPlay])

  const handleTransitionEnd = useCallback(() => {
    setIsTransitioning(false)
    setUseTransition(false)
    const current = trackIndexRef.current
    if (current === 0) {
      setTrackIndex(SLIDES.length)
    } else if (current === SLIDES.length + 1) {
      setTrackIndex(1)
    }
    requestAnimationFrame(() => setUseTransition(true))
  }, [])

  const goTo = useCallback((index: number) => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setTrackIndex(index)
  }, [isTransitioning])

  const next = useCallback(() => {
    goTo(trackIndexRef.current + 1)
  }, [goTo])

  const prev = useCallback(() => {
    goTo(trackIndexRef.current - 1)
  }, [goTo])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isTransitioning) return
    setIsInteracting(true)
    clearAutoPlay()
    dragStartX.current = e.clientX
    dragCurrentX.current = e.clientX
    isDragging.current = true
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    dragCurrentX.current = e.clientX
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return
    isDragging.current = false
    const diff = dragStartX.current - dragCurrentX.current
    const threshold = 50
    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        next()
      } else {
        prev()
      }
    }
    setTimeout(() => {
      setIsInteracting(false)
      startAutoPlay()
    }, 2000)
  }

  return (
    <section className="relative py-5 bg-slate-50 overflow-hidden" aria-label="Static promotional banners">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="relative rounded-3xl overflow-hidden bg-slate-900 shadow-premium-xl select-none touch-pan-y"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="flex"
            style={{
              transform: `translateX(-${trackIndex * 100}%)`,
              transition: useTransition
                ? `transform ${prefersReducedMotion ? 0 : TRANSITION_DURATION}ms ease-in-out`
                : 'none',
            }}
            onTransitionEnd={handleTransitionEnd}
          >
            {EXTENDED_SLIDES.map((slide, index) => (
              <div
                key={index}
                className="w-full flex-shrink-0 relative"
                style={{ aspectRatio: '2/1' }}
              >
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  priority={index === 1}
                  sizes={HERO_IMAGE_SIZES}
                  placeholder="blur"
                  blurDataURL={getBlurDataURL()}
                  className="object-cover"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
