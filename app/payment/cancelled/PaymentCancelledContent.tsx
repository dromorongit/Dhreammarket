'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import NeedHelpButton from '@/components/NeedHelpButton'

export default function PaymentCancelledContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams?.get('orderId')

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card variant="elevated" className="overflow-hidden">
          {/* Cancellation Banner */}
          <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <Badge variant="warning" className="mb-4">
              Payment Cancelled
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Payment Cancelled
            </h1>
            <p className="text-amber-100 text-lg">
              Your payment was cancelled. Your cart items are still saved.
            </p>
          </div>

          <CardContent className="p-6 sm:p-8">
            {/* Info Message */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-amber-700">
                  No charges have been made to your account. You can complete your purchase anytime by returning to your cart.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link href="/cart">
                <Button size="lg" className="w-full shadow-lg shadow-amber-500/20">
                  Return to Cart
                </Button>
              </Link>
              <Link href="/checkout">
                <Button variant="outline" size="lg" className="w-full">
                  Try Again
                </Button>
              </Link>
              {orderId && (
                <Link href={`/dashboard/customer/orders/${orderId}`}>
                  <Button variant="ghost" size="lg" className="w-full text-slate-700 hover:text-deep-navy">
                    View Order Details
                  </Button>
                </Link>
              )}
              <Link href="/marketplace">
                <Button variant="ghost" size="lg" className="w-full text-slate-700 hover:text-deep-navy">
                  Continue Shopping
                </Button>
              </Link>
            </div>

            {/* Support Link */}
            <div className="mt-6 pt-6 border-t border-slate-200">
              <NeedHelpButton
                variant="outline"
                size="sm"
                category="PAYMENT"
                fullWidth
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}