'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const BANNERS = [
  { id: 1, src: '/images/banner1.jpg', alt: 'Promotional Banner 1', href: '/marketplace' },
  { id: 2, src: '/images/banner2.jpg', alt: 'Promotional Banner 2', href: '/marketplace' },
  { id: 3, src: '/images/banner3.jpg', alt: 'Promotional Banner 3', href: '/marketplace' },
  { id: 4, src: '/images/banner4.jpg', alt: 'Promotional Banner 4', href: '/marketplace' },
]

const PAUSE_DURATION = 3000
const TRANSITION_DURATION = 800

const DUPLICATED = [...BANNERS, ...BANNERS]

export default function InfiniteBannerRail() {
  const containerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const isHoveredRef = useRef(false)
  const positionRef = useRef(0)
  const containerWidthRef = useRef(0)
  const animRunningRef = useRef(false)
  const isPausedRef = useRef(false)
  const lastPauseIndexRef = useRef(0)
  const sleepTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    isHoveredRef.current = isHovered
  }, [isHovered])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateContainerWidth = () => {
      containerWidthRef.current = container.offsetWidth
    }
    updateContainerWidth()

    let resizeTimeout: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(updateContainerWidth, 100)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimeout)
    }
  }, [])

  useEffect(() => {
    if (prefersReducedMotion) return

    const container = containerRef.current
    const track = trackRef.current
    if (!container || !track) return

    containerWidthRef.current = container.offsetWidth
    positionRef.current = 0
    animRunningRef.current = true
    isPausedRef.current = true
    lastPauseIndexRef.current = 0
    lastTimeRef.current = performance.now()

    const clearAllTimeouts = () => {
      sleepTimeoutsRef.current.forEach((id) => clearTimeout(id))
      sleepTimeoutsRef.current = []
    }

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = setTimeout(resolve, ms)
        sleepTimeoutsRef.current.push(id)
      })

    const setTransform = (pos: number) => {
      positionRef.current = pos
      track.style.transform = `translateX(${pos}px)`
    }

    const W = containerWidthRef.current
    const speed = W / TRANSITION_DURATION

    let isCancelled = false

    const loop = () => {
      if (!animRunningRef.current || isCancelled) return

      rafRef.current = requestAnimationFrame(loop)

      if (isPausedRef.current || isHoveredRef.current) return

      const now = performance.now()
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now

      const currentW = containerWidthRef.current
      const currentSpeed = currentW / TRANSITION_DURATION
      const newPos = positionRef.current - currentSpeed * delta

      const currentPauseIndex = Math.floor(-newPos / currentW)

      if (currentPauseIndex > lastPauseIndexRef.current && currentPauseIndex < BANNERS.length) {
        lastPauseIndexRef.current = currentPauseIndex
        setTransform(-currentPauseIndex * currentW)
        isPausedRef.current = true

        sleep(PAUSE_DURATION).then(() => {
          if (!isCancelled) {
            isPausedRef.current = false
            lastTimeRef.current = performance.now()
          }
        })

        return
      }

      if (newPos <= -BANNERS.length * currentW) {
        setTransform(0)
        lastPauseIndexRef.current = 0
        lastTimeRef.current = performance.now()
        return
      }

      setTransform(newPos)
    }

    sleep(PAUSE_DURATION).then(() => {
      if (!isCancelled) {
        isPausedRef.current = false
        lastTimeRef.current = performance.now()
      }
    })

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      isCancelled = true
      animRunningRef.current = false
      isPausedRef.current = false
      cancelAnimationFrame(rafRef.current)
      clearAllTimeouts()
    }
  }, [prefersReducedMotion])

  if (prefersReducedMotion) {
    return (
      <section className="relative py-6 lg:py-8 bg-slate-50" aria-label="Promotional banners">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl overflow-hidden shadow-premium-xl bg-slate-200 aspect-video">
            <Link href={BANNERS[0].href} className="block w-full h-full" aria-label={BANNERS[0].alt}>
              <Image
                src={BANNERS[0].src}
                alt={BANNERS[0].alt}
                className="object-cover w-full h-full"
                fill
                priority
              />
            </Link>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="relative py-6 lg:py-8 bg-slate-50" aria-label="Promotional banners">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="relative rounded-2xl overflow-hidden shadow-premium-xl bg-slate-200 aspect-video"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="overflow-hidden w-full h-full" ref={containerRef}>
            <div className="flex" ref={trackRef}>
              {DUPLICATED.map((banner, index) => (
                <div
                  key={`${banner.id}-${index}`}
                  className="flex-[0_0_100%] min-w-0 relative"
                >
                  <Link href={banner.href} className="block w-full h-full" aria-label={banner.alt}>
                    <Image
                      src={banner.src}
                      alt={banner.alt}
                      className="object-cover w-full h-full"
                      fill
                      loading={index === 0 ? 'eager' : 'lazy'}
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