'use client'

import { MdSearch, MdShield, MdInventory } from 'react-icons/md'

const STEPS = [
  {
    icon: MdSearch,
    title: 'Browse & Discover',
  },
  {
    icon: MdShield,
    title: 'Pay Securely',
  },
  {
    icon: MdInventory,
    title: 'Receive Your Order',
  },
]

export default function HowItWorksSection() {
  return (
    <section className="w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 mb-1 md:mb-2">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-deep-navy via-royal-blue to-blue-800 px-4 py-3 md:px-6 md:py-4 shadow-lg shadow-blue-900/20 border border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_55%)]"></div>

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-3 md:gap-4">
            <div className="hidden md:block flex-shrink-0">
              <h2 className="text-white font-bold text-base md:text-lg tracking-tight">
                How It Works
              </h2>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 w-full md:w-auto">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                return (
                  <div key={step.title} className="flex items-center gap-2">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-white whitespace-nowrap">
                      {step.title}
                    </span>

                    {index < STEPS.length - 1 && (
                      <div className="hidden md:block w-px h-8 bg-white/20 mx-2" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
