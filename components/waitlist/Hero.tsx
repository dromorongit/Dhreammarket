'use client'

import Link from 'next/link'
import PhoneMockup from './PhoneMockup'

export default function Hero() {
  const scrollToForm = () => {
    const el = document.getElementById('waitlist-form')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="relative overflow-hidden bg-dhream-cream pt-10 pb-16 md:pt-16 md:pb-24">
      {/* blurred blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-dhream-orange/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-80 h-80 rounded-full bg-dhream-teal/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 w-56 h-56 rounded-full bg-dhream-coral/20 blur-3xl" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Text */}
          <div>
            <p className="text-xs font-semibold tracking-[0.3em] text-dhream-muted uppercase mb-3">
              THE DHREAM MARKET
            </p>
            <h1 className="font-poppins font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-tight text-dhream-navy">
              Mobile App <span className="text-dhream-orange">is Coming!</span>
            </h1>
            <p className="mt-3 text-sm sm:text-base font-semibold tracking-widest text-dhream-navy/80 uppercase">
              BE PART OF SOMETHING BIG.
            </p>
            <p className="mt-4 text-base sm:text-lg text-dhream-muted max-w-xl">
              We&apos;re building a smarter, faster and more convenient way to shop, sell and grow — all in one app.
            </p>

            <div className="mt-6">
              <h2 className="font-poppins font-bold text-xl sm:text-2xl text-dhream-navy">Join the Waitlist</h2>
              <p className="text-sm sm:text-base text-dhream-muted">
                and be the first to know when the app is officially released!
              </p>
            </div>

            <div className="mt-6">
              <button
                onClick={scrollToForm}
                className="inline-flex items-center gap-3 rounded-full bg-dhream-navy text-white px-6 py-3.5 text-sm sm:text-base font-semibold shadow-lg shadow-dhream-navy/30 border-2 border-dhream-orange/60 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Join the Waitlist
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <p className="mt-6 font-caveat text-2xl text-dhream-orange">
              Shop Smarter. Live Better.
            </p>
          </div>

          {/* Phone */}
          <div className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  )
}
