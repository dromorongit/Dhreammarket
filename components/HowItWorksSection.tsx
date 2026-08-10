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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-2 md:mb-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-deep-navy via-royal-blue to-blue-800 px-6 py-6 md:px-10 md:py-8 shadow-lg shadow-blue-900/20 border border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_55%)]"></div>

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6 md:gap-4">
            <div className="hidden md:block flex-shrink-0">
              <h2 className="text-white font-bold text-lg md:text-xl tracking-tight">
                How It Works
              </h2>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 w-full md:w-auto">
              {STEPS.map((step, index) => {
                const Icon = step.icon
                return (
                  <div key={step.title} className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-white whitespace-nowrap">
                      {step.title}
                    </span>

                    {index < STEPS.length - 1 && (
                      <div className="hidden md:block w-px h-10 bg-white/20 mx-2" />
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
