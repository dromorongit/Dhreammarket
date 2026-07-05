import { Suspense } from 'react'
import PaymentCancelledContent from './PaymentCancelledContent'

function LoadingState() {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">Loading...</div>
      </div>
    </div>
  )
}

export default function PaymentCancelled() {
  return (
    <Suspense fallback={<LoadingState />}>
      <PaymentCancelledContent />
    </Suspense>
  )
}