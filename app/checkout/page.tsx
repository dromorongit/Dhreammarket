import { Suspense } from 'react'
import CheckoutContent from './CheckoutContent'
import { isCancellationPolicyEnabled } from '@/lib/feature-flags'
import { CANCELLATION_POLICY_CHECKOUT_NOTICE } from '@/lib/cancellation-policy'

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-full">
        <div className="text-center">Loading checkout...</div>
      </div>
    </div>
  )
}

export default function Checkout() {
  const showCancellationNotice = isCancellationPolicyEnabled()
  return (
    <Suspense fallback={<LoadingState />}>
      {showCancellationNotice && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm text-amber-800">{CANCELLATION_POLICY_CHECKOUT_NOTICE}</p>
          </div>
        </div>
      )}
      <CheckoutContent />
    </Suspense>
  )
}