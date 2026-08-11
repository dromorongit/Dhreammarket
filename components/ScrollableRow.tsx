'use client'

import { useState, useRef, type ReactNode } from 'react'
import { FiFiChevronLeft, FiFiChevronRight } from 'react-icons/fi'

interface ScrollableRowProps {
  children: ReactNode
  className?: string
}

export default function ScrollableRow({ children, className = '' }: ScrollableRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const distance = 300
    el.scrollBy({ left: direction === 'left' ? -distance : distance, behavior: 'smooth' })
    setTimeout(checkScroll, 400)
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className={`flex gap-4 overflow-x-auto overflow-y-hidden scrollbar-hide scroll-smooth snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 pb-4 ${className}`}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scroll('left')}
        className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700 disabled:opacity-0 transition-opacity"
        aria-label="Scroll left"
      >
        <FiChevronLeft className="w-5 h-5" />
      </button>
      <button
        type="button"
        onClick={() => scroll('right')}
        className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg hover:shadow-xl items-center justify-center border border-gray-100 text-gray-700 disabled:opacity-0 transition-opacity"
        aria-label="Scroll right"
      >
        <FiChevronRight className="w-5 h-5" />
      </button>
    </div>
  )
}
