'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

const RESPONSE_TIME_ESTIMATE = 'a few minutes'

interface Message {
  id: string
  senderType: string
  senderId?: string
  senderName?: string | null
  message: string
  isRead: boolean
  createdAt: string
}

interface Conversation {
  id: string
  conversationRef: string
  status: string
  customerType: string
  lastMessageAt: string
  isReadByCustomer: boolean
  isReadByAdmin: boolean
  ticket: {
    id: string
    subject: string
    status: string
    type: string
    priority: string
    createdAt: string
    updatedAt: string
  }
}

export default function LiveSupportWidget({ userRole }: { userRole?: string | null }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [conversationRef, setConversationRef] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [subject, setSubject] = useState('')
  const [showSubject, setShowSubject] = useState(false)
  const [subjectError, setSubjectError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const isDashboard = (pathname ?? '').startsWith('/dashboard') || (pathname ?? '').startsWith('/vendor')

  const { data: conversationsData } = useQuery({
    queryKey: ['support-conversations'],
    queryFn: async () => {
      const res = await fetch('/api/support/conversations', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch conversations')
      return res.json() as Promise<{ conversations: Conversation[] }>
    },
    enabled: isOpen && !isDashboard,
  })

  useEffect(() => {
    if (conversationsData?.conversations?.length && !conversationRef) {
      const latest = conversationsData.conversations[0]
      setConversationRef(latest.conversationRef)
      setShowSubject(false)
    }
  }, [conversationsData, conversationRef])

  const { data: messagesData, refetch: refetchMessages } = useQuery({
    queryKey: ['support-messages', conversationRef],
    queryFn: async () => {
      if (!conversationRef) return { messages: [] }
      const res = await fetch('/api/support/conversations/' + conversationRef + '/messages', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch messages')
      return res.json() as Promise<{ messages: Message[] }>
    },
    enabled: isOpen && !!conversationRef && !isDashboard,
  })

  useEffect(() => {
    if (messagesData?.messages) {
      setMessages(messagesData.messages)
    }
  }, [messagesData])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!conversationRef || !isOpen || isDashboard) return

    setConnectionStatus('connecting')
    let isCancelled = false
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

    const connect = async () => {
      if (isCancelled) return

      try {
        setConnectionStatus('connecting')
        const res = await fetch('/api/support/conversations/' + conversationRef + '/stream')
        if (!res.ok) {
          setConnectionStatus('disconnected')
          if (!isCancelled) {
            reconnectTimeout = setTimeout(connect, 3000)
          }
          return
        }

        const reader = res.body?.getReader()
        if (!reader) {
          setConnectionStatus('disconnected')
          if (!isCancelled) {
            reconnectTimeout = setTimeout(connect, 3000)
          }
          return
        }

        setConnectionStatus('connected')
        const decoder = new TextDecoder()

        while (!isCancelled) {
          const { done, value } = await reader.read()
          if (done) {
            setConnectionStatus('disconnected')
            break
          }
          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n')
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === 'activity' || data.type === 'status') {
                  refetchMessages()
                }
              } catch {
                // ignore parse errors
              }
            }
          }
        }

        if (!isCancelled) {
          reconnectTimeout = setTimeout(connect, 3000)
        }
      } catch {
        if (!isCancelled) {
          setConnectionStatus('disconnected')
          reconnectTimeout = setTimeout(connect, 3000)
        }
      }
    }

    connect()

    return () => {
      isCancelled = true
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
    }
  }, [conversationRef, isOpen, isDashboard, refetchMessages])

  const createConversationMutation = useMutation({
    mutationFn: async (data: { subject: string; message: string; type: string }) => {
      const res = await fetch('/api/support/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create conversation')
      }
      return res.json() as Promise<{ ticket: unknown; conversationRef: string; initialMessage?: Message }>
    },
    onSuccess: (data) => {
      setConversationRef(data.conversationRef)
      setShowSubject(false)
      setSubjectError('')
      setErrorMessage('')
      setInput('')
      setSubject('')
      if (data.initialMessage) {
        setMessages(prev => {
          const exists = prev.some(m => m.id === data.initialMessage!.id)
          if (exists) return prev
          return [...prev, data.initialMessage!]
        })
      }
      refetchMessages()
      queryClient.invalidateQueries({ queryKey: ['support-conversations'] })
    },
    onError: (error: Error) => {
      setErrorMessage(error.message)
    },
  })

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!conversationRef) throw new Error('No conversation')
      const res = await fetch('/api/support/conversations/' + conversationRef + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to send message')
      }
      return res.json() as Promise<{ message: Message }>
    },
    onSuccess: (data) => {
      setMessages(prev => {
        const exists = prev.some(m => m.id === data.message.id)
        if (exists) return prev
        return [...prev, data.message]
      })
      refetchMessages()
      queryClient.invalidateQueries({ queryKey: ['support-conversations'] })
    },
    onError: (error: Error) => {
      setErrorMessage(error.message)
    },
  })

  const handleSend = useCallback(() => {
    if (!input.trim()) return

    if (!conversationRef && !showSubject) {
      setShowSubject(true)
      setSubjectError('')
      setErrorMessage('')
      return
    }

    if (!conversationRef && showSubject && !subject.trim()) {
      setSubjectError('Please add a subject')
      return
    }

    if (!conversationRef && showSubject) {
      setSubjectError('')
      setErrorMessage('')
      createConversationMutation.mutate(
        { subject: subject.trim(), message: input.trim(), type: 'GENERAL' }
      )
      return
    }

    sendMessageMutation.mutate(input.trim())
  }, [input, subject, conversationRef, showSubject, createConversationMutation, sendMessageMutation])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const getSenderLabel = (msg: Message) => {
    switch (msg.senderType) {
      case 'GUEST':
      case 'CUSTOMER':
        return 'You'
      case 'ADMIN':
        return msg.senderName || 'Support Agent'
      case 'SUPER_ADMIN':
        return msg.senderName || 'Support Manager'
      default:
        return msg.senderName || msg.senderType
    }
  }

  const unreadCount = conversationsData?.conversations?.filter((c) => !c.isReadByCustomer).length || 0

  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    return null
  }

  return (
    <div className="fixed bottom-24 right-5 z-[55]">
      {isOpen && (
        <div className="mb-4 w-[360px] max-w-[calc(100vw-40px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[500px]">
          <div className="bg-gradient-to-r from-deep-navy to-royal-blue text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Live Support</h3>
                <p className="text-xs text-white/70">
                  {conversationRef
                    ? connectionStatus === 'connected'
                      ? 'Online'
                      : connectionStatus === 'connecting'
                        ? 'Connecting...'
                        : 'Reconnecting...'
                    : 'Start a conversation'}
                </p>
              </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[360px]">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">Start a conversation with our support team.</p>
                <p className="text-gray-400 text-xs mt-2">We typically respond within {RESPONSE_TIME_ESTIMATE}.</p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={'flex ' + (msg.senderType === 'GUEST' || msg.senderType === 'CUSTOMER' ? 'justify-end' : 'justify-start')}>
                <div className={'max-w-[80%] rounded-2xl px-4 py-2 ' + (msg.senderType === 'GUEST' || msg.senderType === 'CUSTOMER' ? 'bg-royal-blue text-white rounded-br-sm' : 'bg-gray-100 text-gray-900 rounded-bl-sm')}>
                  {msg.senderType === 'ADMIN' || msg.senderType === 'SUPER_ADMIN' ? (
                    <p className="text-xs font-medium mb-1 text-royal-blue">{getSenderLabel(msg)}</p>
                  ) : null}
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  <p className={'text-xs mt-1 ' + (msg.senderType === 'GUEST' || msg.senderType === 'CUSTOMER' ? 'text-white/70' : 'text-gray-500')}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-100">
            {errorMessage && (
              <div className="text-red-600 text-sm mb-2">{errorMessage}</div>
            )}
            {showSubject && !conversationRef ? (
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Brief subject"
                  value={subject}
                  onChange={(e) => { setSubject(e.target.value); setSubjectError(''); setErrorMessage('') }}
                  className="text-sm"
                />
                {subjectError && <div className="text-red-600 text-sm">{subjectError}</div>}
              </div>
            ) : null}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={conversationRef ? 'Type a message...' : 'Describe your issue...'}
                value={input}
                onChange={(e) => { setInput(e.target.value); setErrorMessage('') }}
                onKeyDown={handleKeyDown}
                className="flex-1 text-sm"
                disabled={sendMessageMutation.isPending || createConversationMutation.isPending}
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!input.trim() || sendMessageMutation.isPending || createConversationMutation.isPending}
                className="px-4"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
      )}

      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full shadow-lg bg-gradient-to-r from-royal-blue to-deep-navy hover:shadow-xl relative"
        aria-label="Open Live Support"
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>
    </div>
  )
}
