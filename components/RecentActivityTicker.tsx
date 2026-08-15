'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/Card'

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

export function RecentActivityTicker() {
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
