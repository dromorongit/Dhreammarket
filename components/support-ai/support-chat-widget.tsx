'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { SupportChatMessage } from '@/components/support-ai/support-chat-message'
import { SupportChatMessageV2, extractSource } from '@/components/support-ai/support-chat-message'
import { WHATSAPP_SUPPORT_LINK, SUPPORT_EMAIL } from '@/lib/support-ai/knowledge-base'
import {
  SUPPORT_AI_V2_NOTICE_APPROVED,
  SUPPORT_AI_V2_NOTICE_NO_SECRETS,
} from '@/lib/support-ai/support-ai-constants'
import type { SupportChatMessage as SupportChatMessageType } from '@/lib/support-ai/types'

const GREETING: SupportChatMessageType = {
  id: 'greeting',
  role: 'bot',
  content: `Hi there! I'm the Dhream Market Support AI. I can help with:\n\n• Payment methods and policies\n• Refund and return information\n• Delivery expectations\n• How to register as a vendor\n• How to list products\n• Vendor payout timing\n• Order status lookups (log in required)\n• Payout/onboarding status (log in required)\n• Password reset help\n\nWhat can I help you with today?`,
  timestamp: new Date(),
}

type ViewMode = 'ai' | 'live'
type SupportAiMode = 'v1' | 'v2'

interface LiveMessage {
  id: string
  senderType: string
  senderId?: string
  senderName?: string | null
  message: string
  isRead: boolean
  createdAt: string
}

const V2_CHAT_TIMEOUT_MS = 20000
const CONFIG_TIMEOUT_MS = 5000

const HUMAN_SUPPORT_TEXT = `Support AI is temporarily unavailable. Please contact our human support team:\n\nWhatsApp: ${WHATSAPP_SUPPORT_LINK}\nEmail: ${SUPPORT_EMAIL}`

export function SupportChatWidget({ userRole }: { userRole?: string | null }) {
  const [mode, setMode] = useState<SupportAiMode | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), CONFIG_TIMEOUT_MS)

    fetch('/api/support-ai/config', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('config failed')
        const data = (await res.json()) as { mode?: string }
        return data.mode === 'v2' ? 'v2' : 'v1'
      })
      .then((resolved) => {
        if (!cancelled) {
          setMode(resolved)
          setConfigLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMode('v1')
          setConfigLoaded(true)
        }
      })

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [])

  if (!configLoaded) {
    return null
  }

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'
  if (isAdmin && mode !== 'v2') {
    return null
  }

  if (mode === 'v2') {
    return <V2Flow userRole={userRole} />
  }
  return <V1Flow userRole={userRole} />
}

// ========================================================================
// v1 flow — unchanged behaviour
// ========================================================================

