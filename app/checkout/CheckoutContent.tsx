'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'

interface CartItem {
  id: string
  quantity: number
  product: {
    id: string
    name: string
    price: number
    images: Array<{
      id: string
      url: string
      alt: string | null
    }>
  }
}

interface CartResponse {
  cart: {
    id: string | null
    items: CartItem[]
    total: number
  }
}

interface UserProfile {
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  address?: string | null
}

export default function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [cart, setCart] = useState<CartResponse['cart'] | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Payment result states from callback
  const paymentStatus = searchParams.get('status')
  const reference = searchParams.get('reference')

  useEffect(() => {
    fetchCart()
    fetchProfile()
  }, [])

  const fetchCart = async () => {
    try {
      const response = await fetch('/api/cart')
      if (response.ok) {
        const data: CartResponse = await response.json()
        setCart(data.cart)
      } else if (response.status === 401) {
        router.push('/login')
      }
    } catch (error) {
      console.error('Error fetching cart:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/auth/me')
      if (response.ok) {
        const data = await response.json()
        setProfile(data.user?.profile || null)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const handleCheckout = async () => {
    if (!cart || cart.items.length === 0) return

    setProcessing(true)
    setError(null)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok && data.authorizationUrl) {
        window.location.href = data.authorizationUrl
      } else {
        setError(data.error || 'Failed to initialize checkout')
        setProcessing(false)
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setError('An error occurred during checkout')
      setProcessing(false)
    }
  }

  const verifyPayment = async (ref: string) => {
    setProcessing(true)
    try {
      const response = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference: ref }),
      })

      if (!response.ok) {
        setProcessing(false)
        window.location.href = '/payment/failed'
        return
      }

      const data = await response.json()
      
      if (data.success) {
        window.location.href = `/payment/success?orderId=${data.orderId}`
      } else {
        setProcessing(false)
        window.location.href = '/payment/failed'
      }
    } catch (err) {
      console.error('Payment verification error:', err)
      setProcessing(false)
      window.location.href = '/payment/failed'
    }
  }

  useEffect(() => {
    const status = searchParams.get('status')
    const ref = searchParams.get('reference') || searchParams.get('trxref')
    
    if (ref && (status === 'success' || !status)) {
      verifyPayment(ref)
    } else if (status === 'cancelled' || status === 'failed') {
      setProcessing(false)
      window.location.href = '/payment/failed'
    } else if (searchParams.toString()) {
      setProcessing(false)
      if (!ref) {
        window.location.href = '/payment/failed'
      }
    }
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-8">
            <Skeleton className="h-10 w-32" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-32" />
              </div>
              <Skeleton className="h-64" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (processing) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card variant="elevated" className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center mx-auto mb-6 animate-pulse">
                <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-deep-navy mb-2">
                {paymentStatus ? 'Verifying payment...' : 'Processing your payment...'}
              </h3>
              <p className="text-slate-600">Please wait while we confirm your payment.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <EmptyState
            icon={
              <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 010 4m0-2a2 2 0 01-2 2m2 2v1a2 2 0 002 2h2" />
              </svg>
            }
            title="Your cart is empty"
            description="Add some products to proceed to checkout."
            actionLabel="Browse Products"
            onAction={() => router.push('/marketplace')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Badge variant="premium" className="mb-4">
            Secure Checkout
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">
            Complete Your Order
          </h1>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl">
            <p className="text-rose-700 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Items & Customer Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Card variant="elevated">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-deep-navy mb-4">Order Items</h2>
                <div className="space-y-4">
                  {cart.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0"
                    >
                      <div className="w-20 h-20 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                        {item.product.images.length > 0 ? (
                          <img
                            src={item.product.images[0].url}
                            alt={item.product.images[0].alt || item.product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-deep-navy truncate">{item.product.name}</h3>
                        <p className="text-sm text-slate-500">Quantity: {item.quantity}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-deep-navy">{formatPrice(item.product.price * item.quantity)}</p>
                        <p className="text-sm text-slate-500">{formatPrice(item.product.price)} each</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Customer Information */}
            {profile && (
              <Card variant="elevated">
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold text-deep-navy mb-4">Customer Information</h2>
                  <div className="grid grid-cols-2 gap-4">
                    {profile.firstName && (
                      <div className="bg-slate-50 rounded-xl p-4">
                        <p className="text-sm text-slate-500 mb-1">Full Name</p>
                        <p className="font-medium text-deep-navy">{profile.firstName} {profile.lastName || ''}</p>
                      </div>
                    )}
                    {profile.phone && (
                      <div className="bg-slate-50 rounded-xl p-4">
                        <p className="text-sm text-slate-500 mb-1">Phone Number</p>
                        <p className="font-medium text-deep-navy">{profile.phone}</p>
                      </div>
                    )}
                    {profile.address && (
                      <div className="bg-slate-50 rounded-xl p-4 col-span-2">
                        <p className="text-sm text-slate-500 mb-1">Address</p>
                        <p className="font-medium text-deep-navy">{profile.address}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Payment Summary */}
          <div className="lg:col-span-1">
            <Card variant="elevated" className="sticky top-24">
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-deep-navy mb-4">Payment Summary</h2>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal ({cart.items.length} items)</span>
                    <span className="font-medium">{formatPrice(cart.total)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping</span>
                    <span className="text-emerald-600 font-medium">Free</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tax</span>
                    <span>Calculated at checkout</span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-deep-navy">Total</span>
                    <span className="text-3xl font-bold text-royal-blue">{formatPrice(cart.total)}</span>
                  </div>
                </div>

                <Button
                  onClick={handleCheckout}
                  disabled={processing}
                  size="lg"
                  className="w-full shadow-lg shadow-royal-blue/20 mb-4"
                >
                  {processing ? 'Processing...' : 'Pay Now'}
                </Button>

                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-emerald-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Secure payment processing</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>256-bit SSL encryption</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="text-center mt-4">
              <Link href="/cart" className="text-sm text-slate-600 hover:text-deep-navy transition-colors inline-flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}