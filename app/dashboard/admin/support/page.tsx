'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Skeleton } from '@/components/Skeleton'
import Link from 'next/link'

interface SupportTicket {
  id: string
  subject: string
  message: string
  type: string
  status: string
  priority: string
  adminReply: string | null
  createdAt: string
  updatedAt: string
  user: {
    id: string
    email: string
    profile: {
      firstName: string | null
      lastName: string | null
    } | null
  }
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: 'Open', color: 'text-blue-700', bg: 'bg-blue-100' },
  IN_PROGRESS: { label: 'In Progress', color: 'text-amber-700', bg: 'bg-amber-100' },
  RESOLVED: { label: 'Resolved', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  CLOSED: { label: 'Closed', color: 'text-slate-700', bg: 'bg-slate-100' },
}

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  LOW: { label: 'Low', color: 'text-slate-700', bg: 'bg-slate-100' },
  MEDIUM: { label: 'Medium', color: 'text-amber-700', bg: 'bg-amber-100' },
  HIGH: { label: 'High', color: 'text-orange-700', bg: 'bg-orange-100' },
  URGENT: { label: 'Urgent', color: 'text-red-700', bg: 'bg-red-100' },
}

const typeLabels: Record<string, string> = {
  GENERAL: 'General Inquiry',
  PAYMENT: 'Payment Issue',
  ORDER: 'Order Problem',
  VENDOR: 'Vendor Related',
  ACCOUNT: 'Account Issue',
  TECHNICAL: 'Technical Support',
  REPORT: 'Report a Problem',
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    priority: '',
  })
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [replyText, setReplyText] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [newPriority, setNewPriority] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchQuery) params.set('search', searchQuery)
      if (filters.status) params.set('status', filters.status)
      if (filters.type) params.set('type', filters.type)
      if (filters.priority) params.set('priority', filters.priority)

      const response = await fetch(`/api/admin/support?${params}`)
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to load tickets')
        return
      }

      setTickets(data.tickets || [])
      setStatusCounts(data.statusCounts || {})
    } catch (err) {
      setError('Failed to fetch tickets')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, filters])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  const handleUpdateTicket = async () => {
    if (!selectedTicket) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/admin/support/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus || selectedTicket.status,
          priority: newPriority || selectedTicket.priority,
          adminReply: replyText,
        }),
      })

      if (response.ok) {
        setSelectedTicket(null)
        setReplyText('')
        fetchTickets()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update ticket')
      }
    } catch (error) {
      console.error('Error updating ticket:', error)
      alert('Failed to update ticket')
    } finally {
      setIsUpdating(false)
    }
  }

  const openTicketDetails = (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    setNewStatus(ticket.status)
    setNewPriority(ticket.priority)
    setReplyText(ticket.adminReply || '')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getUserName = (ticket: SupportTicket) => {
    if (ticket.user.profile?.firstName) {
      return `${ticket.user.profile.firstName} ${ticket.user.profile.lastName || ''}`.trim()
    }
    return ticket.user.email.split('@')[0]
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
            <button onClick={fetchTickets} className="mt-2 text-sm text-red-600 hover:underline">
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
            <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
            <p className="text-gray-600 mt-1">Manage customer support requests</p>
          </div>
          <Button variant="primary" onClick={fetchTickets}>
            Refresh
          </Button>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(statusConfig).map(([key, config]) => (
            <Card key={key} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{statusCounts[key] || 0}</p>
                    <p className="text-sm text-gray-600">{config.label}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Search tickets by subject, message, or user email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Status</option>
                  {Object.entries(statusConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Types</option>
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">All Priorities</option>
                  {Object.entries(priorityConfig).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}</option>
                  ))}
                </select>
                <Button variant="outline" onClick={() => {
                  setSearchQuery('')
                  setFilters({ status: '', type: '', priority: '' })
                }}>
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Table */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Ticket List</h2>
              <span className="text-sm text-gray-600">{tickets.length} tickets</span>
            </div>
          </CardHeader>
          {loading ? (
            <CardContent className="p-8">
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="border-b border-gray-100 pb-4 last:border-0">
                    <div className="flex items-start justify-between mb-2">
                      <Skeleton className="h-5 w-1/3" />
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ))}
              </div>
            </CardContent>
          ) : tickets.length === 0 ? (
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets found</h3>
              <p className="text-gray-500">No support tickets match your current filters.</p>
            </CardContent>
          ) : (
            <div className="divide-y divide-gray-200">
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openTicketDetails(ticket)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {ticket.subject}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityConfig[ticket.priority]?.bg || 'bg-gray-100'} ${priorityConfig[ticket.priority]?.color || 'text-gray-700'}`}>
                          {priorityConfig[ticket.priority]?.label || ticket.priority}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[ticket.status]?.bg || 'bg-gray-100'} ${statusConfig[ticket.status]?.color || 'text-gray-700'}`}>
                          {statusConfig[ticket.status]?.label || ticket.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
                        <span className="font-medium text-gray-700">{getUserName(ticket)}</span>
                        <span>•</span>
                        <span>{typeLabels[ticket.type] || ticket.type}</span>
                        <span>•</span>
                        <span>{formatDate(ticket.createdAt)}</span>
                      </div>
                      <p className="text-gray-600 line-clamp-2">{ticket.message}</p>
                      {ticket.adminReply && (
                        <div className="mt-2 flex items-center gap-2">
                          <svg className="w-4 h-4 text-royal-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          <span className="text-sm text-royal-blue">Admin has replied</span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        openTicketDetails(ticket)
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Ticket Detail Modal */}
        {selectedTicket && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedTicket.subject}</h2>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span>{getUserName(selectedTicket)}</span>
                      <span>•</span>
                      <span>{formatDate(selectedTicket.createdAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Ticket Details */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="default">{typeLabels[selectedTicket.type] || selectedTicket.type}</Badge>
                    <Badge variant="default" className={`${priorityConfig[selectedTicket.priority]?.bg} ${priorityConfig[selectedTicket.priority]?.color}`}>
                      {priorityConfig[selectedTicket.priority]?.label || selectedTicket.priority} Priority
                    </Badge>
                    <Badge variant="default" className={`${statusConfig[selectedTicket.status]?.bg} ${statusConfig[selectedTicket.status]?.color}`}>
                      {statusConfig[selectedTicket.status]?.label || selectedTicket.status}
                    </Badge>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.message}</p>
                  </div>
                </div>

                {/* Admin Reply Section */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Response</h3>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Update Status
                      </label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Update Priority
                      </label>
                      <select
                        value={newPriority}
                        onChange={(e) => setNewPriority(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(priorityConfig).map(([key, config]) => (
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reply to Customer
                      </label>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={5}
                        placeholder="Type your response here..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="primary"
                        onClick={handleUpdateTicket}
                        disabled={isUpdating}
                        className="flex-1"
                      >
                        {isUpdating ? 'Updating...' : 'Update & Reply'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setSelectedTicket(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Existing Admin Reply */}
                {selectedTicket.adminReply && (
                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Previous Admin Reply</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.adminReply}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Sent on {formatDate(selectedTicket.updatedAt)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
