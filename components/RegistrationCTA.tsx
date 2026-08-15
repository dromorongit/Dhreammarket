'use client'

import Link from 'next/link'
import { Button } from '@/components/Button'
import { MdArrowForward } from 'react-icons/md'

export function RegistrationCTA() {
  return (
     <section className="relative bg-transparent mt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-3">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-deep-navy leading-tight">
            Want a better shopping experience?
          </h2>
          <Link href="/register">
            <Button variant="primary" className="rounded-full px-3 py-1 text-xs font-medium shadow-sm hover:shadow-md transition-all">
              Create Free Account
              <MdArrowForward className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}