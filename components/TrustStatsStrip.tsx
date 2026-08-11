'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'

interface StatItem {
  label: string
  endValue: number
  suffix: string
}

interface AnimatedNumberProps {
  endValue: number
  suffix: string
}

function AnimatedNumber({ endValue, suffix }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0)
  const spanRef = useRef<HTMLSpanElement>(null)
  const hasAnimatedRef = useRef(false)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const node = spanRef.current
    if (!node) return

    if (hasAnimatedRef.current) return
    if (endValue === 0) return

    hasAnimatedRef.current = true

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect()
          const duration = 1800
          const startTime = performance.now()

          const animate = (now: number) => {
            const elapsed = now - startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setDisplay(Math.floor(eased * endValue))
            if (progress < 1) {
              rafRef.current = requestAnimationFrame(animate)
            }
          }

          rafRef.current = requestAnimationFrame(animate)
        }
      },
      { threshold: 0.3 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [endValue])

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  return (
    <span ref={spanRef}>
      {display.toLocaleString()}
      {suffix}
    </span>
  )
}

const FALLBACK_STATS: StatItem[] = [
  { label: 'Vendors', endValue: 0, suffix: '+' },
  { label: 'Products', endValue: 0, suffix: '+' },
  { label: 'Happy Customers', endValue: 5000, suffix: '+' },
  { label: 'Orders Delivered', endValue: 500, suffix: '+' },
]

export default function TrustStatsStrip() {
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['public-stats'],
    queryFn: async () => {
      const response = await fetch('/api/public-stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json() as Promise<{
        vendors: number
        products: number
        happyCustomers: number
        ordersDelivered: number
      }>
    },
    staleTime: 60_000,
  })

  const stats: StatItem[] = [
    { label: 'Vendors', endValue: data?.vendors ?? 0, suffix: '+' },
    { label: 'Products', endValue: data?.products ?? 0, suffix: '+' },
    { label: 'Happy Customers', endValue: data?.happyCustomers ?? 5000, suffix: '+' },
    { label: 'Orders Delivered', endValue: data?.ordersDelivered ?? 500, suffix: '+' },
  ]

  return (
    <section className="relative w-full px-4 sm:px-6 lg:px-8">
      <div
        ref={ref}
        className="max-w-7xl mx-auto rounded-2xl bg-gradient-to-r from-deep-navy via-royal-blue to-deep-navy border border-gold/20 py-4 md:py-5"
      >
        <div className="flex flex-row items-center justify-around md:justify-between divide-x divide-white/10">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center px-3 md:px-6 text-center">
              <span className="text-xl md:text-3xl font-extrabold text-white">
                <AnimatedNumber endValue={stat.endValue} suffix={stat.suffix} />
              </span>
              <span className="text-[10px] md:text-xs text-white/70 uppercase tracking-wide mt-0.5">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
