'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'

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

const AUTO_PLAY_INTERVAL = 6000

export default function CarShowcaseCarousel() {
  const [current, setCurrent] = useState(0)
  const [isInteracting, setIsInteracting] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const dragStartX = useRef(0)
  const dragCurrentX = useRef(0)
  const isDragging = useRef(false)

  const goTo = useCallback((index: number) => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setCurrent(index)
    setTimeout(() => setIsTransitioning(false), 600)
  }, [isTransitioning])

  const next = useCallback(() => {
    goTo((current + 1) % SLIDES.length)
  }, [current, goTo])

  const prev = useCallback(() => {
    goTo((current - 1 + SLIDES.length) % SLIDES.length)
  }, [current, goTo])

  const clearAutoPlay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const startAutoPlay = useCallback(() => {
    clearAutoPlay()
    intervalRef.current = setInterval(next, AUTO_PLAY_INTERVAL)
  }, [clearAutoPlay, next])

  useEffect(() => {
    if (!isInteracting) {
      startAutoPlay()
    }
    return clearAutoPlay
  }, [isInteracting, startAutoPlay, clearAutoPlay])

  const handlePointerDown = (e: React.PointerEvent) => {
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
    }, 3000)
  }

  return (
    <section className="relative w-full bg-slate-900" aria-label="Car Showcase Carousel">
      <div
        className="relative w-full h-[220px] sm:h-[340px] md:h-[420px] lg:h-[460px] overflow-hidden select-none touch-pan-y"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {SLIDES.map((slide, index) => {
          const isActive = index === current
          return (
            <div
              key={slide.src}
            className={`absolute inset-0 transition-all duration-500 ease-premium ${
              isActive ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-105'
            }`}
              style={{ willChange: 'opacity' }}
              aria-hidden={!isActive}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                priority={index === 0}
                sizes="100vw"
                className="object-cover"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 to-transparent" />
            </div>
          )
        })}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {SLIDES.map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            className={`transition-all duration-300 ease-premium rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${
              index === current
                ? 'w-8 h-2.5 bg-white shadow-lg shadow-black/20'
                : 'w-2.5 h-2.5 bg-white/50 hover:bg-white/80'
            }`}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === current ? 'true' : 'false'}
          />
        ))}
      </div>
    </section>
  )
}
