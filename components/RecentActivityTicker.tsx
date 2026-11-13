'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'

interface Activity {
  type: 'PRODUCT' | 'SERVICE'
  message: string
  productName?: string
  serviceName?: string
  city?: string
  timestamp: string
}

interface RecentActivityResponse {
  activities: Activity[]
}

import { Card } from '@/components/Card'

interface RecentActivityTickerProps {
  variant?: 'default' | 'hero'
}

const LIVE_GREEN = '#00A383'
const DIVIDER = '#CBD5E1'
const BUTTON_BLUE = '#00399C'

export function RecentActivityTicker({ variant = 'default' }: RecentActivityTickerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data, isLoading } = useQuery<RecentActivityResponse>({
    queryKey: ['homepage', 'recent-activity'],
    queryFn: async () => {
      const response = await fetch('/api/homepage/recent-activity', { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch recent activity')
      return response.json()
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const activities = data?.activities ?? []

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (refreshRef.current) {
      clearInterval(refreshRef.current)
      refreshRef.current = null
    }
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    clearTimers()

    if (activities.length <= 1 || prefersReducedMotion) {
      setCurrentIndex(0)
      setIsVisible(true)
      return clearTimers
    }

    setIsVisible(true)
    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => {
        const next = (prev + 1) % activities.length
        return next
      })
    }, 5000)

    refreshRef.current = setInterval(() => {
      setCurrentIndex(0)
    }, 30_000)

    return clearTimers
  }, [activities.length, prefersReducedMotion, clearTimers])

  const current = activities[currentIndex]

  if (isLoading) {
    if (variant === 'hero') {
      return (
        <div
          style={{
            width: 758,
            height: 57,
            background: '#fff',
            borderRadius: 9999,
            padding: '0 36px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 10px 30px rgba(15,35,80,0.10)',
          }}
        >
          <span
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: LIVE_GREEN,
            }}
          />
          <span style={{ color: '#bbb', fontSize: 12 }}>{'·'.repeat(10)}</span>
        </div>
      )
    }
    return (
      <section className="relative bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <div className="h-4 bg-slate-200 rounded w-64 animate-pulse" />
          </div>
        </div>
      </section>
    )
  }

  if (activities.length === 0) {
    return null
  }

  if (variant === 'hero') {
    return (
      <section
        aria-live="polite"
        aria-atomic="true"
        style={{
          width: 758,
          height: 57,
          background: '#fff',
          borderRadius: 9999,
          padding: '0 36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 10px 30px rgba(15,35,80,0.10)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 14,
              height: 14,
              borderRadius: 9999,
              background: LIVE_GREEN,
              boxShadow: '0 0 0 2px rgba(0,163,131,0.35)',
            }}
          />
          <span
            style={{
              color: LIVE_GREEN,
              fontSize: 18,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            LIVE ACTIVITY
          </span>
          <span style={{ width: 1, height: 24, background: DIVIDER, display: 'inline-block', margin: '0 10px' }} />
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: 21,
                fontWeight: 600,
                color: '#14203C',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'opacity 0.5s ease',
                opacity: isVisible ? 1 : 0,
              }}
            >
              {current.message}
            </p>
          </div>
        </div>
        {activities.length > 1 && !prefersReducedMotion && (
          <div style={{ display: 'flex', gap: 6 }}>
            {activities.slice(0, 5).map((_, idx) => (
              <span
                key={idx}
                style={{
                  width: idx === currentIndex ? 22 : 7,
                  height: 7,
                  borderRadius: idx === currentIndex ? 9999 : 9999,
                  background: idx === currentIndex ? BUTTON_BLUE : '#CBD5E1',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="relative bg-white" aria-live="polite" aria-atomic="true">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center">
          <Card variant="outline" className="flex items-center gap-3 px-5 py-2.5 rounded-full border-slate-200 shadow-sm max-w-full">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex-shrink-0 hidden sm:inline">
              Live Activity
            </span>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider flex-shrink-0 sm:hidden">
              Activity
            </span>
            <span className="h-3 w-px bg-slate-200 flex-shrink-0" aria-hidden="true" />
            <div className="overflow-hidden max-w-full">
              <p
                className={`text-sm sm:text-base font-medium text-deep-navy truncate transition-opacity duration-500 ${
                  isVisible ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {current.message}
              </p>
            </div>
            {activities.length > 1 && !prefersReducedMotion && (
              <div className="flex gap-1 flex-shrink-0 ml-1" aria-hidden="true">
                {activities.slice(0, 5).map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      idx === currentIndex ? 'w-3 bg-royal-blue' : 'w-1 bg-slate-300'
                    }`}
                  />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  )
}
