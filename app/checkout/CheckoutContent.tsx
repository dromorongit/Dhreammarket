'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/Skeleton'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'
import { formatPrice } from '@/lib/currency'
import { getAvailableRegions } from '@/lib/shipping'
import NeedHelpButton from '@/components/NeedHelpButton'
import { useCart, dispatchCartUpdate } from '@/lib/CartContext'
import { event } from '@/lib/gtag'

interface CartItem {
  id: string
  quantity: number
  product: {
    id: string
    name: string
    price: number
    stock: number
    availabilityType?: string
    expectedArrivalDate?: string | null
    estimatedFulfillmentDays?: number | null
    preOrderNotes?: string | null
    expectedRestockDate?: string | null
    backOrderNotes?: string | null
    images: Array<{
      id: string
      url: string
      alt: string | null
    }>
  }
  productVariant?: {
    id: string
    color?: string | null
    size?: string | null
    age?: string | null
    stock?: number
  } | null
  color?: string | null
  size?: string | null
  age?: string | null
}

interface CartResponse {
  cart: {
    id: string | null
    items: CartItem[]
    total: number
  }
}

interface UserProfile {
  id: string
  email: string
  firstName?: string | null
  lastName?: string | null
  profile?: {
    phone?: string | null
    address?: string | null
  } | null
}

const CHECKOUT_STEPS = [
  { id: 1, name: 'Cart', completed: true },
  { id: 2, name: 'Information', active: true },
  { id: 3, name: 'Payment', active: false },
  { id: 4, name: 'Confirmation', active: false },
]

