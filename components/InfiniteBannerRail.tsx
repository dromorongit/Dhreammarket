'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getBlurDataURL } from '@/lib/image-utils'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const BANNERS = [
  { id: 1, src: '/images/banner1.jpg', alt: 'Promotional Banner 1', href: '/marketplace' },
  { id: 2, src: '/images/banner2.jpg', alt: 'Promotional Banner 2', href: '/marketplace' },
  { id: 3, src: '/images/banner3.jpg', alt: 'Promotional Banner 3', href: '/marketplace' },
  { id: 4, src: '/images/banner4.jpg', alt: 'Promotional Banner 4', href: '/marketplace' },
]

export default function InfiniteBannerRail() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const isUserInteracting = useRef(false)
  const isProgrammaticRef = useRef(false)
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slideStepRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startAutoplay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      if (isUserInteracting.current) return
      setActiveIndex((prev) => {
        const next = (prev + 1) % BANNERS.length
        scrollToIndex(next)
        return next
      })
    }, 5000)
  }

  const stopAutoplay = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const checkScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    setCanScrollLeft(container.scrollLeft > 1)
    setCanScrollRight(container.scrollLeft + container.clientWidth < container.scrollWidth - 1)
  }, [])

  const measureStep = () => {
    const container = scrollRef.current
    if (!container) {
      slideStepRef.current = 0
      return
    }
    slideStepRef.current =
      container.clientWidth + (parseFloat(getComputedStyle(container).gap) || 0)
  }

  const scrollToIndex = (index: number) => {
    const container = scrollRef.current
    if (!container) return
    if (slideStepRef.current === 0) measureStep()
    const step = slideStepRef.current || container.clientWidth
    isProgrammaticRef.current = true
    container.scrollTo({ left: step * index, behavior: 'smooth' })
    setTimeout(() => {
      isProgrammaticRef.current = false
      checkScroll()
    }, 1000)
    setActiveIndex(index)
  }

  const handleArrowScroll = (direction: 'left' | 'right') => {
    stopAutoplay()
    isUserInteracting.current = true
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    resumeTimeoutRef.current = setTimeout(() => {
      isUserInteracting.current = false
      startAutoplay()
    }, 4000)

    const container = scrollRef.current
    if (!container) return
    const distance = container.clientWidth
    container.scrollBy({ left: direction === 'left' ? -distance : distance, behavior: 'smooth' })
    setTimeout(checkScroll, 500)
  }

  useEffect(() => {
    measureStep()
    checkScroll()
    startAutoplay()
    const onResize = () => {
      slideStepRef.current = 0
      measureStep()
      checkScroll()
    }
    window.addEventListener('resize', onResize)
    return () => {
      stopAutoplay()
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [checkScroll])

  const handleUserScroll = () => {
    if (isProgrammaticRef.current) return
    stopAutoplay()
    isUserInteracting.current = true
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    resumeTimeoutRef.current = setTimeout(() => {
      isUserInteracting.current = false
      startAutoplay()
    }, 4000)

    const container = scrollRef.current
    if (!container) return
    if (slideStepRef.current === 0) measureStep()
    const step = slideStepRef.current || container.clientWidth
    const newIndex = Math.round(container.scrollLeft / step)
    setActiveIndex(newIndex)
    checkScroll()
  }

  const handlePointerDown = () => {
    stopAutoplay()
    isUserInteracting.current = true
  }

  const handlePointerUp = () => {
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    isUserInteracting.current = false
    startAutoplay()
  }

  return (
    <section aria-label="Promotional banners">
      <div className='w-full relative'>
        <div
          ref={scrollRef}
          onScroll={handleUserScroll}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className='flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-0 w-full'
          style={{ scrollBehavior: 'smooth' }}
        >
          {BANNERS.map((banner, i) => (
            <div key={banner.id} className='flex-shrink-0 w-full snap-center relative aspect-[2/1]'>
              <Link href={banner.href} className="block w-full h-full" aria-label={banner.alt}>
                <Image src={banner.src} alt={banner.alt} fill priority={i === 0} className='object-contain' />
              </Link>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => handleArrowScroll('left')}
          disabled={!canScrollLeft}
          className="flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/90 shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700 disabled:opacity-0 transition-opacity"
          aria-label="Previous banner"
        >
          <FiChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => handleArrowScroll('right')}
          disabled={!canScrollRight}
          className="flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/90 shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700 disabled:opacity-0 transition-opacity"
          aria-label="Next banner"
        >
          <FiChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  )
}
