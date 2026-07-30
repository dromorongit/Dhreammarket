'use client'

import Link from 'next/link'
import { Button } from '@/components/Button'

export function RegistrationCTA() {
  return (
    <section className="relative py-16 lg:py-20 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200/60 shadow-premium p-8 sm:p-10 lg:p-12 text-center animate-fade-in-up">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy mb-4 leading-tight">
            Want a better shopping experience?
          </h2>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed">
            Create your free Dhream Market account to save favourites, follow vendors, receive personalised recommendations, track orders, book services faster and enjoy exclusive offers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button variant="primary" size="lg" className="px-8 py-4">
                Create Free Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}