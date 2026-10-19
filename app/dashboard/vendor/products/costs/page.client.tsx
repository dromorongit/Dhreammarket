'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { formatCurrency } from '@/lib/currency'

interface MissingCostItem {
  productId: string
  productName: string
  productVariantId: string | null
  variantLabel: string | null
  price: number
  costPrice: number | null
}

interface MissingCostResponse {
  items: MissingCostItem[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
  progress: { withCost: number; total: number; missing: number; percent: number }
}

export default function VendorProductCostsPageClient() {
  const [items, setItems] = useState<MissingCostItem[]>([])
  const [progress, setProgress] = useState<MissingCostResponse['progress'] | null>(null)
  const [pagination, setPagination] = useState<MissingCostResponse['pagination'] | null>(null)
  const [page, setPage] = useState(1)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/vendor/products/missing-cost?page=${page}&limit=20`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not load your products')
        return
      }
      const data: MissingCostResponse = await res.json()
      setItems(data.items || [])
      setProgress(data.progress || null)
      setPagination(data.pagination || null)
    } catch (err) {
      console.error('Error loading products without cost prices:', err)
      setError('Could not load your products')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const keyFor = (item: MissingCostItem) =>
    item.productVariantId ? `${item.productId}::${item.productVariantId}` : item.productId

  const saveCost = async (item: MissingCostItem) => {
    const key = keyFor(item)
    const raw = (drafts[key] ?? '').trim()
    if (raw === '') return

    const value = Number(raw)
    if (!Number.isFinite(value) || value < 0) {
      setError('Enter a cost of 0 or more')
      return
    }
    if (Math.round(value * 100) / 100 !== value) {
      setError('Use at most 2 decimal places')
      return
    }

    setSavingKey(key)
    setError(null)
    try {
      const body = item.productVariantId
        ? { variantCosts: [{ id: item.productVariantId, costPrice: value }] }
        : { costPrice: value }

      const res = await fetch(`/api/vendor/products/${item.productId}/quick`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not save the cost price')
        return
      }
      setSavedKey(key)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      await fetchItems()
    } catch (err) {
      console.error('Error saving cost price:', err)
      setError('Could not save the cost price')
    } finally {
      setSavingKey(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => window.history.back()}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-4 inline-flex items-center"
        >
          ← Back
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold text-deep-navy mb-2">Product costs</h1>
        <p className="text-sm text-slate-600 mb-6">
          Add what you pay for each product so your profit is accurate. A cost above the selling
          price is allowed — you will see a warning.
        </p>

        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <p className="text-sm font-semibold text-deep-navy">Cost coverage</p>
              <p className="text-sm text-slate-600">
                {progress ? `${progress.withCost} of ${progress.total} have costs` : '—'}
              </p>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(progress?.percent ?? 0, 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {progress?.percent ?? 0}% covered
              {progress?.missing ? ` · ${progress.missing} still missing` : ''}
            </p>
          </CardContent>
        </Card>

        {error ? <p className="text-sm text-rose-600 mb-4">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-slate-600">
                Every product has a cost price. Your profit figures are complete.
              </p>
              <Link
                href="/dashboard/vendor/sales"
                className="inline-block mt-3 text-sm font-medium text-royal-blue"
              >
                Back to sales
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => {
              const key = keyFor(item)
              const draft = drafts[key] ?? ''
              const numericDraft = Number(draft)
              const costAbovePrice =
                draft.trim() !== '' && Number.isFinite(numericDraft) && numericDraft > item.price

              return (
                <li key={key}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-deep-navy truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {item.variantLabel ? `${item.variantLabel} · ` : ''}
                            Sells at {formatCurrency(item.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            placeholder="Cost"
                            value={draft}
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            className="w-28 px-3 py-2 border border-slate-200 rounded-xl text-sm text-deep-navy bg-white focus:outline-none focus:ring-2 focus:ring-royal-blue min-h-[44px]"
                          />
                          <Button
                            size="sm"
                            className="min-h-[44px]"
                            disabled={draft.trim() === '' || savingKey === key}
                            onClick={() => saveCost(item)}
                          >
                            {savingKey === key ? 'Saving…' : 'Save'}
                          </Button>
                        </div>
                      </div>
                      {costAbovePrice ? (
                        <p className="text-xs text-amber-700 mt-2">
                          Warning: this cost is higher than the selling price of{' '}
                          {formatCurrency(item.price)}.
                        </p>
                      ) : null}
                      {savedKey === key ? (
                        <p className="text-xs text-emerald-700 mt-2">Cost saved.</p>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}

        {pagination && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} missing
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
