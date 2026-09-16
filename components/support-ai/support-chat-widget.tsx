'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { SupportChatMessage } from '@/components/support-ai/support-chat-message'
import { WHATSAPP_SUPPORT_LINK } from '@/lib/support-ai/knowledge-base'
import type { SupportChatMessage as SupportChatMessageType } from '@/lib/support-ai/types'

const GREETING: SupportChatMessageType = {
  id: 'greeting',
  role: 'bot',
  content: `Hi there! I'm the Dhream Market Support AI. I can help with:\n\n• Payment methods and policies\n• Refund and return information\n• Delivery expectations\n• How to register as a vendor\n• How to list products\n• Vendor payout timing\n• Order status lookups (log in required)\n• Payout/onboarding status (log in required)\n• Password reset help\n\nWhat can I help you with today?`,
  timestamp: new Date(),
}

type ViewMode = 'ai' | 'live'

interface LiveMessage {
  id: string
  senderType: string
  senderId?: string
  senderName?: string | null
  message: string
  isRead: boolean
  createdAt: string
}

export function SupportChatWidget({ userRole }: { userRole?: string | null }) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<ViewMode>('ai')
  const [aiMessages, setAiMessages] = useState<SupportChatMessageType[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [aiMessages, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const isVendor = userRole === 'VENDOR'

  const handleAiSend = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = input.trim()
      if (!trimmed || loading) return

      setError('')

      const userMessage: SupportChatMessageType = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date(),
      }

      setAiMessages((prev) => [...prev, userMessage])
      setInput('')
      setLoading(true)

      try {
        const res = await fetch('/api/support-ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
          credentials: 'include',
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Something went wrong. Please try again.')
        }

        const botMessage: SupportChatMessageType = {
          id: `bot_${Date.now()}`,
          role: 'bot',
          content: data.response,
          timestamp: new Date(),
          confidence: data.confidence,
          suggestedEscalation: data.suggestedEscalation,
        }

        setAiMessages((prev) => [...prev, botMessage])
      } catch {
        const fallback: SupportChatMessageType = {
          id: `bot_${Date.now()}`,
          role: 'bot',
          content: `Something went wrong. Please try again or contact our support team:\n\nWhatsApp: ${WHATSAPP_SUPPORT_LINK}`,
          timestamp: new Date(),
          suggestedEscalation: true,
        }
        setAiMessages((prev) => [...prev, fallback])
      } finally {
        setLoading(false)
      }
    },
    [input, loading]
  )

  const handleEscalate = useCallback(() => {
    setView('live')
  }, [])

  const handleBackToAi = useCallback(() => {
    setView('ai')
  }, [])

  if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN') {
    return null
  }

  return (
    <div className="fixed bottom-24 right-5 z-[55]">
      {isOpen && (
        <div className="mb-4 w-[360px] max-w-[calc(100vw-40px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[500px]">
          <div className="bg-gradient-to-r from-deep-navy to-royal-blue text-white p-4 rounded-t-2xl flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">
                {view === 'ai' ? 'Dhream Market Support AI' : 'Live Support'}
              </h3>
              <p className="text-xs text-white/70">
                {view === 'ai'
                  ? (isVendor ? 'Vendor Help' : 'Buyer Help') + ' — Always here for you'
                  : 'Chat with our support team'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {view === 'live' && (
                <button
                  onClick={handleBackToAi}
                  className="text-xs bg-white/20 hover:bg-white/30 rounded-full px-3 py-1 transition-colors"
                >
                  Back to AI
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-[300px] max-h-[360px]">
            {view === 'ai' ? (
              <>
                {aiMessages.map((msg) => (
                  <SupportChatMessage
                    key={msg.id}
                    message={msg}
                    onEscalate={msg.suggestedEscalation ? handleEscalate : undefined}
                  />
                ))}
                {loading && (
                  <div className="flex justify-start mb-3">
                    <div className="bg-slate-100 text-slate-900 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[85%]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                {!loading && (
                  <div className="pt-2 border-t border-gray-100">
                    <button
                      onClick={handleEscalate}
                      className="w-full text-sm font-medium text-royal-blue bg-royal-blue/10 hover:bg-royal-blue/20 rounded-xl px-4 py-2.5 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Talk to a human
                    </button>
                  </div>
                )}
              </>
            ) : (
              <LiveSupportConversation />
            )}
            <div ref={messagesEndRef} />
          </div>

          {view === 'ai' && (
            <div className="p-3 border-t border-gray-100 flex-shrink-0">
              {error && (
                <div className="px-4 py-2 text-red-600 text-xs bg-red-50 border-t border-gray-100">
                  {error}
                </div>
              )}
              <form onSubmit={handleAiSend} className="flex gap-2">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder={isVendor ? 'Ask about payouts, listings...' : 'Ask about orders, payments...'}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError('') }}
                  disabled={loading}
            className="flex-1 text-base md:text-sm"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!input.trim() || loading}
                  className="px-3"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </Button>
              </form>
            </div>
          )}
        </div>
      )}

      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full shadow-lg bg-gradient-to-r from-royal-blue to-deep-navy hover:shadow-xl relative"
        aria-label={isOpen ? 'Close Dhream Market Support AI' : 'Open Dhream Market Support AI'}
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
      </Button>
    </div>
  )
}

