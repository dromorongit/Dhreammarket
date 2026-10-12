'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { EmptyState } from '@/components/EmptyState'

interface RefundRequestItem {
  orderId: string
  orderRef: string
  cancelledAt: string
  requestSource: 'CUSTOMER_CANCEL' | 'VENDOR_REJECTION' | 'NONE_RECORDED'
  total: number
  currency: string | null
  walletAssisted: boolean
  orderType: string
  storeName: string | null
  ageDays: number
  refundStatus: string | null
}

const PAGE_SIZE = 25

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAmount(total: number, currency: string | null) {
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: currency || 'GHS',
    }).format(total)
  } catch {
    return `${currency || 'GHS'} ${total}`
  }
}

function getSourceBadge(source: RefundRequestItem['requestSource']) {
  const colors: Record<RefundRequestItem['requestSource'], string> = {
    CUSTOMER_CANCEL: 'bg-blue-100 text-blue-800',
    VENDOR_REJECTION: 'bg-amber-100 text-amber-800',
    NONE_RECORDED: 'bg-gray-100 text-gray-800',
  }
  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${colors[source]}`}>
      {source === 'NONE_RECORDED' ? 'NO REQUEST RECORDED' : source.replace(/_/g, ' ')}
    </span>
  )
}

export default function RefundRequestsPage() {
  const [items, setItems] = useState<RefundRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/admin/refund-requests?page=${page}&limit=${PAGE_SIZE}`
      )
      const data = await response.json()

      if (response.status === 401 || response.status === 403) {
        setError('You do not have permission to view the refund request queue.')
        return
      }

      if (!response.ok) {
        setError(data.error || 'Failed to load refund requests')
        return
      }

      setItems(data.items || [])
      setHasMore(Boolean(data.pagination?.hasMore))
      setError(null)
    } catch (err) {
      console.error('Error fetching refund requests:', err)
      setError('Failed to fetch refund requests')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  if (loading && items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/dashboard/admin" className="text-blue-600 hover:underline">
              ← Back to Dashboard
            </Link>
          </div>
          <div className="animate-pulse space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
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
          <div className="mb-6">
            <Link href="/dashboard/admin" className="text-blue-600 hover:underline">
              ← Back to Dashboard
            </Link>
          </div>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/dashboard/admin" className="text-blue-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Refund Requests</h1>
            <p className="text-gray-600 mt-1">
              Cancelled paid orders waiting for a refund decision
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pending Queue</h2>
            </div>
          </CardHeader>
          {items.length === 0 ? (
            <CardContent className="p-12 text-center">
              <EmptyState
                title="No refund requests waiting"
                description="Every cancelled paid order appears here until its refund is decided."
              />
            </CardContent>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor Store</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cancelled</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age (days)</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flags</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order Page</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.orderId} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm text-gray-900">
                          <span className="font-medium">{item.orderRef}</span>
                          <span className="text-xs text-gray-500 block">{item.orderType}</span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {item.storeName || '-'}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {formatAmount(item.total, item.currency)}
                        </td>
                        <td className="px-4 py-4">{getSourceBadge(item.requestSource)}</td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {formatDate(item.cancelledAt)}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">{item.ageDays}</td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            {item.walletAssisted && (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                WALLET: manual handling required
                              </span>
                            )}
                            {item.refundStatus && (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                                {item.refundStatus}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/dashboard/admin/orders/${item.orderId}`}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Open Order
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 py-4 border-t flex items-center justify-between">
                <div className="text-sm text-gray-600">Page {page}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(prev => prev + 1)}
                    disabled={!hasMore}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
