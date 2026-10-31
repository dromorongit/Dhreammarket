'use client'

import { useEffect, useState } from 'react'

export default function PhoneMockup() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div className="relative mx-auto w-64 sm:w-72" style={{ perspective: '1000px' }}>
      <div
        className={`relative ${reduceMotion ? '' : 'animate-[float_4s_ease-in-out_infinite]'}`}
        style={{ transform: 'rotate(-6deg)' }}
      >
        {/* Phone frame */}
        <div
          className="relative rounded-[2.6rem] p-2 shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, #C9A27A 0%, #B87333 50%, #8B5A2B 100%)',
            boxShadow: '0 25px 50px -12px rgba(11, 74, 111, 0.35)',
          }}
        >
          <div className="rounded-[2.2rem] bg-slate-900 p-1">
            {/* Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-900 rounded-b-xl z-10" />
            {/* Screen */}
            <div className="relative aspect-[9/19] rounded-[2rem] overflow-hidden bg-gradient-to-b from-[#FFFAF4] to-[#FFF4E8] flex flex-col items-center justify-center px-4 text-center">
              <div className="w-14 h-14 mb-3 rounded-2xl bg-dhream-navy/10 flex items-center justify-center">
                <span className="text-2xl font-bold text-dhream-navy">D</span>
              </div>
              <p className="text-xs font-semibold text-dhream-navy/80 mb-1">Dhream Market</p>
              <p className="text-sm font-bold text-dhream-navy leading-tight mb-2">More Choices. More Possibilities.</p>
              <p className="text-[11px] font-medium text-dhream-orange">Shop · Sell · Grow</p>
              <svg className="mt-4 w-20 h-16 text-dhream-orange/80" viewBox="0 0 80 64" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 50 L30 20 L50 35 L70 10" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="70" cy="10" r="3" fill="currentColor" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badge sticker */}
      <div
        className={`absolute -top-4 -right-6 z-20 ${reduceMotion ? '' : 'animate-[float_3s_ease-in-out_infinite]'}`}
        style={{ transform: 'rotate(12deg)' }}
      >
        <div className="w-20 h-20 rounded-full bg-dhream-teal text-white flex items-center justify-center text-center text-[10px] font-bold shadow-lg leading-tight px-2">
          Be the
          <br />
          First to
          <br />
          Know!
        </div>
      </div>
    </div>
  )
}
