'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi'

const SLIDES = [
  { src: '/images/car1.jpg', alt: 'Car Showcase 1' },
  { src: '/images/car2.jpg', alt: 'Car Showcase 2' },
  { src: '/images/car3.jpg', alt: 'Car Showcase 3' },
  { src: '/images/car4.jpg', alt: 'Car Showcase 4' },
  { src: '/images/car5.jpg', alt: 'Car Showcase 5' },
  { src: '/images/car6.jpg', alt: 'Car Showcase 6' },
  { src: '/images/car7.jpg', alt: 'Car Showcase 7' },
  { src: '/images/car8.jpg', alt: 'Car Showcase 8' },
  { src: '/images/car9.jpg', alt: 'Car Showcase 9' },
  { src: '/images/car10.jpg', alt: 'Car Showcase 10' },
  { src: '/images/car11.jpg', alt: 'Car Showcase 11' },
]

export default function CarShowcaseCarousel() {
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

  const handleArrowScroll = (direction: 'left' | 'right') => {
    const container = scrollRef.current
    if (!container) return
    isUserInteracting.current = true
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current)
    resumeTimeoutRef.current = setTimeout(() => {
      isUserInteracting.current = false
    }, 4000)

    const distance = container.clientWidth
    container.scrollBy({ left: direction === 'left' ? -distance : distance, behavior: 'smooth' })
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
        const next = (prev + 1) % SLIDES.length
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
    <section className="relative w-full" aria-label="Car Showcase Carousel">
      <div className="w-full relative">
        <div
          ref={scrollRef}
          onScroll={handleUserScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-0 w-full"
          style={{ scrollBehavior: 'smooth' }}
        >
          {SLIDES.map((slide, i) => (
            <div
              key={slide.src}
              className="flex-shrink-0 w-full snap-center relative aspect-[16/9] bg-white"
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-contain"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => handleArrowScroll('left')}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
          aria-label="Previous slide"
        >
          <FiChevronLeft className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => handleArrowScroll('right')}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/90 shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700"
          aria-label="Next slide"
        >
          <FiChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  )
}