function OrderSummaryDesktop({ items, subtotal }: { 
  items: CartItem[]
  subtotal: number 
}) {
  return (
    <Card variant="elevated" className="bg-white rounded-2xl shadow-sm">
      <CardHeader>
        <h2 className="text-lg font-bold text-navy mb-4">Order Summary</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
              <div className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                {item.product.images.length > 0 ? (
                  <Image
                    src={item.product.images[0].url}
                    alt={item.product.images[0].alt ?? item.product.name}
                    width={56}
                    height={56}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{item.product.name}</p>
                <span className="inline-block text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 mt-1">
                  Qty: {item.quantity}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{formatPrice(item.product.price * item.quantity)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function MobileOrderSummary({ 
  items, 
  totalQuantity, 
  subtotal, 
  expanded, 
  onToggle 
}: { 
  items: CartItem[]
  totalQuantity: number 
  subtotal: number
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <Card variant="elevated" className="bg-white rounded-2xl shadow-sm">
      <CardContent className="p-4">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-sm font-medium text-slate-700">
            Order Summary ({totalQuantity} items) · {formatPrice(subtotal)}
          </span>
          <svg 
            className={`w-5 h-5 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expanded && (
          <div className="mt-4 space-y-3 pt-4 border-t border-slate-100">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                  {item.product.images.length > 0 ? (
                    <Image
                      src={item.product.images[0].url}
                      alt={item.product.images[0].alt ?? item.product.name}
                      width={48}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.product.name}</p>
                  <span className="inline-block text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 mt-1">
                    Qty: {item.quantity}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900">{formatPrice(item.product.price * item.quantity)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PaymentSummaryMobile({ total, processing, onCheckout }: {
  total: number
  processing: boolean
  onCheckout: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-slate-600">Total</p>
        <p className="text-lg font-bold text-navy">{formatPrice(total)}</p>
      </div>
      <Button
        onClick={onCheckout}
        disabled={processing}
        className="h-14 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-semibold text-base rounded-xl flex items-center justify-center gap-2 flex-1 max-w-xs"
      >
        {processing ? (
          <span className="flex items-center gap-2">
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </span>
        ) : (
          <>
            Place Order
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </>
        )}
      </Button>
    </div>
  )
}

function PaymentSummaryDesktop({ total, subtotal, processing, onCheckout }: {
  total: number
  subtotal: number
  processing: boolean
  onCheckout: () => void
}) {
  return (
    <Card variant="elevated" className="bg-white rounded-2xl shadow-sm">
      <CardHeader>
        <h2 className="text-lg font-bold text-navy mb-4">Payment Summary</h2>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-600">Subtotal</span>
            <span className="text-slate-900">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Delivery fee</span>
            <span className="text-slate-900">{formatPrice(0)}</span>
          </div>
          <div className="flex justify-between border-t pt-3 mt-3">
            <span className="text-lg font-bold text-navy">Total</span>
            <span className="text-lg font-bold text-navy">{formatPrice(total)}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={onCheckout}
          disabled={processing}
          className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-800 text-white font-semibold text-base rounded-xl flex items-center justify-center gap-2"
        >
          {processing ? (
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </span>
          ) : (
            <>
              Place Order
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </>
          )}
        </Button>
        <div className="mt-3 flex items-center justify-center gap-2 text-sm text-slate-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Secure Checkout</span>
        </div>
      </CardFooter>
    </Card>
  )
}

export default function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [cart, setCart] = useState<CartResponse['cart'] | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderSummaryExpanded, setOrderSummaryExpanded] = useState(false)
  const [verificationTimeout, setVerificationTimeout] = useState(false)
  const [processingScreenTimeout, setProcessingScreenTimeout] = useState(false)
  
  const { cart: contextCart } = useCart()
  const paymentStatus = searchParams?.get('status') ?? null
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    region: '',
    city: '',
    address: '',
    notes: ''
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const processedRefs = useRef<Set<string>>(new Set())

  useEffect(() => {
    loadCart()
    fetchProfile()
  }, [])

  useEffect(() => {
    if (contextCart) {
      setCart(contextCart)
    }
  }, [contextCart])

  const loadCart = async () => {
    try {
      const response = await fetch('/api/cart')
      if (response.ok) {
        const data: CartResponse = await response.json()
        setCart(data.cart)
      } else if (response.status === 401) {
        const currentUrl = encodeURIComponent(`${window.location.pathname}${window.location.search || ''}`)
        window.location.href = `/login?redirect=${currentUrl}`
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
        const user = data.user
        setProfile(user)
        if (user) {
          setFormData(prev => ({
            ...prev,
            firstName: user.profile?.firstName ?? '',
            lastName: user.profile?.lastName ?? '',
            email: user.email ?? '',
            phone: user.profile?.phone ?? '',
            address: user.profile?.address ?? ''
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!formData.firstName.trim()) errors.firstName = 'First name is required'
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required'
    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email address'
    }
    if (!formData.phone.trim()) errors.phone = 'Phone number is required'
    if (!formData.region.trim()) errors.region = 'Region is required'
    if (!formData.city.trim()) errors.city = 'City is required'
    if (!formData.address.trim()) errors.address = 'Delivery address is required'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleCheckout = async () => {
    if (!cart || cart.items.length === 0) return

    event({ action: 'begin_checkout', category: 'ecommerce', value: subtotal })

    for (const item of cart.items) {
      const isPreorderOrBackorder = item.product.availabilityType === 'PREORDER' ||
                                    item.product.availabilityType === 'BACKORDER'
      if (!isPreorderOrBackorder) {
        const availableStock = item.productVariant?.stock ?? item.product.stock
        if (availableStock < item.quantity) {
          setError(`Insufficient stock for ${item.product.name}. Available: ${availableStock}`)
          setProcessing(false)
          return
        }
      }
    }
    
    if (!validateForm()) return

    setProcessing(true)
    setError(null)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerInfo: formData }),
      })

      const data = await response.json()

      if (response.status === 401) {
        const currentUrl = encodeURIComponent(`${window.location.pathname}${window.location.search || ''}`)
        window.location.href = `/login?redirect=${currentUrl}`
        return
      }

      if (response.ok && data.authorizationUrl) {
        window.location.href = data.authorizationUrl
      } else {
        const errorMessage = data.error ?? data.message ?? 'Failed to initialize checkout'
        setError(errorMessage)
        setProcessing(false)
      }
    } catch {
      setError('An error occurred during checkout. Please check your connection and try again.')
      setProcessing(false)
    }
  }

  const verifyPayment = async (ref: string) => {
    setProcessing(true)
    setVerificationTimeout(false)
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Verification timeout')), 10000)
    })

    try {
      const response = await Promise.race([
        fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: ref }),
        }),
        timeoutPromise,
      ]) as Response

      if (!response.ok) {
        setProcessing(false)
        const data = await response.json()
        const redirectUrl = data.status === 'cancelled' || data.status === 'abandoned'
          ? `/payment/cancelled?orderId=${data.orderId ?? ''}`
          : '/payment/failed'
        window.location.href = redirectUrl
        return
      }

      const data = await response.json()
      
      if (data.success) {
        dispatchCartUpdate()
        window.location.href = `/payment/success?orderId=${data.orderId}`
      } else if (data.status === 'cancelled' || data.status === 'abandoned' || data.status === 'failed') {
        setProcessing(false)
        if (data.status === 'cancelled' || data.status === 'abandoned') {
          window.location.href = `/payment/cancelled?orderId=${data.orderId ?? ''}`
        } else {
          window.location.href = '/payment/failed'
        }
      } else {
        setProcessing(false)
        window.location.href = '/payment/failed'
      }
    } catch (error) {
      setProcessing(false)
      if (error instanceof Error && error.message === 'Verification timeout') {
        setVerificationTimeout(true)
      } else {
        window.location.href = '/payment/failed'
      }
    }
  }

  useEffect(() => {
    const status = searchParams?.get('status')
    const ref = searchParams?.get('reference') ?? searchParams?.get('trxref')
    
    if (ref && (status === 'success' || !status)) {
      if (processedRefs.current.has(ref)) return
      processedRefs.current.add(ref)
      verifyPayment(ref)
    } else if (status === 'cancelled' || status === 'failed' || status === 'abandoned') {
      setProcessing(false)
      if (status === 'cancelled' || status === 'abandoned') {
        window.location.href = '/payment/cancelled'
      } else {
        window.location.href = '/payment/failed'
      }
    } else if (searchParams?.toString()) {
      setProcessing(false)
      if (!ref) window.location.href = '/payment/failed'
    }
  }, [searchParams])

  useEffect(() => {
    if (processing && !verificationTimeout) {
      const timer = setTimeout(() => {
        setProcessingScreenTimeout(true)
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [processing, verificationTimeout])

  const subtotal = cart?.total ?? 0
  const total = subtotal
  const totalQuantity = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0
  const availableRegions = useMemo(() => getAvailableRegions(), [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-full">
          <div className="animate-pulse space-y-8">
            <Skeleton className="h-10 w-32" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-64" />
                <Skeleton className="h-48" />
              </div>
              <Skeleton className="h-96" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (processing) {
    if (verificationTimeout || processingScreenTimeout) {
      return (
        <div className="min-h-screen bg-slate-50 py-12 overflow-x-hidden">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-full">
            <Card variant="elevated" className="max-w-md mx-auto">
              <CardContent className="py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-6">
                  <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-deep-navy mb-2">
                  Payment Verification Taking Too Long
                </h3>
                <p className="text-slate-600 mb-6">
                  We could not confirm your payment status. Please check your orders or return to cart.
                </p>
                <div className="space-y-3">
                  <Link href="/dashboard/customer/orders">
                    <Button size="lg" className="w-full">
                      Check My Orders
                    </Button>
                  </Link>
                  <Link href="/cart">
                    <Button variant="outline" size="lg" className="w-full">
                      Return to Cart
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-slate-50 py-12 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-full">
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
      <div className="min-h-screen bg-slate-50 py-12 overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-full">
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
    <div className="min-h-screen bg-slate-50 pb-28 lg:pb-12 overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full max-w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Badge variant="premium">Secure Checkout</Badge>
            <div className="flex-1 h-px bg-gradient-to-r from-royal-blue/20 to-transparent"></div>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">
            Complete Your Order
          </h1>
          
          {/* Checkout Progress */}
          <div className="mt-6 w-full overflow-x-auto scrollbar-hide">
            <div className="flex items-center justify-between min-w-max px-4 py-3 gap-1 max-w-2xl">
              {CHECKOUT_STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center flex-shrink-0">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold
                    ${step.completed ? 'bg-emerald-500 text-white' : step.active ? 'bg-royal-blue text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {step.completed ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className={`ml-1.5 text-xs font-medium whitespace-nowrap ${step.active ? 'text-royal-blue' : step.completed ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {step.name}
                  </span>
                  {index < CHECKOUT_STEPS.length - 1 && (
                    <div className={`w-6 h-0.5 mx-2 flex-shrink-0 ${index < 1 ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                  )}
                </div>
              ))}
            </div>
          </div>
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

        <div className="lg:grid lg:grid-cols-10 lg:gap-8">
          {/* Customer Information - Desktop: 60% width */}
          <div className="lg:col-span-6">
            <Card variant="elevated" className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-navy mb-4">Customer Information</h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-4">
                <Input
                  label="First Name"
                  placeholder="Enter your first name"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  error={formErrors.firstName}
                  required
                />
                <Input
                  label="Last Name"
                  placeholder="Enter your last name"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  error={formErrors.lastName}
                  required
                />
              </div>
              
              <div className="mt-4 grid grid-cols-1 gap-4">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  error={formErrors.email}
                  required
                />
                
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="+233 XX XXX XXXX"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  error={formErrors.phone}
                  required
                />
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Region/State</label>
                  <select
                    value={formData.region}
                    onChange={(e) => handleInputChange('region', e.target.value)}
                    className={`block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:border-slate-300 transition-all shadow-sm h-12 ${formErrors.region ? 'border-rose-300 focus:ring-rose-500' : ''}`}
                  >
                    <option value="">Select a region</option>
                    {availableRegions.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                  {formErrors.region && (
                    <p className="text-sm text-rose-600 flex items-center gap-1 mt-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formErrors.region}
                    </p>
                  )}
                </div>
                
                <Input
                  label="City"
                  placeholder="Enter your city"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  error={formErrors.city}
                  required
                />
                
<Input
                  label="Delivery Address"
                  placeholder="Street address, apartment, etc."
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  error={formErrors.address}
                  required
                />
                
                <Textarea
                  label="Additional Notes (optional)"
                  placeholder="Any special instructions for delivery..."
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  rows={3}
                />
              </div>
            </Card>
          </div>

          {/* Order Summary - Desktop: sticky in right column */}
          <div className="mt-6 lg:mt-0 lg:col-span-4 w-full max-w-full">
            <div className="lg:sticky lg:top-28 space-y-4">
              <OrderSummaryDesktop items={cart.items} subtotal={subtotal} />
              <div className="hidden lg:block">
                <PaymentSummaryDesktop total={total} subtotal={subtotal} processing={processing} onCheckout={handleCheckout} />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Collapsible Order Summary */}
        <div className="mt-6 lg:hidden">
          <MobileOrderSummary
            items={cart.items}
            totalQuantity={totalQuantity}
            subtotal={subtotal}
            expanded={orderSummaryExpanded}
            onToggle={() => setOrderSummaryExpanded(!orderSummaryExpanded)}
          />
        </div>
      </div>

      {/* Mobile sticky Place Order button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 lg:hidden z-50 shadow-lg">
        <PaymentSummaryMobile total={total} processing={processing} onCheckout={handleCheckout} />
      </div>
    </div>
  )
}