function LiveSupportConversation() {
  const [conversationRef, setConversationRef] = useState<string | null>(null)
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [input, setInput] = useState('')
  const [subject, setSubject] = useState('')
  const [showSubject, setShowSubject] = useState(false)
  const [subjectError, setSubjectError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!conversationRef) return

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
                  fetchMessages()
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

    const fetchMessages = async () => {
      if (!conversationRef) return
      try {
        const res = await fetch('/api/support/conversations/' + conversationRef + '/messages', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { messages: LiveMessage[] }
        setMessages(data.messages)
      } catch {
        // ignore
      }
    }

    const fetchConversations = async () => {
      try {
        const res = await fetch('/api/support/conversations', { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { conversations: { conversationRef: string }[] }
        if (data.conversations?.length && !conversationRef) {
          setConversationRef(data.conversations[0].conversationRef)
          setShowSubject(false)
        }
      } catch {
        // ignore
      }
    }

    fetchConversations()
    fetchMessages()
    connect()

    return () => {
      isCancelled = true
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
    }
  }, [conversationRef])

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
      setInput('')
      const trimmedSubject = subject.trim()
      const trimmedInput = input.trim()

      fetch('/api/support/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: trimmedSubject, message: trimmedInput, type: 'GENERAL' }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const error = await res.json()
            throw new Error(error.error || 'Failed to create conversation')
          }
          return res.json() as Promise<{ conversationRef: string; initialMessage?: LiveMessage }>
        })
        .then((data) => {
          setConversationRef(data.conversationRef)
          setShowSubject(false)
          setSubject('')
          if (data.initialMessage) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === data.initialMessage!.id)
              if (exists) return prev
              return [...prev, data.initialMessage!]
            })
          }
        })
        .catch((err) => {
          setErrorMessage(err.message)
        })
      return
    }

    const trimmed = input.trim()
    setInput('')
    fetch('/api/support/conversations/' + conversationRef + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.error || 'Failed to send message')
        }
        return res.json() as Promise<{ message: LiveMessage }>
      })
      .then((data) => {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === data.message.id)
          if (exists) return prev
          return [...prev, data.message]
        })
      })
      .catch((err) => {
        setErrorMessage(err.message)
      })
  }, [input, subject, conversationRef, showSubject])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const getSenderLabel = (msg: LiveMessage) => {
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

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[360px]">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm">Start a conversation with our support team.</p>
            <p className="text-gray-400 text-xs mt-2">We typically respond within a few minutes.</p>
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
              className="text-base md:text-sm"
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
             className="flex-1 text-base md:text-sm"
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </div>
      </div>
    </>
  )
}