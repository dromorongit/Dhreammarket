'use client'

import { Sparkles } from 'lucide-react'

export function FirstOrderDiscountBanner() {
  return (
    <section className="w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 md:mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-deep-navy via-royal-blue to-blue-800 px-6 py-6 md:px-10 md:py-8 shadow-lg shadow-blue-900/20 border border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_60%)]"></div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-premium-gold/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>

          <div className="relative flex flex-col md:flex-row items-center justify-center md:justify-start gap-3 text-center md:text-left">
            <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl bg-premium-gold/20 border border-premium-gold/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 md:w-7 md:h-7 text-premium-gold" strokeWidth={1.5} />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Get 10% Off Your First Order
              </h2>
              <p className="text-sm md:text-base text-white/80 max-w-xl">
                New to Dhream Market? Enjoy a special welcome discount on your first purchase.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}