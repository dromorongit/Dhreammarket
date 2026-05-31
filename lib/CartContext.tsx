'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

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
  fetchCart: () => Promise<void>
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

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null)
  // Start with false to prevent hydration mismatch - will be set to true on client mount
  const [loading, setLoading] = useState(false)

  const fetchCart = useCallback(async () => {
    try {
      const response = await fetch('/api/cart')
      if (response.ok) {
        const data = await response.json()
        setCart(data.cart)
      } else if (response.status === 401) {
        // User not authenticated, set empty cart
        setCart({ id: null, items: [], total: 0 })
      }
    } catch (error) {
      console.error('Error fetching cart:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Calculate total quantity of items
  const cartTotalQuantity = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0
  
  // Calculate item count (number of unique products)
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

      if (response.ok) {
        const data = await response.json()
        setCart(data.cart)
        dispatchCartUpdate()
        return true
      }
      return false
    } catch (error) {
      console.error('Error adding to cart:', error)
      return false
    }
  }, [])

  const updateQuantity = useCallback(async (itemId: string, quantity: number): Promise<boolean> => {
    if (quantity <= 0) return false

    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      })

      if (response.ok) {
        const data = await response.json()
        setCart(data.cart)
        dispatchCartUpdate()
        return true
      }
      return false
    } catch (error) {
      console.error('Error updating quantity:', error)
      return false
    }
  }, [])

  const removeItem = useCallback(async (itemId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const data = await response.json()
        setCart(data.cart)
        dispatchCartUpdate()
        return true
      }
      return false
    } catch (error) {
      console.error('Error removing item:', error)
      return false
    }
  }, [])

  const clearCart = useCallback(() => {
    setCart({ id: null, items: [], total: 0 })
    dispatchCartUpdate()
  }, [])

  // Initial fetch and setup event listener for cross-tab sync
  useEffect(() => {
    fetchCart()

    // Listen for storage events to sync cart across tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'cart-updated') {
        fetchCart()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    
    // Also listen for custom events for same-tab updates
    const handleCartUpdate = () => {
      fetchCart()
    }
    
    window.addEventListener('cart-updated', handleCartUpdate as EventListener)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('cart-updated', handleCartUpdate as EventListener)
    }
  }, [fetchCart])

  return (
    <CartContext.Provider
      value={{
        cart,
        cartItemCount,
        cartTotalQuantity,
        loading,
        fetchCart,
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

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

// Helper to dispatch cart update event
export function dispatchCartUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cart-updated'))
    localStorage.setItem('cart-updated', Date.now().toString())
  }
}