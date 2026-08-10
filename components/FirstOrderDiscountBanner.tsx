'use client'

import { MdCardGiftcard } from 'react-icons/md'

export function FirstOrderDiscountBanner() {
  return (
    <section className="w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6 md:mb-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-deep-navy via-royal-blue to-blue-800 px-5 py-3 md:px-8 md:py-4 shadow-md shadow-blue-900/20 border border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_60%)]"></div>
          <div className="absolute top-0 right-0 w-40 h-40 bg-premium-gold/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>

          <div className="relative flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 text-center md:text-left">
            <div className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-lg bg-premium-gold/20 border border-premium-gold/30 flex items-center justify-center">
              <MdCardGiftcard className="w-4 h-4 md:w-5 md:h-5 text-premium-gold" />
            </div>

            <div className="space-y-0.5">
              <h2 className="text-base md:text-lg font-bold text-white tracking-tight leading-tight">
                Get 10% Off Your First Order
              </h2>
              <p className="text-xs md:text-sm text-white/80 max-w-xl leading-snug">
                New to Dhream Market? Enjoy a special welcome discount on your first purchase.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}