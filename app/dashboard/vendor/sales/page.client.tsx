'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { formatCurrency } from '@/lib/currency'
import {
  SALES_PERIOD_LABELS,
  SALES_PERIOD_KEYS,
  salesPeriodRange,
  type SalesPeriodKey,
  type SalesSummaryResult,
} from '@/lib/sales-summary'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const PAYMENT_METHODS = ['MOBILE_MONEY', 'CASH', 'BANK_TRANSFER', 'OTHER'] as const

function receiptPath(token: string): string {
  if (typeof window === 'undefined') return `/receipt/${token}`
  return `${window.location.origin}/receipt/${token}`
}

function whatsappReminderLink(
  phone: string | null,
  customerName: string | null,
  displayNumber: string,
  total: number,
  receiptToken: string | null,
): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const receiptUrl = receiptToken ? receiptPath(receiptToken) : ''
  const name = customerName ? customerName.split(' ')[0] : ''
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const receiptLine = receiptUrl ? ` Receipt: ${receiptUrl}` : ''
  const message = `${greeting} a quick reminder about your order ${displayNumber} of GH₵ ${total.toFixed(2)}.${receiptLine} Thank you!`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export default function VendorSalesPageClient() {
  const [period, setPeriod] = useState<SalesPeriodKey>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [summary, setSummary] = useState<SalesSummaryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payingOrderId, setPayingOrderId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<string>('MOBILE_MONEY')
  const [actionError, setActionError] = useState<string | null>(null)

  const range = useMemo(
    () => salesPeriodRange(period, new Date(), { from: customFrom, to: customTo }),
    [period, customFrom, customTo],
  )

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

  const markAsPaid = async (orderId: string) => {
    setActionError(null)
    try {
      const res = await fetch(`/api/vendor/manual-orders/${orderId}/confirm-payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setActionError(data.error || 'Could not mark the order as paid')
        return
      }
      setPayingOrderId(null)
      await fetchSummary()
    } catch (err) {
      console.error('Error confirming payment:', err)
      setActionError('Could not mark the order as paid')
    }
  }

  const totals = summary?.totals
  const online = summary?.bySource?.find((row) => row.key === 'ONLINE')
  const manual = summary?.bySource?.find((row) => row.key === 'MANUAL')
  const missingCostProducts = summary?.coverage?.missingCostProducts ?? 0
  const exportUrl = `/api/vendor/sales-summary/export?from=${range.from}&to=${range.to}`

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/dashboard/vendor"
          className="text-orange-600 hover:text-orange-700 text-sm font-medium inline-flex items-center mb-4"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Back to Dashboard
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-deep-navy">Sales</h1>
          <a href={exportUrl} download>
            <Button variant="outline" size="sm" className="min-h-[44px]">
              Export CSV
            </Button>
          </a>
        </div>

        {/* Period picker */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-2">
              {SALES_PERIOD_KEYS.filter((key) => key !== 'custom').map((key) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={`px-3 py-2 text-sm font-medium rounded-xl transition-colors min-h-[44px] ${
                    period === key
                      ? 'bg-royal-blue text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {SALES_PERIOD_LABELS[key]}
                </button>
              ))}
              <button
                onClick={() => setPeriod('custom')}
                className={`px-3 py-2 text-sm font-medium rounded-xl transition-colors min-h-[44px] ${
                  period === 'custom'
                    ? 'bg-royal-blue text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Custom
              </button>
            </div>
            {period === 'custom' ? (
              <div className="flex flex-wrap gap-3 mt-4">
                <label className="flex-1 min-w-[140px]">
                  <span className="block text-xs text-slate-500 mb-1">From</span>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-deep-navy bg-white focus:outline-none focus:ring-2 focus:ring-royal-blue"
                  />
                </label>
                <label className="flex-1 min-w-[140px]">
                  <span className="block text-xs text-slate-500 mb-1">To</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm text-deep-navy bg-white focus:outline-none focus:ring-2 focus:ring-royal-blue"
                  />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-h-[44px] self-end"
                  onClick={fetchSummary}
                >
                  Apply
                </Button>
              </div>
            ) : null}
            <p className="text-xs text-slate-500 mt-3">
              {range.from} to {range.to} (Africa/Accra)
            </p>
          </CardContent>
        </Card>

        {error ? (
          <Card className="mb-6">
            <CardContent className="p-6">
              <p className="text-rose-600">{error}</p>
            </CardContent>
          </Card>
        ) : null}

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Revenue</p>
              <p className="text-2xl font-bold text-royal-blue">
                {loading ? 'GH₵ 0.00' : formatCurrency(totals?.revenue ?? 0)}
              </p>
              <p className="text-xs text-slate-500">
                {totals?.orders ?? 0} order(s) · {totals?.units ?? 0} unit(s)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
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
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Cost of goods sold</p>
              <p className="text-2xl font-bold text-deep-navy">
                {loading ? 'GH₵ 0.00' : formatCurrency(totals?.cogs ?? 0)}
              </p>
              <p className="text-xs text-slate-500">
                Coverage {totals?.costCoveragePercent ?? 100}%
                {totals?.missingCostItems ? ` · ${totals.missingCostItems} item(s) missing a cost` : ''}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-slate-500">Unpaid (all time)</p>
              <p className="text-2xl font-bold text-amber-600">
                {loading ? 'GH₵ 0.00' : formatCurrency(summary?.receivables?.amount ?? 0)}
              </p>
              <p className="text-xs text-slate-500">{summary?.receivables?.count ?? 0} order(s)</p>
            </CardContent>
          </Card>
        </div>

        {missingCostProducts > 0 ? (
          <Link
            href="/dashboard/vendor/products/costs"
            className="block mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 min-h-[44px] flex items-center hover:bg-amber-100 transition-colors"
          >
            Add cost prices for {missingCostProducts} product
            {missingCostProducts === 1 ? '' : 's'} — profit is only exact once every product
            has a cost price
          </Link>
        ) : null}

        {/* Source split */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-deep-navy mb-3">Online (Marketplace)</p>
              <p className="text-xl font-bold text-royal-blue">
                {loading ? 'GH₵ 0.00' : formatCurrency(online?.revenue ?? 0)}
              </p>
              <p className="text-xs text-slate-500">
                {online?.orders ?? 0} order(s) · profit{' '}
                {formatCurrency(online?.profit ?? 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm font-semibold text-deep-navy mb-3">Manual sales</p>
              <p className="text-xl font-bold text-emerald-600">
                {loading ? 'GH₵ 0.00' : formatCurrency(manual?.revenue ?? 0)}
              </p>
              <p className="text-xs text-slate-500">
                {manual?.orders ?? 0} order(s) · profit {formatCurrency(manual?.profit ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Daily chart */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold text-deep-navy mb-4">Daily revenue and profit</h2>
            <div className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary?.daily ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `GH₵${v}`} width={70} />
                  <Tooltip
                    formatter={(value) => [formatCurrency((value as number) ?? 0), 'Amount']}
                  />
                  <Legend />
                  <Bar dataKey="revenue" fill="#2563EB" name="Revenue" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" fill="#10B981" name="Profit" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Channel breakdown */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold text-deep-navy mb-4">Where the sales came from</h2>
            {summary?.byChannel?.length ? (
              <div className="space-y-3">
                {summary.byChannel.map((row) => (
                  <div key={row.key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700">{row.label}</span>
                    <span className="text-sm text-slate-500">
                      {row.orders} order(s) · {row.units} unit(s)
                    </span>
                    <span className="text-sm font-semibold text-deep-navy">
                      {formatCurrency(row.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No sales in this period yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Top products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="p-5">
              <h2 className="text-lg font-semibold text-deep-navy mb-4">Top products by units</h2>
              {summary?.topProductsByUnits?.length ? (
                <ul className="space-y-2">
                  {summary.topProductsByUnits.map((row) => (
                    <li
                      key={`${row.productId}-${row.productVariantId ?? 'default'}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-slate-700 truncate">
                        {row.productName}
                        {row.variantLabel ? ` — ${row.variantLabel}` : ''}
                      </span>
                      <span className="text-slate-500 shrink-0">{row.units} unit(s)</span>
                      <span className="font-semibold text-deep-navy shrink-0">
                        {formatCurrency(row.profit)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No products sold in this period.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h2 className="text-lg font-semibold text-deep-navy mb-4">Top products by profit</h2>
              {summary?.topProductsByProfit?.length ? (
                <ul className="space-y-2">
                  {summary.topProductsByProfit.map((row) => (
                    <li
                      key={`${row.productId}-${row.productVariantId ?? 'default'}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-slate-700 truncate">
                        {row.productName}
                        {row.variantLabel ? ` — ${row.variantLabel}` : ''}
                      </span>
                      <span className="text-slate-500 shrink-0">{row.units} unit(s)</span>
                      <span className="font-semibold text-deep-navy shrink-0">
                        {formatCurrency(row.profit)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No products sold in this period.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Receivables */}
        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-lg font-semibold text-deep-navy">Money still owed to you</h2>
              <p className="text-sm text-slate-600">
                {formatCurrency(summary?.receivables?.amount ?? 0)} ·{' '}
                {summary?.receivables?.count ?? 0} order(s) · all time
              </p>
            </div>
            {actionError ? <p className="text-sm text-rose-600 mb-3">{actionError}</p> : null}
            {summary?.receivables?.orders?.length ? (
              <ul className="space-y-3">
                {summary.receivables.orders.map((row) => {
                  const reminderLink = whatsappReminderLink(
                    row.customerPhone,
                    row.customerName,
                    row.displayNumber,
                    row.total,
                    row.receiptToken,
                  )
                  return (
                    <li
                      key={row.id}
                      className="border border-slate-200 rounded-xl p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-deep-navy">
                            Order #{row.displayNumber} · {formatCurrency(row.total)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {row.customerName || 'Customer'} · {row.channelLabel} ·{' '}
                            {row.ageDays === 0 ? 'today' : `${row.ageDays} day(s) ago`}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="success"
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => {
                              setPayingOrderId(payingOrderId === row.id ? null : row.id)
                              setActionError(null)
                            }}
                          >
                            Mark as paid
                          </Button>
                          {reminderLink ? (
                            <a
                              href={reminderLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center px-4 py-2 text-sm rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500/10 min-h-[44px]"
                            >
                              Send reminder on WhatsApp
                            </a>
                          ) : null}
                        </div>
                      </div>
                      {payingOrderId === row.id ? (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          {PAYMENT_METHODS.map((method) => (
                            <button
                              key={method}
                              onClick={() => setPaymentMethod(method)}
                              className={`px-3 py-2 text-xs font-medium rounded-lg min-h-[40px] ${
                                paymentMethod === method
                                  ? 'bg-royal-blue text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {method.replace('_', ' ')}
                            </button>
                          ))}
                          <Button
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => markAsPaid(row.id)}
                          >
                            Confirm {paymentMethod.replace('_', ' ')}
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Nothing is outstanding in this period.</p>
            )}
          </CardContent>
        </Card>

        {/* Refunds */}
        {summary?.refunds?.count ? (
          <Card className="mb-6">
            <CardContent className="p-5">
              <h2 className="text-lg font-semibold text-deep-navy mb-2">Refunds in this period</h2>
              <p className="text-sm text-slate-600">
                {formatCurrency(summary.refunds.amount)} refunded ·{' '}
                {summary.refunds.count} refund(s) · these orders are not counted as revenue
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
