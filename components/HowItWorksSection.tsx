'use client'

import { MdSearch, MdShield, MdInventory } from 'react-icons/md'

const STEPS = [
  {
    number: '01',
    icon: MdSearch,
    title: 'Browse & Discover',
    description: 'Explore thousands of products from verified vendors across Ghana, all in one place.',
  },
  {
    number: '02',
    icon: MdShield,
    title: 'Order & Pay Securely',
    description: 'Checkout with confidence using Paystack\'s secure payment processing.',
  },
  {
    number: '03',
    icon: MdInventory,
    title: 'Receive Your Order',
    description: 'Track your delivery and receive your order right at your doorstep.',
  },
]

export default function HowItWorksSection() {
  return (
    <section className='relative py-16 lg:py-24 bg-white overflow-hidden'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='text-center mb-10'>
          <h2 className='text-2xl md:text-3xl font-bold text-navy mb-2'>
            How Dhream Market Works
          </h2>
          <p className='text-gray-500'>
            Shopping made simple in three easy steps
          </p>
        </div>

        <div className='grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 relative'>
          {STEPS.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={step.number} className='flex flex-col items-center text-center relative'>
                <div className='relative w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-100 flex items-center justify-center mb-4'>
                  <Icon className='w-7 h-7 text-blue-700' />
                  <span className='absolute -top-2 -right-2 text-4xl font-bold text-gray-100'>
                    {step.number}
                  </span>
                </div>
                <h3 className='text-lg font-bold text-navy mb-2'>
                  {step.title}
                </h3>
                <p className='text-sm text-gray-500 max-w-xs'>
                  {step.description}
                </p>

                {index < STEPS.length - 1 && (
                  <div className='hidden md:block absolute top-8 left-[60%] w-[80%] border-t-2 border-dashed border-gray-200' />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
