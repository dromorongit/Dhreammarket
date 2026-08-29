'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

const SESSION_FLAG = 'b2s-promo-seen'

export default function BackToSchoolPromo() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.sessionStorage.getItem(SESSION_FLAG) === 'true') return

    const timer = setTimeout(() => {
      setVisible(true)
    }, 6000)

    return () => clearTimeout(timer)
  }, [])

  const close = () => {
    setVisible(false)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SESSION_FLAG, 'true')
    }
  }

  useEffect(() => {
    if (!visible) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [visible])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.3s_ease-out]"
        onClick={close}
      />
      <div className="relative w-full max-w-lg max-h-[90vh] animate-[fadeIn_0.3s_ease-out]">
        <button
          onClick={close}
          className="absolute -top-3 -right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white shadow-lg hover:bg-slate-100 transition-colors"
          aria-label="Close promotion"
        >
          <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="relative w-full h-full overflow-hidden rounded-xl shadow-2xl">
          <Image
            src="/images/back2schoolflyer.jpg"
            alt="Back to School promotion"
            width={800}
            height={1100}
            className="w-full h-auto max-h-[85vh] object-contain"
            priority
          />
        </div>
      </div>
    </div>
  )
}
