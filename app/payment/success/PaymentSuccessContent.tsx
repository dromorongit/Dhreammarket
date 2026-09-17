'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatPrice } from '@/lib/currency'
import { event } from '@/lib/gtag'
import { useCart } from '@/lib/CartContext'

interface Order {
  id: string
  total: number
  status: string
  paymentStatus: string
  createdAt: string
  items: Array<{
    id: string
    quantity: number
    price: number
    product: {
      name: string
    }
  }>
}

export default function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { clearCart } = useCart()
  const orderId = searchParams?.get('orderId')
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (orderId) {
      fetchOrder()
      clearCart()
    }
  }, [orderId])

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [copied])

  const fetchOrder = async () => {
    try {
      const response = await fetch('/api/orders?limit=50')
      if (response.ok) {
        const data = await response.json()
        const foundOrder = data.orders?.find((o: Order) => o.id === orderId)
        if (foundOrder) {
          setOrder(foundOrder)
          event({ action: 'purchase', category: 'ecommerce', label: foundOrder.id, value: foundOrder.total })
        }
      }
    } catch (error) {
      console.error('Error fetching order:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyOrderId = async () => {
    if (!order?.id) return
    try {
      await navigator.clipboard.writeText(order.id)
      setCopied(true)
    } catch {
      console.error('Failed to copy order ID')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-slate-200 mx-auto mb-4 animate-pulse"></div>
            <div className="h-6 bg-slate-200 rounded w-48 mx-auto mb-4 animate-pulse"></div>
            <div className="h-4 bg-slate-200 rounded w-64 mx-auto animate-pulse"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card variant="elevated" className="overflow-hidden">
          {/* Success Banner */}
          <div className="relative bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 px-6 py-10 sm:py-12 text-center overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-400/20 rounded-full blur-3xl"></div>
            </div>
            <div className="relative">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 tracking-tight">Payment Successful!</h1>
              <p className="text-emerald-100 text-base sm:text-lg">Thank you for your order</p>
            </div>
          </div>

          <CardContent className="p-5 sm:p-8">
            {/* Order Badge */}
            {order && (
              <div className="flex items-center justify-center gap-2 mb-6">
                <Badge variant="verified" size="lg">
                  Order #{order.id.slice(-8)}
                </Badge>
                <Badge variant="success" size="lg">
                  {order.status}
                </Badge>
              </div>
            )}

            {/* Order Details Card */}
            {order && (
              <div className="bg-slate-50 rounded-2xl p-4 sm:p-6 mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-deep-navy mb-4">Order Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-white rounded-xl p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-slate-500 mb-1">Order ID</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-deep-navy font-mono text-xs sm:text-sm break-all">{order.id}</p>
                      <button
                        type="button"
                        onClick={handleCopyOrderId}
                        className="flex-shrink-0 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-royal-blue hover:bg-slate-100 transition-colors min-h-[44px] min-w-[44px]"
                        title={copied ? 'Copied!' : 'Copy Order ID'}
                      >
                        {copied ? (
                          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path>
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                          </svg>
                        )}
                      </button>
                    </div>
                    {copied && (
                      <p className="text-xs text-emerald-600 mt-1">Copied!</p>
                    )}
                  </div>
                  <div className="bg-white rounded-xl p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-slate-500 mb-1">Date</p>
                    <p className="font-medium text-deep-navy text-xs sm:text-sm">
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-slate-500 mb-1">Payment Status</p>
                    <p className="font-medium text-emerald-600 text-xs sm:text-sm">{order.paymentStatus}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-slate-500 mb-1">Total Amount</p>
                    <p className="font-bold text-deep-navy text-base sm:text-lg">{formatPrice(order.total)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Order Items Summary */}
            {order && order.items.length > 0 && (
              <div className="mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-deep-navy mb-4">Items Purchased</h3>
                <div className="space-y-3">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-slate-50 rounded-xl p-3 sm:p-4"
                    >
                      <div className="min-w-0 flex-1 mr-3">
                        <p className="font-medium text-deep-navy text-sm truncate">{item.product.name}</p>
                        <p className="text-xs sm:text-sm text-slate-500">Quantity: {item.quantity}</p>
                      </div>
                      <p className="font-semibold text-deep-navy text-sm flex-shrink-0">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total */}
            {order && (
              <div className="border-t border-slate-200 pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-base sm:text-lg font-semibold text-deep-navy">Total Paid</span>
                  <span className="text-xl sm:text-2xl font-bold text-royal-blue">{formatPrice(order.total)}</span>
                </div>
              </div>
            )}

            {/* Success Message */}
            <div className="bg-gradient-to-r from-royal-blue/10 to-purple-500/10 rounded-2xl p-4 mb-6 border border-royal-blue/20">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-royal-blue flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-700 text-xs sm:text-sm">
                  A confirmation email has been sent to your registered email address. You can track your order status and download receipts in your account dashboard.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {orderId && (
                <Link href={`/dashboard/customer/orders/${orderId}`}>
                  <Button size="lg" className="w-full shadow-lg shadow-royal-blue/20 min-h-[44px]">
                    View Order Details
                  </Button>
                </Link>
              )}
              <Link href="/dashboard/customer">
                <Button variant="outline" size="lg" className="w-full min-h-[44px]">
                  View My Orders
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="ghost" size="lg" className="w-full text-slate-700 hover:text-deep-navy min-h-[44px]">
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}