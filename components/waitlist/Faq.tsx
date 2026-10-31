'use client'

import { useState } from 'react'

const faqs = [
  { q: 'When will the app launch?', a: "We're putting the finishing touches on it. Waitlist members will be the first to know the launch date." },
  { q: 'Is it free to join the waitlist?', a: 'Yes, joining is completely free.' },
  { q: 'Which phones will it work on?', a: "We're building for Android and iPhone. Tell us which you use in the form." },
  { q: 'Can I sell on the app?', a: 'Yes. Dhream Market is built for both shoppers and sellers.' },
  { q: 'How will you use my details?', a: 'Only to update you about the app. We never sell your data.' },
]

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <section className="py-12 md:py-16 bg-dhream-cream-light">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-poppins font-bold text-2xl sm:text-3xl text-dhream-navy mb-8">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i
            return (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm sm:text-base font-semibold text-dhream-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-dhream-navy"
                >
                  <span>{f.q}</span>
                  <svg
                    className={`w-5 h-5 text-dhream-muted transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-sm text-dhream-muted" aria-live="polite">
                    {f.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
