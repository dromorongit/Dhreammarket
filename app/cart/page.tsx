'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton, SkeletonCard } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'

interface CartItem {
  id: string
  quantity: number
  product: {
    id: string
    name: string
    price: number
    stock: number
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

export default function Cart() {
  const router = useRouter()
  const [cart, setCart] = useState<CartResponse['cart'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchCart()
  }, [])

  const fetchCart = async () => {
    try {
      const response = await fetch('/api/cart')
      if (response.ok) {
        const data: CartResponse = await response.json()
        setCart(data.cart)
      } else if (response.status === 401) {
        router.push('/login')
      } else {
        console.error('Failed to fetch cart')
      }
    } catch (error) {
      console.error('Error fetching cart:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) return

    setUpdatingItems(prev => new Set(prev).add(itemId))
    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity: newQuantity }),
      })

      if (response.ok) {
        const data: CartResponse = await response.json()
        setCart(data.cart)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update quantity')
      }
    } catch (error) {
      console.error('Error updating quantity:', error)
      alert('Error updating quantity')
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }
  }

  const removeItem = async (itemId: string) => {
    setUpdatingItems(prev => new Set(prev).add(itemId))
    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const data: CartResponse = await response.json()
        setCart(data.cart)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to remove item')
      }
    } catch (error) {
      console.error('Error removing item:', error)
      alert('Error removing item')
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev)
        newSet.delete(itemId)
        return newSet
      })
    }
  }

  const placeOrder = async () => {
    if (!cart || cart.items.length === 0) return

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        alert('Order placed successfully! Order ID: ' + data.order.id)
        setCart({ id: null, items: [], total: 0 })
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to place order')
      }
    } catch (error) {
      console.error('Error placing order:', error)
      alert('Error placing order')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-8">
            <Skeleton className="h-10 w-32" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <Skeleton className="h-32 w-full" />
          </div>
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
            description="Add some products to get started with your shopping journey!"
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
            Shopping Cart
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">
            Your Cart
          </h1>
        </div>

        {/* Cart Items */}
        <div className="space-y-4 mb-8">
          {cart.items.map((item) => (
            <Card
              key={item.id}
              variant="elevated"
              className="group hover:shadow-xl transition-all duration-300"
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  {/* Product Image */}
                  <div className="w-24 h-24 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
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

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-deep-navy mb-1">
                      {item.product.name}
                    </h3>
                    <p className="text-royal-blue font-semibold text-lg">
                      {formatPrice(item.product.price)}
                    </p>
                    <p className="text-sm text-slate-500">
                      Stock available: {item.product.stock}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-1">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        disabled={updatingItems.has(item.id) || item.quantity <= 1}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-deep-navy transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="w-12 text-center font-semibold text-deep-navy">
                        {updatingItems.has(item.id) ? (
                          <svg className="w-4 h-4 animate-spin mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          item.quantity
                        )}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        disabled={updatingItems.has(item.id) || item.quantity >= item.product.stock}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100 hover:text-deep-navy transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Price & Remove */}
                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="text-xl font-bold text-deep-navy">
                      {formatPrice(item.product.price * item.quantity)}
                    </p>
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={updatingItems.has(item.id)}
                      className="text-slate-500 hover:text-rose-600 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary */}
        <Card variant="elevated" className="sticky top-24">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-deep-navy mb-4">Order Summary</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({cart.items.reduce((sum, item) => sum + item.quantity, 0)} items)</span>
                <span>{formatPrice(cart.total)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="text-emerald-600">Free</span>
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

            <div className="space-y-3">
              <Link href="/checkout">
                <Button size="lg" className="w-full shadow-lg shadow-royal-blue/20">
                  Proceed to Checkout
                </Button>
              </Link>
              <Button variant="outline" className="w-full" onClick={() => router.push('/marketplace')}>
                Continue Shopping
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2 text-sm text-slate-500 justify-center">
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Secure payment processing</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}