'use client'

import { useEffect, useRef, useState } from 'react'

interface StatItem {
  label: string
  endValue: number
  suffix: string
}

const STATS: StatItem[] = [
  { label: 'Vendors', endValue: 10000, suffix: '+' },
  { label: 'Products', endValue: 50000, suffix: '+' },
  { label: 'Happy Customers', endValue: 25000, suffix: '+' },
  { label: 'Orders Delivered', endValue: 15000, suffix: '+' },
]

function AnimatedNumber({ endValue, suffix }: { endValue: number; suffix: string }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const node = document.createElement('span')
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
              requestAnimationFrame(animate)
            }
          }

          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.5 }
    )

    if (node) observer.observe(node)
    return () => observer.disconnect()
  }, [endValue])

  return (
    <span>
      {display.toLocaleString()}
      {suffix}
    </span>
  )
}

export default function TrustStatsStrip() {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <section className="relative w-full px-4 sm:px-6 lg:px-8">
      <div
        ref={ref}
        className="max-w-7xl mx-auto rounded-2xl bg-gradient-to-r from-deep-navy via-royal-blue to-deep-navy border border-gold/20 py-4 md:py-5"
      >
        <div className="flex flex-row items-center justify-around md:justify-between divide-x divide-white/10">
          {STATS.map((stat) => (
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
