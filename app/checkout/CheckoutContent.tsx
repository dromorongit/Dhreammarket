'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
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

// Checkout progress steps
const CHECKOUT_STEPS = [
  { id: 1, name: 'Cart', completed: true },
  { id: 2, name: 'Information', active: true },
  { id: 3, name: 'Payment', active: false },
  { id: 4, name: 'Confirmation', active: false },
]

export default function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [cart, setCart] = useState<CartResponse['cart'] | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
// Use cart context for centralized state
  const { cart: contextCart, fetchCart: contextFetchCart } = useCart()
   
   // Payment result states from callback
   const paymentStatus = searchParams.get('status')
   const reference = searchParams.get('reference')
  
  // Customer form state - for address collection and delivery coordination
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
  
  // Track processed references to prevent duplicate verification (idempotency)
  const processedRefs = useRef<Set<string>>(new Set())

  // Fetch cart on mount
  useEffect(() => {
    loadCart()
    fetchProfile()
  }, [])

  // Sync context cart to local state
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
        // Auto-fill form with profile data
        if (user) {
          setFormData(prev => ({
            ...prev,
            firstName: user.profile?.firstName || '',
            lastName: user.profile?.lastName || '',
            email: user.email || '',
            phone: user.profile?.phone || '',
            address: user.profile?.address || ''
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

// Handle form field changes - for address collection only (pricing no longer affected)
   // Delivery fees are negotiated separately by vendors
   const handleInputChange = (field: string, value: string) => {
     setFormData(prev => ({ ...prev, [field]: value }))
     
     // Clear error when user types
     if (formErrors[field]) {
       setFormErrors(prev => ({ ...prev, [field]: '' }))
     }
   }

  // Validate form
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
     console.log('[Checkout] Proceed to payment clicked')
     console.log('[Checkout] Paystack Public Key Exists:', !!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY)
     
     if (!cart || cart.items.length === 0) {
       console.log('[Checkout] Cart is empty - aborting')
       return
     }

     // Revalidate stock before checkout
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
     
     if (!validateForm()) {
       console.log('[Checkout] Form validation failed - aborting')
       return
     }

     setProcessing(true)
     setError(null)

     try {
       console.log('[Checkout] Calling /api/checkout with payload:', {
         customerInfo: { ...formData, email: formData.email },
       })
        
       const response = await fetch('/api/checkout', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           customerInfo: formData,
         }),
       })

       console.log('[Checkout] API response status:', response.status)
       
       const data = await response.json()
       console.log('[Checkout] API response data:', data)

       if (response.status === 401) {
         const currentUrl = encodeURIComponent(`${window.location.pathname}${window.location.search || ''}`)
         window.location.href = `/login?redirect=${currentUrl}`
         return
       }

       if (response.ok && data.authorizationUrl) {
         console.log('[Checkout] Redirecting to Paystack:', data.authorizationUrl)
         window.location.href = data.authorizationUrl
       } else {
         const errorMessage = data.error || data.message || 'Failed to initialize checkout'
         console.error('[Checkout] API error response:', { status: response.status, error: errorMessage, fullData: data })
         setError(errorMessage)
         setProcessing(false)
       }
     } catch (err) {
       console.error('[Checkout] Fetch error:', err)
       setError('An error occurred during checkout. Please check your connection and try again.')
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
        // Handle already processed payments (idempotency protection)
        if (data.alreadyProcessed) {
          // Payment was already verified - just redirect to success page
          // This prevents duplicate processing on page refresh
          dispatchCartUpdate()
          window.location.href = `/payment/success?orderId=${data.orderId}`
          return
        }
        
        dispatchCartUpdate()
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
    
    // CRITICAL: Idempotency protection - prevent duplicate verification calls
    // This prevents re-triggering on page refresh or Paystack retries
    if (ref && (status === 'success' || !status)) {
      // Skip if this reference was already processed
      if (processedRefs.current.has(ref)) {
        return
      }
      // Mark as processed to prevent duplicate calls
      processedRefs.current.add(ref)
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

// Calculate totals - Tax and Delivery Fee are always 0 as per business rules
   // Delivery fees are negotiated separately by vendors and delivery partners
   const subtotal = cart?.total || 0
   const total = subtotal // Total equals subtotal only
   const totalQuantity = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0
  
  // Get available regions for dropdown
  const availableRegions = useMemo(() => getAvailableRegions(), [])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
          <div className="mt-6 flex items-center justify-between max-w-2xl">
            {CHECKOUT_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                  ${step.completed ? 'bg-emerald-500 text-white' : step.active ? 'bg-royal-blue text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {step.completed ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                <span className={`ml-2 text-sm font-medium ${step.active ? 'text-royal-blue' : step.completed ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {step.name}
                </span>
                {index < CHECKOUT_STEPS.length - 1 && (
                  <div className={`w-12 h-0.5 mx-4 ${index < 1 ? 'bg-emerald-500' : 'bg-slate-200'}`}></div>
                )}
              </div>
            ))}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Customer Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information Form */}
            <Card variant="elevated">
              <CardHeader>
                <h2 className="text-xl font-semibold text-deep-navy">Customer Information</h2>
                <p className="text-slate-600 text-sm mt-1">Please provide your delivery details</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>
                  
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
                      className={`block w-full rounded-2xl border border-slate-200 bg-white/80 px-6 py-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50 focus:border-royal-blue hover:border-slate-300 hover:bg-white transition-all duration-200 shadow-sm hover:shadow ${formErrors.region ? 'border-rose-300 focus:ring-rose-500/50 focus:border-rose-500' : ''}`}
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
                  
                  <div className="md:col-span-2">
                    <Input
                      label="Delivery Address"
                      placeholder="Street address, apartment, etc."
                      value={formData.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      error={formErrors.address}
                      required
                    />
                  </div>
                  
                  <div className="md:col-span-2">
                    <Textarea
                      label="Additional Notes (optional)"
                      placeholder="Any special instructions for delivery..."
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
</CardContent>
            </Card>
 
             {/* Order Items Summary */}
             <Card variant="elevated">
              <CardHeader>
                <h2 className="text-xl font-semibold text-deep-navy">Order Items ({totalQuantity} items)</h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
{cart.items.map((item) => (
                     <div key={item.id} className="flex items-center gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                       <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                         {item.product.images.length > 0 ? (
                           <img
                             src={item.product.images[0].url}
                             alt={item.product.images[0].alt || item.product.name}
                             className="w-full h-full object-cover"
                           />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center">
                             <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.516-1.516a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                             </svg>
                           </div>
                         )}
                       </div>
<div className="flex-1 min-w-0">
                          <h4 className="font-medium text-deep-navy">{item.product.name}</h4>
                          {item.product.availabilityType && item.product.availabilityType !== 'IN_STOCK' && (
                            <Badge 
                              variant={item.product.availabilityType === 'PREORDER' ? 'info' : 'warning'} 
                              size="sm" 
                              className="mt-1"
                            >
                              {item.product.availabilityType === 'PREORDER' ? 'Pre-order' : 'Backorder'}
                            </Badge>
                          )}
                          {item.productVariant && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.productVariant.color && (
                                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">Color: {item.productVariant.color}</span>
                              )}
                              {item.productVariant.size && (
                                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">Size: {item.productVariant.size}</span>
                              )}
                              {item.productVariant.age && (
                                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">Age: {item.productVariant.age}</span>
                              )}
                            </div>
                          )}
                          <p className="text-sm text-slate-500 mt-1">Qty: {item.quantity}</p>
                        </div>
                       <p className="font-semibold text-deep-navy">
                         {formatPrice(item.product.price * item.quantity)}
                       </p>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
           </div>

          {/* Payment Summary - Sticky on Desktop */}
          <div className="lg:col-span-1">
            <div className="sticky top-28">
              <Card variant="elevated" className="shadow-premium-lg">
                <CardHeader>
                  <h2 className="text-xl font-semibold text-deep-navy">Payment Summary</h2>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Subtotal */}
                    <div className="flex justify-between items-center py-3 border-b border-slate-100">
                      <span className="text-slate-600">Subtotal ({totalQuantity} items)</span>
                      <span className="font-semibold text-deep-navy">{formatPrice(subtotal)}</span>
                    </div>
                    
{/* Shipping */}
                     <div className="flex justify-between items-center py-3 border-b border-slate-100">
                       <span className="text-slate-600">Delivery Fee</span>
                       <span className="font-semibold text-emerald-600">{formatPrice(0)}</span>
                     </div>
                     
                     {/* Tax */}
                     <div className="flex justify-between items-center py-3 border-b border-slate-100">
                       <span className="text-slate-600">Tax</span>
                       <span className="font-semibold text-deep-navy">{formatPrice(0)}</span>
                     </div>
                    
                    {/* Discount/Coupon (Future-ready) */}
                    <div className="flex justify-between items-center py-3 border-b border-slate-100">
                      <span className="text-slate-600">Discount</span>
                      <span className="font-semibold text-slate-400">—</span>
                    </div>
                    
                    {/* Total */}
                    <div className="pt-4 border-t-2 border-royal-blue/10">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold text-deep-navy">Total</span>
                        <span className="text-2xl font-bold text-royal-blue">{formatPrice(total)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
<Button
                     size="lg"
                     className="w-full shadow-lg shadow-royal-blue/20"
                     disabled={processing}
                     onClick={handleCheckout}
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
                      'Proceed to Payment'
                    )}
                  </Button>
                  
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
                      <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Secure payment processing</span>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
