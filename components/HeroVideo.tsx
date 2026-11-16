'use client'

import React from 'react'

interface HeroVideoProps {
  src: string
  opacity?: number
  mobileOpacity?: number
  blur?: number
}

const MOBILE_QUERY = '(max-width: 767px)'

export function HeroVideo({ src, opacity = 0.14, mobileOpacity = 0.55, blur = 0 }: HeroVideoProps) {
  const [mounted, setMounted] = React.useState(false)
  const [preload, setPreload] = React.useState<'metadata' | 'auto'>('metadata')
  const videoRef = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const nav = navigator as unknown as { connection?: { saveData?: boolean } }
    const saveData = !!nav.connection?.saveData

    if (motionOk && !saveData) {
      setPreload(window.matchMedia(MOBILE_QUERY).matches ? 'auto' : 'metadata')
      setMounted(true)
    }
  }, [])

  React.useEffect(() => {
    if (!mounted) return
    const video = videoRef.current
    if (!video) return

    let retryAttached = false

    const detachRetry = () => {
      if (!retryAttached) return
      window.removeEventListener('touchstart', onRetry)
      document.removeEventListener('visibilitychange', onRetry)
      retryAttached = false
    }

    const attachRetry = () => {
      if (retryAttached) return
      retryAttached = true
      window.addEventListener('touchstart', onRetry)
      document.addEventListener('visibilitychange', onRetry)
    }

    const attemptPlay = () => {
      video.muted = true
      video.defaultMuted = true
      const playPromise = video.play()
      if (playPromise === undefined) return
      playPromise
        .then(() => {
          detachRetry()
        })
        .catch(() => {
          attachRetry()
        })
    }

    const onRetry = () => {
      attemptPlay()
    }

    const onLoadedData = () => {
      attemptPlay()
    }

    attemptPlay()
    video.addEventListener('loadeddata', onLoadedData)
    video.addEventListener('canplay', onLoadedData)

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting) {
          attemptPlay()
        } else {
          video.pause()
        }
      },
      { threshold: 0 }
    )
    observer.observe(video)

    return () => {
      observer.disconnect()
      detachRetry()
      video.removeEventListener('loadeddata', onLoadedData)
      video.removeEventListener('canplay', onLoadedData)
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
      preload={preload}
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
            filter: none !important;
            transform: none !important;
          }
        }
      `}</style>
    </video>
  )
}
