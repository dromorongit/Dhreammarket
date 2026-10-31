'use client'

import { useState } from 'react'
import { validateWaitlist, hasErrors, type WaitlistErrors } from '@/lib/waitlist-validation'

type Interest = 'Shopping' | 'Selling' | 'Both'
type Device = 'Android' | 'iPhone (iOS)' | 'Both' | 'Not sure'

interface FormState {
  full_name: string
  email: string
  phone: string
  interest: Interest
  device: Device | ''
  consent: boolean
  website: string
}

export default function WaitlistForm() {
  const [form, setForm] = useState<FormState>({
    full_name: '',
    email: '',
    phone: '',
    interest: 'Both',
    device: '',
    consent: false,
    website: '',
  })
  const [errors, setErrors] = useState<WaitlistErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<
    | { type: 'success'; position?: number; duplicate?: boolean; message: string }
    | { type: 'error'; message: string }
    | null
  >(null)
  const [copied, setCopied] = useState(false)

  const handleChange = (field: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const vErrors = validateWaitlist({
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      interest: form.interest,
      device: form.device || undefined,
      consent: form.consent,
    })
    if (hasErrors(vErrors)) {
      setErrors(vErrors)
      return
    }

    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          interest: form.interest,
          device: form.device || undefined,
          consent: form.consent,
          website: form.website,
          source: new URLSearchParams(window.location.search).get('utm_source') || undefined,
          utm_medium: new URLSearchParams(window.location.search).get('utm_medium') || undefined,
          utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ type: 'error', message: data?.error || 'Something went wrong. Please try again.' })
        return
      }
      if (data.duplicate) {
        setResult({ type: 'success', duplicate: true, message: data.message || "You're already on the waitlist. We'll be in touch!" })
      } else {
        setResult({ type: 'success', position: data.position, message: data.message || "You're on the list! 🎉" })
      }
    } catch {
      setResult({ type: 'error', message: 'Network error. Please try again.' })
    } finally {
      setSubmitting(false)
    }
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = "I just joined the Dhream Market app waitlist! Join me:"

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  if (result?.type === 'success') {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">🎉</div>
        <h3 className="font-poppins font-bold text-2xl text-dhream-navy mb-2">
          {result.duplicate ? "You're already on the list!" : "You're on the list! 🎉"}
        </h3>
        <p className="text-dhream-muted mb-4">
          {result.duplicate
            ? "You're already on the waitlist. We'll be in touch!"
            : "We'll let you know the moment the Dhream Market app is ready."}
        </p>
        {!result.duplicate && result.position && (
          <p className="text-sm text-dhream-muted mb-4">
            Your waitlist position: <span className="font-bold text-dhream-orange">#{result.position}</span>
          </p>
        )}
        <div className="mt-6">
          <p className="text-sm font-semibold text-dhream-navy mb-3">Share with friends</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white px-4 py-2 text-sm font-medium"
            >
              WhatsApp
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-black text-white px-4 py-2 text-sm font-medium"
            >
              X
            </a>
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-full bg-dhream-navy text-white px-4 py-2 text-sm font-medium"
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {/* Honeypot */}
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => handleChange('website', e.target.value)}
          />
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-dhream-text mb-1" htmlFor="full_name">
          Full name
        </label>
        <input
          id="full_name"
          type="text"
          required
          maxLength={80}
          value={form.full_name}
          onChange={(e) => handleChange('full_name', e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dhream-navy"
          aria-invalid={!!errors.full_name}
          aria-describedby={errors.full_name ? 'full_name-error' : undefined}
        />
        {errors.full_name && (
          <p id="full_name-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.full_name}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-dhream-text mb-1" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dhream-navy"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <p id="email-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-dhream-text mb-1" htmlFor="phone">
          Phone / WhatsApp (optional)
        </label>
        <input
          id="phone"
          type="tel"
          placeholder="+233 24 000 0000"
          value={form.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dhream-navy"
          aria-invalid={!!errors.phone}
          aria-describedby={errors.phone ? 'phone-error' : undefined}
        />
        {errors.phone && (
          <p id="phone-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.phone}
          </p>
        )}
      </div>

      <div>
        <span className="block text-sm font-medium text-dhream-text mb-1">I&apos;m interested in</span>
        <div className="flex flex-wrap gap-3">
          {(['Shopping', 'Selling', 'Both'] as Interest[]).map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-dhream-text cursor-pointer">
              <input
                type="radio"
                name="interest"
                value={opt}
                checked={form.interest === opt}
                onChange={() => handleChange('interest', opt)}
                className="accent-dhream-navy"
              />
              {opt}
            </label>
          ))}
        </div>
        {errors.interest && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {errors.interest}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-dhream-text mb-1" htmlFor="device">
          My phone is
        </label>
        <select
          id="device"
          value={form.device}
          onChange={(e) => handleChange('device', e.target.value)}
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-dhream-navy"
        >
          <option value="">Select (optional)</option>
          <option value="Android">Android</option>
          <option value="iPhone (iOS)">iPhone (iOS)</option>
          <option value="Both">Both</option>
          <option value="Not sure">Not sure</option>
        </select>
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm text-dhream-text cursor-pointer">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => handleChange('consent', e.target.checked)}
            className="mt-1 accent-dhream-navy"
            required
          />
          <span>I agree to receive updates about the Dhream Market app launch</span>
        </label>
        {errors.consent && (
          <p className="mt-1 text-xs text-red-600" role="alert">
            {errors.consent}
          </p>
        )}
      </div>

      {result?.type === 'error' && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700" role="alert" aria-live="polite">
          {result.message}
          <button
            type="button"
            onClick={() => setResult(null)}
            className="ml-2 underline"
          >
            Retry
          </button>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-dhream-navy text-white px-6 py-3.5 text-sm sm:text-base font-semibold shadow-lg shadow-dhream-navy/30 border-2 border-dhream-orange/60 hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:cursor-wait flex items-center justify-center gap-2"
      >
        {submitting && (
          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {submitting ? 'Joining...' : 'Join the Waitlist'}
      </button>
    </form>
  )
}
