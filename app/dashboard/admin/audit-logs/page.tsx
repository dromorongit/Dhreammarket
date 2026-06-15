'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

interface AuditLog {
  id: string
  userId: string
  userRole: string
  action: string
  entityType: string
  entityId: string | null
  beforeData: any
  afterData: any
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: {
    id: string
    email: string
    role: string
    profile?: {
      firstName: string | null
      lastName: string | null
    } | null
  }
}

const ACTION_TYPES = [
  'VENDOR_APPROVED', 'VENDOR_REJECTED', 'USER_SUSPENDED', 'USER_REACTIVATED',
  'ORDER_CANCELLED', 'ORDER_REFUNDED', 'PRODUCT_REMOVED', 'SUPPORT_TICKET_UPDATED',
  'KYC_APPROVED', 'KYC_REJECTED', 'PRODUCT_CREATED', 'PRODUCT_UPDATED',
  'PRODUCT_DELETED', 'INVENTORY_UPDATED', 'RESTOCK_ORDER_CREATED',
  'RESTOCK_ORDER_UPDATED', 'PURCHASE_ORDER_CREATED', 'PURCHASE_ORDER_UPDATED',
  'STORE_PROFILE_UPDATED', 'SUPPORT_TICKET_CREATED', 'PROFILE_UPDATED',
  'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'INVENTORY_CONSUMED',
  'INVENTORY_ALLOCATED', 'STOCK_RESERVED', 'STOCK_RELEASED'
]

const ENTITY_TYPES = ['USER', 'VENDOR', 'PRODUCT', 'ORDER', 'SUPPORT_TICKET', 'RESTOCK_ORDER', 'PURCHASE_ORDER', 'KYC_APPLICATION', 'INVENTORY', 'SYSTEM']

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 })
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  })
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      params.set('page', pagination.page.toString())
      params.set('limit', pagination.limit.toString())
      if (filters.action) params.set('action', filters.action)
      if (filters.entityType) params.set('entityType', filters.entityType)
      if (filters.userId) params.set('userId', filters.userId)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      if (filters.search) params.set('search', filters.search)

      const response = await fetch(`/api/admin/audit-logs?${params}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to load audit logs')
        return
      }

      setLogs(data.logs)
      setPagination(prev => ({ ...prev, ...data.pagination }))
    } catch (err) {
      setError('Failed to fetch audit logs')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters.action, filters.entityType, filters.userId, filters.dateFrom, filters.dateTo, filters.search])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getActionColor = (action: string) => {
    if (action.includes('APPROVED')) return 'bg-green-100 text-green-800'
    if (action.includes('REJECTED')) return 'bg-red-100 text-red-800'
    if (action.includes('CREATED')) return 'bg-blue-100 text-blue-800'
    if (action.includes('UPDATED') || action.includes('UPDATED')) return 'bg-amber-100 text-amber-800'
    if (action.includes('DELETED') || action.includes('REMOVED')) return 'bg-red-100 text-red-800'
    if (action.includes('CANCELLED')) return 'bg-red-100 text-red-800'
    if (action.includes('REFUNDED')) return 'bg-purple-100 text-purple-800'
    if (action.includes('CONFIRMED')) return 'bg-green-100 text-green-800'
    if (action.includes('FAILED')) return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: 'bg-purple-100 text-purple-800',
      ADMIN: 'bg-blue-100 text-blue-800',
      VENDOR: 'bg-emerald-100 text-emerald-800',
      CUSTOMER: 'bg-gray-100 text-gray-800',
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <Link href="/dashboard/admin" className="text-blue-600 hover:underline">
              ← Back to Dashboard
            </Link>
          </div>
          <div className="animate-pulse space-y-4">
            {[...Array(10)].map((_, i) => (
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button onClick={fetchLogs} className="mt-2 text-sm text-red-600 hover:underline">
              Try again
            </button>
          </div>
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
            <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-gray-600 mt-1">Track all critical platform actions</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <form onSubmit={(e) => { e.preventDefault(); setPagination(prev => ({ ...prev, page: 1 })); fetchLogs(); }} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <select
                value={filters.action}
                onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value, page: 1 }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Actions</option>
                {ACTION_TYPES.map(action => (
                  <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
                ))}
              </select>

              <select
                value={filters.entityType}
                onChange={(e) => setFilters(prev => ({ ...prev, entityType: e.target.value, page: 1 }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Entity Types</option>
                {ENTITY_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>

              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value, page: 1 }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Date From"
              />

              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value, page: 1 }))}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Date To"
              />

              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                placeholder="Search by email..."
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />

              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Filter
              </button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Activity Log</h2>
              <span className="text-sm text-gray-600">{pagination.total} records</span>
            </div>
          </CardHeader>
          {logs.length === 0 ? (
            <CardContent className="p-12 text-center">
              <EmptyState
                title="No audit logs found"
                description="No activity records match your current filters."
              />
            </CardContent>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entity</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP Address</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(log.user.role)}`}>
                              {log.user.role}
                            </span>
                            <p className="text-sm font-medium text-gray-900 mt-1">{log.user.email}</p>
                            {log.user.profile && (
                              <p className="text-xs text-gray-500">
                                {log.user.profile.firstName} {log.user.profile.lastName}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionColor(log.action)}`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-900">
                          {log.entityType}
                          {log.entityId && (
                            <span className="text-xs text-gray-500 block">ID: {log.entityId.slice(0, 8)}...</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600">
                          {log.ipAddress || '-'}
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            View Changes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-4 py-4 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Modal for viewing before/after data */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Audit Log Details
                </h3>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Action</p>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getActionColor(selectedLog.action)}`}>
                      {selectedLog.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Entity</p>
                    <p className="text-sm font-medium">{selectedLog.entityType}</p>
                    {selectedLog.entityId && (
                      <p className="text-xs text-gray-500">ID: {selectedLog.entityId}</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500">User</p>
                  <p className="text-sm font-medium">{selectedLog.user.email}</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(selectedLog.user.role)}`}>
                    {selectedLog.user.role}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Timestamp</p>
                  <p className="text-sm">{formatDate(selectedLog.createdAt)}</p>
                </div>

                {selectedLog.ipAddress && (
                  <div>
                    <p className="text-xs text-gray-500">IP Address</p>
                    <p className="text-sm font-mono">{selectedLog.ipAddress}</p>
                  </div>
                )}

                {selectedLog.beforeData && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Before Data</p>
                    <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto max-h-40">
                      {JSON.stringify(selectedLog.beforeData, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.afterData && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">After Data</p>
                    <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto max-h-40">
                      {JSON.stringify(selectedLog.afterData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}