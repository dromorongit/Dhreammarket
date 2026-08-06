'use client'

import Link from 'next/link'
import { Button } from '@/components/Button'
import { MdArrowForward } from 'react-icons/md'

export function RegistrationCTA() {
  return (
    <section className="relative py-8 lg:py-10 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-3">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-deep-navy leading-tight">
            Want a better shopping experience?
          </h2>
          <Link href="/register">
            <Button variant="primary" size="sm" className="rounded-full px-4 py-1.5">
              Create Free Account
              <MdArrowForward className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}