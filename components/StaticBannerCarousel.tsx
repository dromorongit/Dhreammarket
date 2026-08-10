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

const EXTENDED_SLIDES = [...SLIDES, SLIDES[0]]

export default function StaticBannerCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isInteracting, setIsInteracting] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef(0)
  const dragCurrentX = useRef(0)
  const isDragging = useRef(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
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
      handleNext()
    }, AUTO_PLAY_INTERVAL)
  }, [clearAutoPlay])

  useEffect(() => {
    if (!isInteracting && containerWidth > 0) {
      startAutoPlay()
    }
    return clearAutoPlay
  }, [isInteracting, startAutoPlay, clearAutoPlay, containerWidth])

  const handleNext = useCallback(() => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => prev + 1)
  }, [isTransitioning])

  const handlePrev = useCallback(() => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setCurrentIndex((prev) => prev - 1)
  }, [isTransitioning])

  const handleTransitionEnd = useCallback(() => {
    setIsTransitioning(false)
    setCurrentIndex((prev) => {
      if (prev >= SLIDES.length) {
        return 0
      }
      if (prev < 0) {
        return SLIDES.length - 1
      }
      return prev
    })
  }, [])

  const translateX = currentIndex * containerWidth

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
        handleNext()
      } else {
        handlePrev()
      }
    }
    setTimeout(() => {
      setIsInteracting(false)
      startAutoPlay()
    }, 2000)
  }

  return (
    <section className="relative py-3 bg-slate-50 overflow-hidden" aria-label="Static promotional banners">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          ref={containerRef}
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
              transform: `translateX(-${translateX}px)`,
              transition: isTransitioning
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
                  priority={index === 0}
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
