'use client'

import React from 'react'

interface HeroVideoProps {
  src: string
  opacity?: number
  mobileOpacity?: number
  blur?: number
}

export function HeroVideo({ src, opacity = 0.14, mobileOpacity = 0.18, blur = 0 }: HeroVideoProps) {
  const [mounted, setMounted] = React.useState(false)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const playRetried = React.useRef(false)
  const retryListener = React.useRef<(() => void) | null>(null)

  React.useEffect(() => {
    const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nav = navigator as unknown as { connection?: { saveData?: boolean } }
    const saveData = !!nav.connection?.saveData

    if (motionOk && !saveData) {
      setMounted(true)
    }
  }, [])

  React.useEffect(() => {
    if (!mounted) return
    const video = videoRef.current
    if (!video) return
    const playPromise = video.play()
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        if (playRetried.current) return
        playRetried.current = true
        const retry = () => {
          window.removeEventListener('touchstart', retry)
          document.removeEventListener('visibilitychange', retry)
          retryListener.current = null
          video.play().catch(() => {})
        }
        retryListener.current = retry
        window.addEventListener('touchstart', retry)
        document.addEventListener('visibilitychange', retry)
      })
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting) {
          video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0 }
    )
    observer.observe(video)

    return () => {
      observer.disconnect()
      if (retryListener.current) {
        window.removeEventListener('touchstart', retryListener.current)
        document.removeEventListener('visibilitychange', retryListener.current)
        retryListener.current = null
      }
      video.pause()
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <video
      ref={videoRef}
      className="hero-video"
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        pointerEvents: 'none',
        zIndex: 0,
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : 'none',
        transform: blur > 0 ? 'scale(1.06)' : 'none',
      }}
    >
      <source src={src} type="video/mp4" />
      <style jsx>{`
        @media (max-width: 767px) {
          .hero-video {
            opacity: ${mobileOpacity} !important;
          }
        }
      `}</style>
    </video>
  )
}
