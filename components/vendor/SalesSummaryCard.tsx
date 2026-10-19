'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatCurrency } from '@/lib/currency'
import {
  SALES_PERIOD_LABELS,
  salesPeriodRange,
  type SalesPeriodKey,
  type SalesSummaryResult,
} from '@/lib/sales-summary'

const PERIOD_TABS: SalesPeriodKey[] = ['today', '7d', '30d']

interface SalesSummaryCardProps {
  className?: string
}

export default function SalesSummaryCard({ className }: SalesSummaryCardProps) {
  // Only the tab the vendor is looking at is loaded. The card never asks for
  // the other two periods.
  const [period, setPeriod] = useState<SalesPeriodKey>('today')
  const [summary, setSummary] = useState<SalesSummaryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const range = useMemo(() => salesPeriodRange(period), [period])

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({ from: range.from, to: range.to })
      const res = await fetch(`/api/vendor/sales-summary?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not load your sales')
        return
      }
      const data: SalesSummaryResult = await res.json()
      setSummary(data)
    } catch (err) {
      console.error('Error loading sales summary:', err)
      setError('Could not load your sales')
    } finally {
      setLoading(false)
    }
  }, [range.from, range.to])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  const totals = summary?.totals
  const online = summary?.bySource?.find((row) => row.key === 'ONLINE')
  const manual = summary?.bySource?.find((row) => row.key === 'MANUAL')
  const missingCostProducts = summary?.coverage?.missingCostProducts ?? 0

  return (
    <Card variant="elevated" className={className}>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-deep-navy">Sales</h3>
          <div className="flex gap-2">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setPeriod(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors min-h-[36px] ${
                  period === tab
                    ? 'bg-royal-blue text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {SALES_PERIOD_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Revenue</p>
                <p className="text-2xl font-bold text-royal-blue">
                  {loading ? 'GH₵ 0.00' : formatCurrency(totals?.revenue ?? 0)}
                </p>
                <p className="text-xs text-slate-500">
                  {totals?.orders ?? 0} order(s) · {totals?.units ?? 0} unit(s)
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Profit</p>
                <p
                  className={`text-2xl font-bold ${
                    (totals?.profit ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {loading ? 'GH₵ 0.00' : formatCurrency(totals?.profit ?? 0)}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1 flex-wrap">
                  {summary?.profitLabel ?? 'Profit before other expenses'}
                  {totals?.estimated ? (
                    <Badge variant="warning" size="sm">
                      Estimated
                    </Badge>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Online</p>
                <p className="text-base font-semibold text-deep-navy">
                  {loading ? 'GH₵ 0.00' : formatCurrency(online?.revenue ?? 0)}
                </p>
                <p className="text-xs text-slate-500">{online?.orders ?? 0} order(s)</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Manual</p>
                <p className="text-base font-semibold text-deep-navy">
                  {loading ? 'GH₵ 0.00' : formatCurrency(manual?.revenue ?? 0)}
                </p>
                <p className="text-xs text-slate-500">{manual?.orders ?? 0} order(s)</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <Link
                href="/dashboard/vendor/orders?unpaid=true"
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 min-h-[44px] hover:bg-amber-100 transition-colors"
              >
                <span className="text-sm font-medium text-amber-900">Unpaid</span>
                <span className="text-sm font-semibold text-amber-900">
                  {loading
                    ? 'GH₵ 0.00 (0)'
                    : `${formatCurrency(summary?.receivables?.amount ?? 0)} (${
                        summary?.receivables?.count ?? 0
                      })`}
                </span>
              </Link>
            </div>

            {missingCostProducts > 0 ? (
              <div className="mt-4">
                <Link
                  href="/dashboard/vendor/products/costs"
                  className="block text-sm text-royal-blue hover:text-deep-navy font-medium"
                >
                  Add cost prices for {missingCostProducts} product
                  {missingCostProducts === 1 ? '' : 's'}
                </Link>
                <p className="text-xs text-slate-500 mt-1">
                  Profit is only exact once every product has a cost price.
                </p>
              </div>
            ) : null}

            <div className="mt-4">
              <Button asChild variant="outline" size="sm" className="min-h-[44px]">
                <Link href="/dashboard/vendor/sales">Open sales report</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
