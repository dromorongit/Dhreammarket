'use client'

import { useState, useEffect, ChangeEvent } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { formatCurrency } from '@/lib/currency'
import { formatGhanaPhoneNumber } from '@/lib/phone'
import { Badge } from '@/components/Badge'

interface Customer {
  id: string
  name: string
  phone: string
  email: string | null
  firstChannel: string | null
  orderCount: number
  totalSpent: number
  lastOrderAt: string | null
  tags: string[]
  notes: string | null
}

interface CustomerDetail extends Customer {
  lastOrderedItems: Array<{ productId: string; productName: string; quantity: number; unitPrice: number }>
}

export default function VendorCustomersPageClient() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Detail view
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editNotes, setEditNotes] = useState('')
  const [editTagsRaw, setEditTagsRaw] = useState('')

  useEffect(() => {
    fetchCustomers()
  }, [page, search])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString(), search })
      const res = await fetch(`/api/vendor/customers?${params}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to load customers')
        return
      }
      const data = await res.json()
      setCustomers(data.customers || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (err) {
      setError('An error occurred while loading customers')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const openDetail = async (customer: Customer) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const res = await fetch(`/api/vendor/customers/${customer.id}`)
      if (!res.ok) {
        const data = await res.json()
        setDetailError(data.error || 'Failed to load customer details')
        return
      }
      const data = await res.json()
      setDetail(data.customer)
      setEditName(data.customer.name)
      setEditEmail(data.customer.email || '')
      setEditTags(Array.isArray(data.customer.tags) ? data.customer.tags : [])
      setEditNotes(data.customer.notes || '')
      setEditTagsRaw((data.customer.tags || []).join(', '))
    } catch (err) {
      setDetailError('Failed to load customer details')
    } finally {
      setDetailLoading(false)
    }
  }

  const closeDetail = () => {
    setDetail(null)
    setDetailError(null)
    setEditName('')
    setEditEmail('')
    setEditTags([])
    setEditNotes('')
    setEditTagsRaw('')
  }

  const handleSave = async () => {
    if (!detail) return
    setSaving(true)
    try {
      const tags = editTagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      const body: any = {}
      if (editName.trim() !== detail.name) body.name = editName.trim()
      if (editEmail !== (detail.email || '')) body.email = editEmail.trim() || null
      body.tags = tags
      body.notes = editNotes.trim() || null

      const res = await fetch(`/api/vendor/customers/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        setDetailError(data.error || 'Failed to save changes')
        return
      }
      const data = await res.json()
      setDetail((prev) => prev ? { ...prev, name: data.customer.name, email: data.customer.email, tags: data.customer.tags, notes: data.customer.notes } : null)
      setEditTags(Array.isArray(data.customer.tags) ? data.customer.tags : [])
    } catch (err) {
      setDetailError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleNewSale = () => {
    if (!detail) return
    window.location.href = `/dashboard/vendor/quick-sale?phone=${encodeURIComponent(detail.phone)}`
  }

  if (loading && customers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Card>
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Customers</h2>
              <p className="text-gray-600 mb-6">{error}</p>
              <Button asChild>
                <Link href="/dashboard/vendor">Return to Dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/dashboard/vendor"
              className="text-orange-600 hover:text-orange-700 text-sm font-medium inline-flex items-center mb-4"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="text-gray-600 mt-1">Manage your repeat customers</p>
          </div>
          <Button asChild variant="primary" size="sm" className="min-h-[44px]">
            <Link href="/dashboard/vendor/quick-sale">New sale</Link>
          </Button>
        </div>

        {/* Search */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search by name, phone, or email..."
                value={search}
                onChange={handleSearchChange}
                className="w-full min-h-[44px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Customers list */}
        {customers.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
              <p className="text-gray-600">
                Customers who buy from you will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {customers.map((customer) => (
              <Card
                key={customer.id}
                className="cursor-pointer hover:shadow-md transition-shadow border border-slate-100"
                onClick={() => openDetail(customer)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{customer.name}</p>
                        <Badge variant="default" size="sm">
                          {customer.firstChannel ? customer.firstChannel.replace('_', ' ') : '—'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 truncate">{formatGhanaPhoneNumber(customer.phone)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(customer.totalSpent)}</p>
                      <p className="text-xs text-gray-500">{customer.orderCount} order{customer.orderCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                    <span>Last order:</span>
                    <span>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString('en-GH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-600">
                  Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, total)} of {total} customers
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detail view */}
        {detail && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Customer Details</h2>
              <Button variant="outline" size="sm" onClick={closeDetail}>Close</Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="p-6 space-y-5">
                  <h3 className="text-lg font-semibold text-gray-900">Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase">Name</label>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full min-h-[44px] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase">Phone (read-only)</label>
                      <input
                        value={formatGhanaPhoneNumber(detail.phone)}
                        readOnly
                        className="w-full min-h-[44px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-slate-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase">Email</label>
                      <input
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full min-h-[44px] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase">Tags (comma separated)</label>
                      <input
                        value={editTagsRaw}
                        onChange={(e) => setEditTagsRaw(e.target.value)}
                        className="w-full min-h-[44px] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase">Notes</label>
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={3}
                        className="w-full min-h-[44px] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-royal-blue/50"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex-1 min-h-[44px]"
                    >
                      {saving ? 'Saving...' : 'Save changes'}
                    </Button>
                    {detailError && (
                      <Button variant="outline" size="sm" onClick={() => setDetailError(null)}>
                        Dismiss
                      </Button>
                    )}
                  </div>
                  {detailError && (
                    <p className="text-sm text-rose-600">{detailError}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Order History</h3>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/vendor/quick-sale?phone=${encodeURIComponent(detail.phone)}`}>
                        New sale
                      </Link>
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Orders</span>
                      <span>{detail.orderCount}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Total spent</span>
                      <span>{formatCurrency(detail.totalSpent)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mb-4">
                      <span>Last order</span>
                      <span>{detail.lastOrderAt ? new Date(detail.lastOrderAt).toLocaleDateString('en-GH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                    </div>
                    {detail.lastOrderedItems && detail.lastOrderedItems.length > 0 ? (
                      <>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Last order items</h4>
                        <div className="space-y-2">
                          {detail.lastOrderedItems.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm text-gray-700">
                              <span className="truncate">{item.productName}{item.quantity > 1 ? ` ×${item.quantity}` : ''}</span>
                              <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-500 italic">No order items recorded.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
