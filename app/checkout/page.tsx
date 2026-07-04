import { Suspense } from 'react'
import CheckoutContent from './CheckoutContent'

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
  return (
    <Suspense fallback={<LoadingState />}>
      <CheckoutContent />
    </Suspense>
  )
}