function V1Flow({ userRole }: { userRole?: string | null }) {
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

// ========================================================================
// v2 flow
// ========================================================================

interface V2SupportMessageUI {
  id: string
  role: 'user' | 'bot'
  content: string
  timestamp: Date
  sourceTitle?: string
  traceId?: string
  reasonCode?: string
  action?: 'ANSWER' | 'ESCALATE' | 'REFUSE' | 'CLARIFY' | 'ERROR'
  rated?: boolean
  escalated?: boolean
  escalationRef?: string
  retry?: boolean
}

function V2Flow({ userRole }: { userRole?: string | null }) {
  const [isOpen, setIsOpen] = useState(false)
  const [v2Messages, setV2Messages] = useState<V2SupportMessageUI[]>([])
  const [v2Input, setV2Input] = useState('')
  const [v2Loading, setV2Loading] = useState(false)
  const [v2ConversationId] = useState(() => `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`)
  const [v2LastUserMessage, setV2LastUserMessage] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ratedRef = useRef<Set<string>>(new Set())
  const escalatedRef = useRef<Set<string>>(new Set())

  const isVendor = userRole === 'VENDOR'

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [v2Messages, scrollToBottom])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const clearAbort = useCallback(() => {
    if (abortRef.current) {
      try {
        abortRef.current.abort()
      } catch {
        /* ignore */
      }
      abortRef.current = null
    }
  }, [])

  useEffect(() => {
    return clearAbort
  }, [clearAbort])

  const splitSource = useCallback((message: string) => extractSource(message), [extractSource])

  const sendV2Message = useCallback(
    async (text: string) => {
      if (!text || v2Loading) return

      const userMessage: V2SupportMessageUI = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date(),
      }
      setV2Messages((prev) => [...prev, userMessage])
      setV2LastUserMessage(text)
      setV2Input('')
      setV2Loading(true)

      clearAbort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const timeout = setTimeout(() => ctrl.abort(), V2_CHAT_TIMEOUT_MS)

      try {
        const res = await fetch('/api/support-ai/v2/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, conversationId: v2ConversationId }),
          credentials: 'include',
          signal: ctrl.signal,
        })
        clearTimeout(timeout)

        if (res.status === 429) {
          throw new Error('rate_limited')
        }
        if (!res.ok) {
          throw new Error(`http ${res.status}`)
        }

        const data = await res.json()
        const action = data.action as
          | 'ANSWER'
          | 'ESCALATE'
          | 'REFUSE'
          | 'CLARIFY'
          | undefined

        if (action === 'ANSWER') {
          const { content, sourceTitle } = splitSource(typeof data.message === 'string' ? data.message : '')
          const bot: V2SupportMessageUI = {
            id: `bot_${Date.now()}`,
            role: 'bot',
            content,
            sourceTitle,
            traceId: typeof data.traceId === 'string' ? data.traceId : undefined,
            reasonCode: typeof data.reasonCode === 'string' ? data.reasonCode : undefined,
            action: 'ANSWER',
            timestamp: new Date(),
          }
          setV2Messages((prev) => [...prev, bot])
        } else if (action === 'ESCALATE' || action === 'REFUSE' || action === 'CLARIFY') {
          const bot: V2SupportMessageUI = {
            id: `bot_${Date.now()}`,
            role: 'bot',
            content: typeof data.message === 'string' ? data.message : '',
            traceId: typeof data.traceId === 'string' ? data.traceId : undefined,
            reasonCode: typeof data.reasonCode === 'string' ? data.reasonCode : undefined,
            action,
            timestamp: new Date(),
          }
          setV2Messages((prev) => [...prev, bot])
        } else {
          throw new Error('unexpected shape')
        }
      } catch {
        clearAbort()
        const bot: V2SupportMessageUI = {
          id: `bot_${Date.now()}`,
          role: 'bot',
          content: HUMAN_SUPPORT_TEXT,
          action: 'ERROR',
          retry: true,
          timestamp: new Date(),
        }
        setV2Messages((prev) => [...prev, bot])
      } finally {
        setV2Loading(false)
        abortRef.current = null
      }
    },
    [v2ConversationId, v2Loading, clearAbort, splitSource]
  )

  const handleV2Send = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      sendV2Message(v2Input.trim())
    },
    [v2Input, sendV2Message]
  )

  const handleRetry = useCallback(() => {
    if (v2Loading || !v2LastUserMessage) return
    sendV2Message(v2LastUserMessage)
  }, [v2LastUserMessage, v2Loading, sendV2Message])

  const handleFeedback = useCallback(
    async (messageId: string, helpful: boolean, reason?: string) => {
      if (ratedRef.current.has(messageId)) return
      ratedRef.current.add(messageId)

      const msg = v2Messages.find((m) => m.id === messageId)
      if (!msg || !msg.traceId) return

      try {
        await fetch('/api/support-ai/v2/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId: v2ConversationId,
            traceId: msg.traceId,
            helpful,
            reason: reason ?? null,
          }),
          credentials: 'include',
        })
        setV2Messages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, rated: true } : m)),
        )
      } catch {
        // Feedback errors must not break the chat.
      }
    },
    [v2ConversationId, v2Messages]
  )

  const handleTalkToHuman = useCallback(
    async (messageId: string) => {
      if (escalatedRef.current.has(messageId)) return
      escalatedRef.current.add(messageId)

      try {
        const res = await fetch('/api/support-ai/v2/escalate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId: v2ConversationId }),
          credentials: 'include',
        })
        if (!res.ok) {
          throw new Error('escalate failed')
        }
        const data = await res.json()
        setV2Messages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, escalated: true, escalationRef: String(data.reference ?? '') } : m,
          ),
        )
      } catch {
        setV2Messages((prev) => [
          ...prev,
          { id: `bot_${Date.now()}`, role: 'bot', content: HUMAN_SUPPORT_TEXT, action: 'ERROR', timestamp: new Date() },
        ])
      }
    },
    [v2ConversationId]
  )

  return (
    <div className="fixed bottom-24 right-5 z-[55]">
      {isOpen && (
        <div className="mb-4 w-[360px] max-w-[calc(100vw-40px)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col max-h-[500px]">
          <div className="bg-gradient-to-r from-deep-navy to-royal-blue text-white p-4 rounded-t-2xl flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Dhream Market Support AI</h3>
              <p className="text-xs text-white/70">
                {isVendor ? 'Vendor Help' : 'Buyer Help'} — Always here for you
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1 min-h-[300px] max-h-[360px]">
            {v2Messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}
              >
                <SupportChatMessageV2
                  message={msg}
                  onFeedback={handleFeedback}
                  onTalkToHuman={handleTalkToHuman}
                  rated={msg.rated}
                  escalated={msg.escalated}
                  escalationRef={msg.escalationRef}
                />
                {msg.action === 'ERROR' && msg.retry && (
                  <button
                    onClick={handleRetry}
                    className="mt-2 text-xs font-semibold text-royal-blue underline underline-offset-2 hover:text-deep-navy transition-colors"
                  >
                    Retry
                  </button>
                )}
              </div>
            ))}
            {v2Loading && (
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
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-100 flex-shrink-0">
            <div className="text-xs text-slate-500 p-2 mb-2 leading-relaxed">
              {SUPPORT_AI_V2_NOTICE_APPROVED}
              <br />
              {SUPPORT_AI_V2_NOTICE_NO_SECRETS}
            </div>
            <form onSubmit={handleV2Send} className="flex gap-2">
              <Input
                ref={inputRef}
                type="text"
                placeholder={isVendor ? 'Ask about payouts, listings...' : 'Ask about orders, payments...'}
                value={v2Input}
                onChange={(e) => setV2Input(e.target.value)}
                disabled={v2Loading}
                className="flex-1 text-base md:text-sm"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!v2Input.trim() || v2Loading}
                className="px-3"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </Button>
            </form>
          </div>
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
