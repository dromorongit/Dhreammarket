'use client'

import { useEffect, useState, useCallback } from 'react'

interface WaitlistItem {
  id: string
  fullName: string
  email: string
  phone: string | null
  interest: string
  device: string | null
  source: string | null
  createdAt: string
}

interface Summary {
  total: number
  last7Days: number
  byInterest: { shopping: number; selling: number; both: number }
  byDevice: { android: number; ios: number; both: number; unknown: number }
}

export default function SuperAdminWaitlistClient() {
  const [items, setItems] = useState<WaitlistItem[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 })
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [interest, setInterest] = useState('all')
  const [device, setDevice] = useState('all')
  const [sort, setSort] = useState('newest')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const fetchData = useCallback(async (page: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      if (debouncedSearch) params.set('search', debouncedSearch)
      if (interest !== 'all') params.set('interest', interest)
      if (device !== 'all') params.set('device', device)
      params.set('sort', sort)
      const res = await fetch(`/api/admin/waitlist?${params.toString()}`, { cache: 'no-store' })
      if (res.status === 401 || res.status === 403) {
        setError('Access denied.')
        setItems([])
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setItems(data.items || [])
      setPagination(data.pagination || { page, limit: 25, total: 0, totalPages: 1 })
      setSummary(data.summary || null)
    } catch {
      setError('Failed to load waitlist. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, interest, device, sort])

  useEffect(() => {
    fetchData(1)
  }, [fetchData])

  const copyEmail = async (item: WaitlistItem) => {
    try {
      await navigator.clipboard.writeText(item.email)
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {}
  }

  const exportUrl = () => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (interest !== 'all') params.set('interest', interest)
    if (device !== 'all') params.set('device', device)
    return `/api/admin/waitlist/export?${params.toString()}`
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString()
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-dhream-navy mb-6">Waitlist Signups</h1>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs text-slate-500 uppercase">Total signups</p>
              <p className="text-2xl font-bold text-dhream-navy">{summary.total}</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs text-slate-500 uppercase">Last 7 days</p>
              <p className="text-2xl font-bold text-dhream-navy">{summary.last7Days}</p>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs text-slate-500 uppercase">Shopping / Selling / Both</p>
              <p className="text-lg font-bold text-dhream-navy">
                {summary.byInterest.shopping} / {summary.byInterest.selling} / {summary.byInterest.both}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow p-4">
              <p className="text-xs text-slate-500 uppercase">Android / iOS / Both / Unknown</p>
              <p className="text-sm font-bold text-dhream-navy">
                {summary.byDevice.android} / {summary.byDevice.ios} / {summary.byDevice.both} / {summary.byDevice.unknown}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow p-4 mb-6 flex flex-col sm:flex-row gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Search name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
          <select value={interest} onChange={(e) => setInterest(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All interests</option>
            <option value="shopping">Shopping</option>
            <option value="selling">Selling</option>
            <option value="both">Both</option>
          </select>
          <select value={device} onChange={(e) => setDevice(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="all">All devices</option>
            <option value="android">Android</option>
            <option value="ios">iOS</option>
            <option value="both">Both</option>
            <option value="unknown">Unknown</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <a
            href={exportUrl()}
            className="inline-flex items-center justify-center rounded-xl bg-dhream-navy text-white px-4 py-2 text-sm font-medium"
          >
            Export CSV
          </a>
        </div>

        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

        {/* Loading */}
        {loading && <div className="text-center py-12 text-slate-500">Loading...</div>}

        {/* Empty state */}
        {!loading && !error && items.length === 0 && (
          <div className="text-center py-12 text-slate-500">No one has joined the waitlist yet.</div>
        )}

        {/* Table (desktop) */}
        {!loading && items.length > 0 && (
          <>
            <div className="hidden md:block bg-white rounded-2xl shadow overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Full name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Interest</th>
                    <th className="px-4 py-3">Device</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Joined</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">{(pagination.page - 1) * pagination.limit + idx + 1}</td>
                      <td className="px-4 py-3">{item.fullName}</td>
                      <td className="px-4 py-3">{item.email}</td>
                      <td className="px-4 py-3">{item.phone || '-'}</td>
                      <td className="px-4 py-3 capitalize">{item.interest}</td>
                      <td className="px-4 py-3 capitalize">{item.device || '-'}</td>
                      <td className="px-4 py-3">{item.source || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.createdAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => copyEmail(item)}
                          className="text-dhream-navy hover:underline text-xs"
                        >
                          {copiedId === item.id ? 'Copied' : 'Copy email'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {items.map((item, idx) => (
                <div key={item.id} className="bg-white rounded-2xl shadow p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-dhream-navy">{item.fullName}</p>
                    <span className="text-xs text-slate-400">#{(pagination.page - 1) * pagination.limit + idx + 1}</span>
                  </div>
                  <p className="text-sm text-slate-700">{item.email}</p>
                  <p className="text-xs text-slate-500 mt-1">{item.phone || 'No phone'}</p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-slate-100 capitalize">{item.interest}</span>
                    <span className="px-2 py-1 rounded-full bg-slate-100 capitalize">{item.device || 'unknown'}</span>
                    {item.source && <span className="px-2 py-1 rounded-full bg-slate-100">{item.source}</span>}
                  </div>
                  <div className="flex justify-between items-center mt-3">
                    <span className="text-xs text-slate-400">{formatDate(item.createdAt)}</span>
                    <button onClick={() => copyEmail(item)} className="text-xs text-dhream-navy hover:underline">
                      {copiedId === item.id ? 'Copied' : 'Copy email'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex justify-center gap-2 mt-6">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchData(pagination.page - 1)}
                className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-3 py-1 text-sm text-slate-600">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchData(pagination.page + 1)}
                className="px-3 py-1 rounded-lg border text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
