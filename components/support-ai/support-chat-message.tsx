'use client'

import { useState } from 'react'

interface SupportChatMessageProps {
  message: {
    id: string
    role: 'user' | 'bot'
    content: string
    timestamp: Date
    confidence?: number
    suggestedEscalation?: boolean
  }
  onEscalate?: () => void
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function SupportChatMessage({ message, onEscalate }: SupportChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-royal-blue text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-900 rounded-bl-sm'
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-deep-navy to-royal-blue flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-royal-blue">Dhream Market Support AI</span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {message.suggestedEscalation && onEscalate && (
          <button
            onClick={onEscalate}
            className="mt-2 text-xs font-semibold text-royal-blue underline underline-offset-2 hover:text-deep-navy transition-colors"
          >
            Talk to a human
          </button>
        )}
        <p className={`text-xs mt-1 ${isUser ? 'text-white/70' : 'text-slate-400'}`}>
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  )
}

// --- v2 message -----------------------------------------------------------

export interface V2SupportMessage {
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
}

interface SupportChatMessageV2Props {
  message: V2SupportMessage
  onFeedback?: (id: string, helpful: boolean, reason?: string) => void
  onTalkToHuman?: (id: string) => void
  rated?: boolean
  escalated?: boolean
  escalationRef?: string
}

function formatSourceTitle(sourceTitle?: string): string {
  if (!sourceTitle) return ''
  return `Source: ${sourceTitle}`
}

/** Splits a v2 answer into body and source title. The server appends "\n\nSource: <title>". */
export function extractSource(message: string): { content: string; sourceTitle?: string } {
  const idx = message.lastIndexOf('\n\nSource: ')
  if (idx === -1) return { content: message }
  return { content: message.slice(0, idx), sourceTitle: message.slice(idx + 10) }
}

export function SupportChatMessageV2({
  message,
  onFeedback,
  onTalkToHuman,
  rated = false,
  escalated = false,
  escalationRef,
}: SupportChatMessageV2Props) {
  const isUser = message.role === 'user'
  const [reason, setReason] = useState('')
  const [sendingFeedback, setSendingFeedback] = useState(false)

  const isAnswer = message.action === 'ANSWER'
  const showHuman = !isUser && message.action !== 'ERROR' && !escalated && onTalkToHuman

  const sendFeedback = (helpful: boolean) => {
    if (!onFeedback || rated) return
    setSendingFeedback(true)
    const trimmedReason = reason.trim()
    const reasonToSend = trimmedReason.length > 0 ? trimmedReason : undefined
    onFeedback(message.id, helpful, reasonToSend)
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-royal-blue text-white rounded-br-sm'
            : 'bg-slate-100 text-slate-900 rounded-bl-sm'
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-deep-navy to-royal-blue flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <span className="text-[11px] font-semibold text-royal-blue">Dhream Market Support AI</span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {isAnswer && message.sourceTitle && (
          <p className="text-xs mt-1 font-medium text-royal-blue">{formatSourceTitle(message.sourceTitle)}</p>
        )}
        {isAnswer && !rated && onFeedback && (
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-xs text-slate-500">Was this helpful?</span>
            <button
              onClick={() => sendFeedback(true)}
              disabled={sendingFeedback}
              className="text-xs rounded p-1.5 hover:bg-slate-200 transition-colors"
              aria-label="Helpful"
            >
              👍
            </button>
            <button
              onClick={() => sendFeedback(false)}
              disabled={sendingFeedback}
              className="text-xs rounded p-1.5 hover:bg-slate-200 transition-colors"
              aria-label="Not helpful"
            >
              👎
            </button>
            <input
              type="text"
              placeholder="Optional reason (max 200 chars)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              disabled={sendingFeedback}
              className="text-xs border border-gray-300 rounded px-2 py-1 w-full sm:w-40"
            />
            <button
              onClick={() => sendFeedback(reason.length > 0)}
              disabled={sendingFeedback}
              className="text-xs bg-royal-blue text-white rounded px-2 py-1 hover:bg-royal-blue/90 disabled:opacity-50 transition-colors"
            >
              Send feedback
            </button>
          </div>
        )}
        {isAnswer && rated && (
          <span className="mt-2 text-xs text-emerald-700">Thanks for your feedback.</span>
        )}
        {!isUser && showHuman && (
          <button
            onClick={() => onTalkToHuman!(message.id)}
            className="mt-2 text-xs font-semibold text-royal-blue underline underline-offset-2 hover:text-deep-navy transition-colors"
          >
            Talk to human support
          </button>
        )}
        {!isUser && escalated && escalationRef && (
          <p className="mt-2 text-xs text-emerald-700">
            We have created a support ticket. Your reference is {escalationRef}. Our team will follow up.
          </p>
        )}
        <p className={`text-xs mt-1 ${isUser ? 'text-white/70' : 'text-slate-400'}`}>
          {formatTime(message.timestamp)}
        </p>
      </div>
    </div>
  )
}
