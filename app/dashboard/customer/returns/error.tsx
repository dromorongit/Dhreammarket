"use client"

import Link from 'next/link'
import { Button } from '@/components/Button'

export default function ReturnsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <p className="text-sm text-slate-500 mb-2">Something went wrong</p>
          <p className="text-lg font-semibold text-deep-navy mb-6">
            We could not load your returns right now.
          </p>
          <Button onClick={() => reset()}>Try again</Button>
          <p className="mt-4">
            <Link href="/dashboard/customer/returns" className="text-royal-blue hover:text-royal-blue/80 text-sm font-medium">
              Back to My Returns
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
