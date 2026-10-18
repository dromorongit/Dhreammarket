'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Badge } from '@/components/Badge'
import { formatCurrency } from '@/lib/currency'
import { toPesewas, fromPesewas, computeOrderTotals, buildWhatsAppShareLink, MANUAL_CHANNELS, type ManualChannel } from '@/lib/manual-orders'

const PAYMENT_METHODS = [
  { value: 'MOBILE_MONEY', label: 'Mobile Money' },
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'OTHER', label: 'Other' },
]

interface ProductOption {
  id: string
  name: string
  price: number
  stock: number
  availableStock: number
  variants: Array<{ id: string; color?: string | null; size?: string | null; age?: string | null; price?: number | null; stock: number }>
}

interface CartLine {
  productId: string
  variantId: string | null
  name: string
  variantLabel: string | null
  quantity: number
  unitPrice: number
  overridden: boolean
}

function variantLabel(v: { color?: string | null; size?: string | null; age?: string | null } | null): string | null {
  if (!v) return null
  const parts = [v.color, v.size, v.age].filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : null
}

export default function VendorQuickSalePageClient() {
  const router = useRouter()
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const prefillPhone = searchParams.get('phone') || ''

  // --- Form state ---
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID())
  const [stage, setStage] = useState<'form' | 'success'>('form')

  // Customer
  const [customerPhone, setCustomerPhone] = useState(prefillPhone)
  const [customerName, setCustomerName] = useState('')
  const [channel, setChannel] = useState<ManualChannel>('WHATSAPP')
  const [lookupResult, setLookupResult] = useState<{ found: boolean; name: string | null; orderCount: number } | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [customerError, setCustomerError] = useState<string | null>(null)

  // Items
  const [products, setProducts] = useState<ProductOption[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [cart, setCart] = useState<CartLine[]>([])
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<{ id: string; color?: string | null; size?: string | null; age?: string | null; price?: number | null; stock: number } | null>(null)
  const [qty, setQty] = useState(1)
  const [customUnitPrice, setCustomUnitPrice] = useState<string>('')
  const [itemsError, setItemsError] = useState<string | null>(null)

  // Delivery fee
  const [deliveryFee, setDeliveryFee] = useState(0)

  // Payment
  const [markPaid, setMarkPaid] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<{ message: string; products?: Array<{ productName: string }> } | null>(null)

  // Success
  const [sale, setSale] = useState<{ displayNumber: string; total: number; paymentStatus: string; receiptUrl: string | null; receiptToken: string | null } | null>(null)

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ---- Totals (client-side display only) ----
  const linesForTotals = cart.map((line) => ({ unitPricePesewas: toPesewas(line.unitPrice), quantity: line.quantity }))
  const totals = computeOrderTotals(linesForTotals, toPesewas(deliveryFee))

  // ---- Effects ----

  // Regenerate key only after success or new sale
  useEffect(() => {
    if (stage === 'success') {
      setIdempotencyKey(crypto.randomUUID())
    }
  }, [stage])

  // Lookup customer on phone change (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const phone = customerPhone.trim()
    setCustomerError(null)
    setLookupResult(null)
    if (!phone) return
    debounceRef.current = setTimeout(async () => {
      setLookupLoading(true)
      try {
        const res = await fetch(`/api/vendor/customers/lookup?phone=${encodeURIComponent(phone)}`)
        if (res.ok) {
          const data = await res.json()
          if (data.found && data.customer) {
            setLookupResult({ found: true, name: data.customer.name || null, orderCount: data.customer.orderCount || 0 })
            if (data.customer.name && !customerName) setCustomerName(data.customer.name)
          } else {
            setLookupResult({ found: false, name: null, orderCount: 0 })
          }
        }
      } catch {
        // ignore lookup failures
      } finally {
        setLookupLoading(false)
      }
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [customerPhone, customerName])

  // Fetch products on mount / search change
  useEffect(() => {
    let cancelled = false
    setProductsLoading(true)
    const params = new URLSearchParams({ search: productSearch, availabilityType: 'IN_STOCK', limit: '100' })
    fetch(`/api/products?${params}`)
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Failed to load products')))
      .then((data) => {
        if (cancelled) return
        const list = (data.products || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          stock: p.stock,
          availableStock: p.availableStock ?? (p.stock - (p.reservedQuantity || 0)),
          variants: (p.variants || []).map((v: any) => ({
            id: v.id,
            color: v.color,
            size: v.size,
            age: v.age,
            price: v.price,
            stock: v.stock - (v.reservedQuantity || 0),
          })),
        }))
        setProducts(list)
      })
      .catch(() => setProducts([]))
      .finally(() => { if (!cancelled) setProductsLoading(false) })
    return () => { cancelled = true }
  }, [productSearch])

  // Reset variant selection when product changes
  useEffect(() => {
    setSelectedVariant(null)
    setQty(1)
    setCustomUnitPrice('')
  }, [selectedProduct])

  // Compute default unit price for selected product/variant
  const defaultUnitPrice = (() => {
    if (!selectedProduct) return ''
    const variant = selectedVariant || null
    const cataloguePrice = variant?.price != null ? variant.price : selectedProduct.price
    return fromPesewas(toPesewas(cataloguePrice)).toFixed(2)
  })()

  const availableQtyForSelection = (() => {
    if (!selectedProduct) return 0
    if (selectedVariant) return selectedVariant.stock
    return selectedProduct.availableStock
  })()

  // ---- Handlers ----

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerPhone(e.target.value)
    setLookupResult(null)
  }

  const handleUseLookupName = () => {
    if (lookupResult?.name) setCustomerName(lookupResult.name)
  }

  const handleChannelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setChannel(e.target.value as ManualChannel)
  }

  const handleSelectProduct = (product: ProductOption) => {
    setSelectedProduct(product)
    setSelectedVariant(null)
    setQty(1)
    setCustomUnitPrice('')
    setItemsError(null)
  }

  const handleVariantChange = (variant: { id: string; color?: string | null; size?: string | null; age?: string | null; price?: number | null; stock: number } | null) => {
    setSelectedVariant(variant)
    setQty(1)
    setCustomUnitPrice('')
  }

  const handleQtyChange = (delta: number) => {
    const next = qty + delta
    if (next < 1 || next > availableQtyForSelection) return
    setQty(next)
  }

  const handleCustomPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomUnitPrice(e.target.value)
  }

  const handleAddToCart = () => {
    if (!selectedProduct) return
    const variant = selectedVariant || null
    const unitPrice = customUnitPrice.trim() === '' ? null : parseFloat(customUnitPrice)
    const overridden = customUnitPrice.trim() !== ''
    const linePrice = overridden ? (isFinite(unitPrice!) && unitPrice! > 0 ? unitPrice! : (variant?.price ?? selectedProduct.price)) : (variant?.price ?? selectedProduct.price)

    const line: CartLine = {
      productId: selectedProduct.id,
      variantId: variant?.id ?? null,
      name: selectedProduct.name,
      variantLabel: variantLabel(variant),
      quantity: qty,
      unitPrice: linePrice,
      overridden,
    }

    // Merge if same product+variant already in cart
    setCart((prev) => {
      const existingIdx = prev.findIndex((l) => l.productId === line.productId && l.variantId === line.variantId)
      if (existingIdx >= 0) {
        const next = [...prev]
        next[existingIdx] = { ...next[existingIdx], quantity: next[existingIdx].quantity + line.quantity, unitPrice: line.unitPrice, overridden }
        return next
      }
      return [...prev, line]
    })
    setSelectedProduct(null)
    setSelectedVariant(null)
    setQty(1)
    setCustomUnitPrice('')
    setItemsError(null)
  }

  const handleUpdateLineQty = (index: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev]
      const newQty = next[index].quantity + delta
      if (newQty < 1) return prev
      next[index] = { ...next[index], quantity: newQty }
      return next
    })
  }

  const handleRemoveLine = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  const handleTogglePaid = () => {
    setMarkPaid(!markPaid)
    if (!markPaid) setPaymentMethod(null)
  }

  const handlePaymentMethodChange = (value: string) => {
    setPaymentMethod(value)
  }

  const handleDeliveryFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeliveryFee(parseFloat(e.target.value) || 0)
  }

  // ---- Submit ----

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!customerName.trim()) { setCustomerError('Customer name is required'); return }
    if (!customerPhone.trim()) { setCustomerError('Customer phone is required'); return }
    if (cart.length === 0) { setItemsError('Add at least one item'); return }

    const linesPayload = cart.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: line.overridden ? line.unitPrice : undefined,
    }))

    setSubmitting(true)
    try {
      const res = await fetch('/api/vendor/manual-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: customerName.trim(), phone: customerPhone.trim(), email: undefined },
          channel,
          items: linesPayload,
          deliveryFee,
          markPaid,
          paymentMethod: markPaid ? (paymentMethod || '') : undefined,
          idempotencyKey,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409 && data.products) {
          setSubmitError({ message: 'Insufficient stock for some items. Adjust quantities below.', products: data.products })
          return
        }
        throw new Error(data.error || 'Failed to record sale')
      }

      const order = data.order
      setSale({
        displayNumber: order.displayNumber,
        total: order.total,
        paymentStatus: order.paymentStatus,
        receiptUrl: order.receiptUrl || null,
        receiptToken: order.receiptToken || null,
      })
      setStage('success')
    } catch (err) {
      setSubmitError({ message: err instanceof Error ? err.message : 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = () => {
    setSubmitError(null)
    setSubmitting(false)
  }

  const handleRecordAnother = () => {
    setStage('form')
    setCart([])
    setCustomerName('')
    setCustomerPhone(prefillPhone)
    setChannel('WHATSAPP')
    setLookupResult(null)
    setLookupLoading(false)
    setCustomerError(null)
    setItemsError(null)
    setSubmitError(null)
    setSelectedProduct(null)
    setSelectedVariant(null)
    setQty(1)
    setCustomUnitPrice('')
    setMarkPaid(false)
    setPaymentMethod(null)
    setDeliveryFee(0)
    setSale(null)
    setSubmitting(false)
    setIdempotencyKey(crypto.randomUUID())
  }

  const handleViewOrder = () => {
    if (sale) router.push(`/dashboard/vendor/orders`)
  }

  const handleCopyLink = () => {
    if (!sale?.receiptUrl) return
    navigator.clipboard.writeText(sale.receiptUrl)
  }

  const handleWhatsApp = () => {
    if (!sale?.receiptUrl || !customerPhone) return
    const link = buildWhatsAppShareLink(customerPhone, sale.receiptUrl)
    window.open(link, '_blank')
  }

  // ---- Render ----

  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <Card variant="elevated" className="p-8 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Sale Recorded</h2>
            <p className="text-gray-600 mb-6">Order #{sale!.displayNumber}</p>
            <div className="space-y-3 mb-6 text-left">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(sale!.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Payment</span>
                <span className={`text-sm font-medium ${sale!.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {sale!.paymentStatus === 'PAID' ? 'Paid now' : 'Pay later'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Button onClick={handleWhatsApp} fullWidth variant="outline" size="sm" disabled={!sale!.receiptUrl}>
                Send on WhatsApp
              </Button>
              <Button onClick={handleCopyLink} fullWidth variant="outline" size="sm" disabled={!sale!.receiptUrl}>
                Copy link
              </Button>
            </div>
            <div className="space-y-2">
              <Button onClick={handleRecordAnother} fullWidth variant="outline" size="sm">
                Record another sale
              </Button>
              <Button asChild onClick={handleViewOrder} fullWidth variant="ghost" size="sm">
                <Link href="/dashboard/vendor/orders">View order</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <form onSubmit={handleSubmit} className="max-w-md mx-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {/* Section 1: Customer */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Customer</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Phone</label>
              <Input
                type="tel"
                inputMode="tel"
                placeholder="024XXXXXXXX"
                value={customerPhone}
                onChange={handlePhoneChange}
                className="min-h-[44px]"
              />
              {customerError && <p className="text-sm text-rose-600">{customerError}</p>}
            </div>
            {lookupLoading ? (
              <p className="text-xs text-gray-500">Looking up customer...</p>
            ) : lookupResult ? (
              <div className="flex items-center gap-2">
                <Badge variant={lookupResult.found ? 'success' : 'default'} size="sm">
                  {lookupResult.found ? `Returning customer (${lookupResult.orderCount} orders)` : 'New customer'}
                </Badge>
                {lookupResult.found && lookupResult.name && (
                  <Button variant="ghost" size="sm" onClick={handleUseLookupName}>
                    Use {lookupResult.name}
                  </Button>
                )}
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <Input
                placeholder="Customer name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Channel</label>
              <select
                value={channel}
                onChange={handleChannelChange}
                className="block w-full min-h-[44px] rounded-2xl border border-slate-200 bg-white/80 px-4 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50"
              >
                {MANUAL_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Items */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Items</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Search products</label>
              <Input
                placeholder="Search by product name..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="min-h-[44px]"
              />
              {productsLoading && <p className="text-xs text-gray-500">Loading products...</p>}
            </div>
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl">
              {products.length === 0 && !productsLoading && (
                <p className="p-4 text-sm text-gray-500 text-center">No products found</p>
              )}
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectProduct(p)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {formatCurrency(p.price)} • {p.availableStock} in stock{p.variants.length > 0 ? ` • ${p.variants.length} variant(s)` : ''}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-royal-blue">Add</span>
                </button>
              ))}
            </div>

            {selectedProduct && (
              <div className="bg-slate-50 p-4 rounded-xl space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{selectedProduct.name}</span>
                  <Button variant="outline" size="sm" onClick={() => setSelectedProduct(null)}>Remove</Button>
                </div>
                {selectedProduct.variants.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Variant</label>
                    <div className="flex gap-2 overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => handleVariantChange(null)}
                        className={`px-3 py-1.5 rounded-lg text-sm border ${
                          !selectedVariant ? 'border-royal-blue bg-royal-blue/10 text-royal-blue' : 'border-slate-200 bg-white text-gray-700'
                        }`}
                      >
                        Default
                      </button>
                      {selectedProduct.variants.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleVariantChange(v)}
                          className={`px-3 py-1.5 rounded-lg text-sm border ${
                            selectedVariant?.id === v.id ? 'border-royal-blue bg-royal-blue/10 text-royal-blue' : 'border-slate-200 bg-white text-gray-700'
                          }`}
                        >
                          {[v.color, v.size, v.age].filter(Boolean).join(' / ') || 'Variant'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Qty</label>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleQtyChange(-1)} disabled={qty <= 1} className="w-10 h-10">−</Button>
                      <span className="w-8 text-center text-sm font-medium text-gray-900">{qty}</span>
                      <Button variant="outline" size="sm" onClick={() => handleQtyChange(1)} disabled={qty >= availableQtyForSelection} className="w-10 h-10">+</Button>
                      <span className="text-xs text-gray-500">max {availableQtyForSelection}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-gray-500 uppercase">Unit price (GH₵)</label>
                    <Input
                      type="text"
                      placeholder={defaultUnitPrice}
                      value={customUnitPrice}
                      onChange={handleCustomPriceChange}
                      className="min-h-[44px] text-sm"
                    />
                    {customUnitPrice && <span className="text-xs text-orange-600">Custom price</span>}
                  </div>
                </div>
                <Button onClick={handleAddToCart} fullWidth disabled={submitting} className="w-full min-h-[44px]">
                  Add to sale
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-500 uppercase">Cart ({cart.reduce((s, l) => s + l.quantity, 0)} items)</label>
              {cart.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No items added</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {cart.map((line, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2 bg-white rounded-lg border border-slate-100">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{line.name}</div>
                        {line.variantLabel && <div className="text-xs text-gray-500">{line.variantLabel}</div>}
                        <div className="text-xs text-gray-500">{formatCurrency(line.unitPrice)} each</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleUpdateLineQty(idx, -1)} className="w-8 h-8 p-0">−</Button>
                        <span className="w-8 text-center text-sm font-medium">{line.quantity}</span>
                        <Button variant="outline" size="sm" onClick={() => handleUpdateLineQty(idx, 1)} className="w-8 h-8 p-0">+</Button>
                        <Button variant="outline" size="sm" onClick={() => handleRemoveLine(idx)} className="w-8 h-8 p-0 text-rose-600">
                          ×
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {itemsError && <p className="text-sm text-rose-600">{itemsError}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Delivery fee */}
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Delivery fee (optional)</label>
              <Input
                type="text"
                placeholder="0.00"
                value={deliveryFee.toFixed(2)}
                onChange={handleDeliveryFeeChange}
                className="min-h-[44px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Payment */}
        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  id="markPaid"
                  type="checkbox"
                  checked={markPaid}
                  onChange={handleTogglePaid}
                  className="w-5 h-5 rounded border-slate-300 text-royal-blue focus:ring-royal-blue"
                />
                <label htmlFor="markPaid" className="text-sm font-medium text-slate-700">Paid now</label>
              </div>
              {markPaid && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-500 uppercase">Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => handlePaymentMethodChange(m.value)}
                        className={`px-3 py-2 rounded-lg text-sm border text-center ${
                          paymentMethod === m.value ? 'border-royal-blue bg-royal-blue/10 text-royal-blue' : 'border-slate-200 bg-white text-gray-700'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  {paymentMethod ? (
                    <p className="text-xs text-green-600">Marked as paid: {paymentMethod}</p>
                  ) : (
                    <p className="text-xs text-rose-600">Select a payment method</p>
                  )}
                </div>
              )}
              {!markPaid && (
                <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-100 text-amber-800 text-sm">
                  Pay later — customer owes this amount
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Errors */}
        {submitError && (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-100">
            <p className="text-sm text-rose-800 mb-2">{submitError.message}</p>
            {submitError.products && submitError.products.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-rose-900 mb-1">Adjust quantities for:</p>
                {submitError.products.map((p, i) => (
                  <div key={i} className="text-xs text-rose-600">• {p.productName}</div>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleRetry} className="mt-3">
              Retry
            </Button>
          </div>
        )}

        {/* Sticky bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur border-t border-slate-200 p-4 sm:hidden z-40">
          <Button
            type="submit"
            disabled={submitting || cart.length === 0}
            fullWidth
            className="min-h-[52px] text-base font-semibold"
          >
            {submitting ? 'Recording sale...' : 'Record sale'}
          </Button>
        </div>
      </form>
    </div>
  )
}
