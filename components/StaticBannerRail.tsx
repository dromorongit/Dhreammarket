'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

const BANNERS = [
  { src: '/images/static1.jpg', alt: 'Kitchen Makeover Sale' },
  { src: '/images/static2.jpg', alt: 'Home Appliances Deals' },
  { src: '/images/static3.jpg', alt: 'Fashion Flash Sale' },
]

export default function StaticBannerRail() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const isUserInteracting = useRef(false)
  const isProgrammaticRef = useRef(false)
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const slideStepRef = useRef(0)

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
    }, 1000)
    setActiveIndex(index)
  }

  useEffect(() => {
    measureStep()
    const onResize = () => {
      slideStepRef.current = 0
      measureStep()
    }
    window.addEventListener('resize', onResize)
    const interval = setInterval(() => {
      if (isUserInteracting.current) return
      setActiveIndex((prev) => {
        const next = (prev + 1) % BANNERS.length
        scrollToIndex(next)
        return next
      })
    }, 2000)
    return () => {
      clearInterval(interval)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const handleUserScroll = () => {
    if (isProgrammaticRef.current) return
    isUserInteracting.current = true
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    resumeTimeoutRef.current = setTimeout(() => {
      isUserInteracting.current = false
    }, 4000)

    const container = scrollRef.current
    if (!container) return
    if (slideStepRef.current === 0) measureStep()
    const step = slideStepRef.current || container.clientWidth
    const newIndex = Math.round(container.scrollLeft / step)
    setActiveIndex(newIndex)
  }

  return (
    <div className='w-full relative'>
      <div
        ref={scrollRef}
        onScroll={handleUserScroll}
        className='flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-1 w-full'
        style={{ scrollBehavior: 'smooth' }}
      >
        {BANNERS.map((banner, i) => (
          <div key={banner.src} className='flex-shrink-0 w-full snap-center relative aspect-[3/1] md:aspect-[4/1] bg-white'>
            <Image src={banner.src} alt={banner.alt} fill priority={i === 0} className='object-contain' />
          </div>
        ))}
      </div>
    </div>
  )
}
