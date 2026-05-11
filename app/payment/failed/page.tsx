'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import NeedHelpButton from '@/components/NeedHelpButton'

export default function PaymentFailed() {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card variant="elevated" className="overflow-hidden">
          {/* Failure Banner */}
          <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-8 text-center">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <Badge variant="danger" className="mb-4">
              Payment Failed
            </Badge>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
              Transaction Could Not Complete
            </h1>
            <p className="text-rose-100 text-lg">
              Your payment was not processed successfully
            </p>
          </div>

          <CardContent className="p-6 sm:p-8">
            {/* Error Details */}
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-rose-800 mb-2">
                    Payment could not be completed
                  </p>
                  <p className="text-sm text-rose-700">
                    This could be due to one of the following reasons:
                  </p>
                  <ul className="text-sm text-rose-700 mt-2 space-y-1">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span>
                      Insufficient funds in your account
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span>
                      Card declined or expired
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span>
                      Network or connection issues
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-rose-400 rounded-full"></span>
                      Cancellation by user
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-slate-600">
                  No charges have been made to your account. You can try the payment again or use a different payment method.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link href="/checkout">
                <Button size="lg" className="w-full shadow-lg shadow-rose-500/20">
                  Try Payment Again
                </Button>
              </Link>
              <Link href="/cart">
                <Button variant="outline" size="lg" className="w-full">
                  Return to Cart
                </Button>
              </Link>
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