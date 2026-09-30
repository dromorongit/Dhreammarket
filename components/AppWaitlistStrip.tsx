/**
 * App Waitlist Strip
 *
 * Compact homepage strip linking to /app.
 */

import Link from 'next/link'
import { Button } from '@/components/Button'
import { MdSmartphone } from 'react-icons/md'

export default function AppWaitlistStrip() {
  return (
    <section className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl bg-slate-50 border border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-royal-blue/10 text-royal-blue">
              <MdSmartphone className="h-5 w-5" />
            </span>
            <p className="text-sm sm:text-base font-medium text-deep-navy">
              The Dhream Market app is coming to Android and iOS
            </p>
          </div>
          <Link href="/app">
            <Button variant="primary" size="sm" className="rounded-full">
              Join the waitlist
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
