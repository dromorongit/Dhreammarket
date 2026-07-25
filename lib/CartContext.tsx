'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { event } from './gtag'

let cartRequestCounter = 0

function logCartRequest(label: string) {
  const id = ++cartRequestCounter
  const timestamp = new Date().toISOString()
  const stack = new Error().stack || ''
  console.log(`[CART #${id}] ${label} @ ${timestamp}`)
  console.log(`[CART #${id}] Stack:\n${stack}`)
  return id
}

interface ProductVariant {
  id: string
  color?: string
  size?: string
  age?: string
  sku?: string
  stock?: number
}

interface CartItem {
  id: string
  quantity: number
  productVariantId?: string | null
  color?: string | null
  size?: string | null
  age?: string | null
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
  productVariant?: ProductVariant | null
}

interface Cart {
  id: string | null
  items: CartItem[]
  total: number
}

interface CartContextType {
  cart: Cart | null
  cartItemCount: number
  cartTotalQuantity: number
  loading: boolean
  addToCart: (productId: string, quantity?: number, options?: {
    productVariantId?: string
    color?: string
    size?: string
    age?: string
  }) => Promise<boolean>
  updateQuantity: (itemId: string, quantity: number) => Promise<boolean>
  removeItem: (itemId: string) => Promise<boolean>
  clearCart: () => void
}

const CartContext = createContext<CartContextType | undefined>(undefined)

const AUTH_ROUTES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password']

function getCurrentUrl(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.pathname}${window.location.search || ''}`
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchCartPromiseRef = useRef<Promise<void> | null>(null)

  const fetchCart = useCallback(async () => {
    if (fetchCartPromiseRef.current) {
      return fetchCartPromiseRef.current
    }

    const promise = (async () => {
      logCartRequest('fetchCart()')
      try {
        const response = await fetch('/api/cart')
        if (response.ok) {
          const data = await response.json()
          setCart(data.cart)
        }
      } catch (error) {
        console.error('Error fetching cart:', error)
      } finally {
        setLoading(false)
      }
    })()

    fetchCartPromiseRef.current = promise
    promise.finally(() => {
      fetchCartPromiseRef.current = null
    })
    return promise
  }, [])

  const cartTotalQuantity = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0
  const cartItemCount = cart?.items?.length || 0

  const addToCart = useCallback(async (
    productId: string, 
    quantity = 1, 
    options?: {
      productVariantId?: string
      color?: string
      size?: string
      age?: string
    }
  ): Promise<boolean> => {
    try {
        logCartRequest('POST /api/cart (addToCart)')
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          productId, 
          quantity,
          productVariantId: options?.productVariantId,
          color: options?.color,
          size: options?.size,
          age: options?.age,
        }),
      })

      if (response.status === 401) {
        handleAuthRedirect()
        return false
      }

      if (response.ok) {
        const data = await response.json()
        setCart(data.cart)
        dispatchCartUpdate()
        fetchCart()
        event({ action: 'add_to_cart', category: 'ecommerce', label: productId, value: 0 })
        return true
      }
      return false
    } catch (error) {
      console.error('Error adding to cart:', error)
      return false
    }
  }, [fetchCart])

  const updateQuantity = useCallback(async (itemId: string, quantity: number): Promise<boolean> => {
    if (quantity <= 0) return false

    try {
      logCartRequest(`PATCH /api/cart/items/${itemId} (updateQuantity)`)
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      })

      if (response.status === 401) {
        handleAuthRedirect()
        return false
      }

      if (response.ok) {
        const data = await response.json()
        setCart(data.cart)
        dispatchCartUpdate()
        fetchCart()
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating quantity:', error)
      return false
    }
  }, [fetchCart])

  const removeItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      logCartRequest(`DELETE /api/cart/items/${itemId} (removeItem)`)
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
      })

      if (response.status === 401) {
        handleAuthRedirect()
        return false
      }

      if (response.ok) {
        const data = await response.json()
        setCart(data.cart)
        dispatchCartUpdate()
        fetchCart()
        return true
      }
      return false
    } catch (error) {
      console.error('Error removing item:', error)
      return false
    }
  }, [fetchCart])

  const clearCart = useCallback(() => {
    setCart({ id: null, items: [], total: 0 })
    dispatchCartUpdate()
  }, [])

  useEffect(() => {
    fetchCart()

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cart-updated') {
        fetchCart()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [fetchCart])

  return (
    <CartContext.Provider
      value={{
        cart,
        cartItemCount,
        cartTotalQuantity,
        loading,
        addToCart,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export { logCartRequest }

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

export function dispatchCartUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cart-updated'))
    localStorage.setItem('cart-updated', Date.now().toString())
  }
}

export function handleAuthRedirect() {
  const currentUrl = encodeURIComponent(getCurrentUrl())
  if (typeof window !== 'undefined') {
    window.location.href = `/login?redirect=${currentUrl}`
  }
}