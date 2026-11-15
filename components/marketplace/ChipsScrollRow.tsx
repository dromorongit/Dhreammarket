'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa'

interface ChipsScrollRowProps {
  children: React.ReactNode
  showArrows?: boolean
}

export function ChipsScrollRow({ children, showArrows = true }: ChipsScrollRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    updateScrollState()
    return () => {
      ro.disconnect()
      el.removeEventListener('scroll', updateScrollState)
    }
  }, [updateScrollState])

  const prefersReducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

  const scrollLeft = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: -Math.round(el.clientWidth * 0.8), behavior: prefersReducedMotion ? 'auto' : 'smooth' })
  }, [prefersReducedMotion])

  const scrollRight = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: Math.round(el.clientWidth * 0.8), behavior: prefersReducedMotion ? 'auto' : 'smooth' })
  }, [prefersReducedMotion])

  return (
    <div className="relative z-10">
      <div
        ref={scrollRef}
        className="flex items-center gap-4 pb-2 overflow-x-auto whitespace-nowrap flex-nowrap scrollbar-hide snap-x snap-mandatory touch-pan-x"
        style={{ touchAction: 'pan-x' }}
      >
        {React.Children.map(children, (child) =>
          React.isValidElement(child) ? React.cloneElement(child, { className: `${child.props.className || ''} shrink-0 flex-shrink-0` }) : child
        )}
      </div>

      {showArrows && canScrollLeft && (
        <button
          type="button"
          aria-label="Scroll categories left"
          onClick={scrollLeft}
          className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-deep-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF]"
        >
          <FaChevronLeft className="w-5 h-5" />
        </button>
      )}

      {showArrows && canScrollRight && (
        <button
          type="button"
          aria-label="Scroll categories right"
          onClick={scrollRight}
          className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-deep-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF]"
        >
          <FaChevronRight className="w-5 h-5" />
        </button>
      )}

      {canScrollLeft && (
        <div className="hidden md:block absolute left-0 top-0 bottom-0 w-[56px] pointer-events-none bg-gradient-to-r from-[#F5F8FF] to-transparent" />
      )}

      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-[56px] pointer-events-none bg-gradient-to-l from-[#F5F8FF] to-transparent" />
      )}
    </div>
  )
}
