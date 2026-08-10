'use client'

import { useEffect, useRef, useState } from 'react'
import { MdCardGiftcard } from 'react-icons/md'

export function FirstOrderDiscountBanner() {
  const [translateX, setTranslateX] = useState<string>('-100%')
  const [opacity, setOpacity] = useState<number>(0)
  const [animate, setAnimate] = useState<boolean>(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runCycle = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    setTranslateX('-100%')
    setOpacity(0)
    setAnimate(false)

    timeoutRef.current = setTimeout(() => {
      setAnimate(true)
      setTranslateX('0')
      setOpacity(1)

      timeoutRef.current = setTimeout(() => {
        setTranslateX('100%')
        setOpacity(0)

        timeoutRef.current = setTimeout(() => {
          runCycle()
        }, 500)
      }, 5000)
    }, 50)
  }

  useEffect(() => {
    runCycle()
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return (
    <section className="w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4 md:mb-6">
        <div
          className="relative overflow-hidden rounded-xl bg-gradient-to-r from-deep-navy via-royal-blue to-blue-800 px-4 py-2 md:px-6 md:py-2.5 shadow-md shadow-blue-900/20 border border-white/10"
          style={{
            transform: `translateX(${translateX})`,
            opacity,
            transition: animate ? 'transform 0.5s ease-in-out, opacity 0.5s ease-in-out' : 'none',
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_55%)]"></div>

          <div className="relative flex items-center justify-center md:justify-start gap-2 text-center md:text-left">
            <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-md bg-premium-gold/20 border border-premium-gold/30 flex items-center justify-center">
              <MdCardGiftcard className="w-3.5 h-3.5 md:w-4 md:h-4 text-premium-gold" />
            </div>

            <h2 className="text-sm md:text-base font-bold text-white tracking-tight leading-tight">
              Get 10% Off Your First Order
            </h2>
          </div>
        </div>
      </div>
    </section>
  )
}