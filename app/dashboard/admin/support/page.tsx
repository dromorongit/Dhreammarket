'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Skeleton } from '@/components/Skeleton'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

  interface SupportTicket {
    id: string
    subject: string
    message: string
    type: string
    status: string
    priority: string
    createdAt: string
    updatedAt: string
    user?: {
      id: string
      email: string
      profile: {
        firstName: string | null
        lastName: string | null
      } | null
    } | null
  }

interface SupportMessage {
  id: string
  senderType: string
  senderId?: string
  senderName?: string | null
  message: string
  isRead: boolean
  createdAt: string
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
  const [filters, setFilters] = useState({ status: '', type: '', priority: '' })
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [replyText, setReplyText] = useState('')
  const [newStatus, setNewStatus] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([])
  const queryClient = useQueryClient()

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

  useEffect(() => {
    const interval = setInterval(() => {
      fetchTickets()
    }, 10000)
    return () => clearInterval(interval)
  }, [fetchTickets])

  const { refetch: refetchTicketMessages } = useQuery({
    queryKey: ['admin-support-messages', selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return { messages: [] }
      const res = await fetch(`/api/admin/support/${selectedTicket.id}/messages`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json() as { messages: SupportMessage[] }
      setTicketMessages(data.messages || [])
      return data
    },
    enabled: !!selectedTicket,
  })

  useEffect(() => {
    if (selectedTicket) {
      refetchTicketMessages()
    }
  }, [selectedTicket, refetchTicketMessages])

  useEffect(() => {
    if (!selectedTicket?.id) return

    let isCancelled = false
    let interval: NodeJS.Timeout

    const connect = async () => {
      try {
        const res = await fetch(`/api/admin/support/${selectedTicket.id}/stream`)
        if (!res.ok) return

        const reader = res.body?.getReader()
        if (!reader) return

        const decoder = new TextDecoder()

        while (!isCancelled) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'activity' || data.type === 'status') {
                  refetchTicketMessages()
                  fetchTickets()
                }
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // retry on error
        setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      isCancelled = true
    }
  }, [selectedTicket?.id, refetchTicketMessages, fetchTickets])

  const sendReplyMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!selectedTicket) throw new Error('No ticket selected')
      const res = await fetch(`/api/admin/support/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send reply')
      }
      return res.json()
    },
    onSuccess: () => {
      setReplyText('')
      refetchTicketMessages()
      queryClient.invalidateQueries({ queryKey: ['support-conversations'] })
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicket) throw new Error('No ticket selected')
      const res = await fetch(`/api/admin/support/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus || selectedTicket.status }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update status')
      }
      return res.json()
    },
    onSuccess: (data) => {
      fetchTickets()
      if (data?.ticket) {
        setSelectedTicket(data.ticket as SupportTicket)
        setNewStatus((data.ticket as SupportTicket).status)
      }
    },
    onError: (error: Error) => {
      setError(error.message)
    },
  })

  const handleReply = () => {
    if (!replyText.trim()) return
    sendReplyMutation.mutate(replyText.trim())
  }

  const handleStatusChange = () => {
    updateStatusMutation.mutate()
  }

  const openTicketDetails = (ticket: SupportTicket) => {
    setSelectedTicket(ticket)
    setNewStatus(ticket.status)
    setReplyText('')
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
    if (!ticket.user) {
      return 'Guest'
    }
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
                    onClick={() => { setSelectedTicket(null); setTicketMessages([]) }}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
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

                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversation</h3>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto mb-4">
                    {ticketMessages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.senderType === 'CUSTOMER' || msg.senderType === 'GUEST' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          msg.senderType === 'CUSTOMER' || msg.senderType === 'GUEST'
                            ? 'bg-royal-blue text-white rounded-br-sm'
                            : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                        }`}>
                          {msg.senderType === 'ADMIN' || msg.senderType === 'SUPER_ADMIN' ? (
                            <p className="text-xs font-medium mb-1 text-royal-blue">
                              {msg.senderName || (msg.senderType === 'SUPER_ADMIN' ? 'Support Manager' : 'Support Agent')}
                            </p>
                          ) : null}
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <p className={`text-xs mt-1 ${msg.senderType === 'CUSTOMER' || msg.senderType === 'GUEST' ? 'text-white/70' : 'text-gray-500'}`}>
                            {formatDate(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

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
                      <Button variant="outline" size="sm" onClick={handleStatusChange} className="mt-2" disabled={updateStatusMutation.isPending}>
                        Update Status
                      </Button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reply to Customer
                      </label>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={4}
                        placeholder="Type your response here..."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                      />
                    </div>

                    <div className="flex gap-3">
                      <Button
                        variant="primary"
                        onClick={handleReply}
                        disabled={!replyText.trim() || sendReplyMutation.isPending}
                        className="flex-1"
                      >
                        {sendReplyMutation.isPending ? 'Sending...' : 'Send Reply'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setSelectedTicket(null); setTicketMessages([]) }}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
      </div>
    </div>
  )
}