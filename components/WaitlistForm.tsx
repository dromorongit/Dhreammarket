'use client'

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Card } from '@/components/Card'

type Platform = 'ANDROID' | 'IOS' | 'BOTH'
type Role = 'CUSTOMER' | 'VENDOR'

const ALLOWED_PLATFORMS: Platform[] = ['ANDROID', 'IOS', 'BOTH']
const ALLOWED_ROLES: Role[] = ['CUSTOMER', 'VENDOR']

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function sanitizeSource(source: string | undefined): string | undefined {
  if (!source) return undefined
  const cleaned = source.trim().slice(0, 64)
  if (!cleaned) return undefined
  if (!/^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    return undefined
  }
  return cleaned
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error'

export default function WaitlistForm() {
  const [status, setStatus] = useState<SubmitStatus>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const successRef = useRef<HTMLHeadingElement>(null)
  const websiteRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    email: '',
    name: '',
    phone: '',
    platform: 'BOTH' as Platform,
    role: 'CUSTOMER' as Role,
    source: 'app-page',
    referredByCode: '',
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const rawSrc = params.get('src')
    const rawRef = params.get('ref')

    if (rawSrc !== null) {
      const sanitized = sanitizeSource(rawSrc)
      if (sanitized) {
        setForm((prev) => ({ ...prev, source: sanitized }))
      }
    }

    if (rawRef !== null) {
      setForm((prev) => ({ ...prev, referredByCode: rawRef.trim().slice(0, 32) }))
    }
  }, [])

  const update = useCallback((patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }))
  }, [])

  const validate = useCallback((): boolean => {
    const next: Record<string, string> = {}
    const email = form.email.trim()

    if (!email || email.length > 254 || !isValidEmail(email)) {
      next.email = 'Please enter a valid email.'
    }

    if (form.phone && !/^[+]?[\d\s()-]+$/.test(form.phone)) {
      next.phone = 'Please enter a valid phone number.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }, [form])

  const handleSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (status === 'submitting') return

      if (!validate()) return

      setStatus('submitting')
      setErrors({})

      try {
        const website = websiteRef.current?.value ?? ''
        const body: Record<string, string> = {
          email: form.email.trim(),
          platform: form.platform,
          role: form.role,
          source: form.source,
          website,
        }

        if (form.name.trim()) body.name = form.name.trim()
        if (form.phone.trim()) body.phone = form.phone.trim()
        if (form.referredByCode.trim()) body.referredByCode = form.referredByCode.trim()

        const response = await fetch('/api/waitlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

        const data = (await response.json().catch(() => null)) as { error?: string } | null

        if (response.status === 200) {
          setStatus('success')
          setTimeout(() => successRef.current?.focus(), 0)
        } else if (response.status === 400) {
          setStatus('idle')
          setErrors({ server: typeof data?.error === 'string' ? data.error : 'Please check your details and try again.' })
        } else if (response.status === 429) {
          setStatus('idle')
          setErrors({ server: 'Too many attempts. Please try again in a little while.' })
        } else {
          setStatus('idle')
          setErrors({ server: 'Something went wrong. Please try again.' })
        }
      } catch {
        setStatus('idle')
        setErrors({ server: 'Something went wrong. Please try again.' })
      }
    },
    [form, status, validate]
  )

  if (status === 'success') {
    return (
      <Card padding="lg" className="max-w-xl mx-auto text-center">
        <h2 ref={successRef} tabIndex={-1} className="text-2xl sm:text-3xl font-bold text-deep-navy mb-3 outline-none">
          You&apos;re on the list!
        </h2>
        <p className="text-slate-600 mb-6">We&apos;ll let you know when the app launches.</p>
        <Link href="/marketplace" className="text-royal-blue hover:text-royal-blue/80 font-medium">
          Continue shopping on Dhream Market
        </Link>
      </Card>
    )
  }

  return (
    <Card padding="lg" className="max-w-xl mx-auto">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div className="space-y-1">
          <label htmlFor="waitlist-email" className="block text-sm font-medium text-slate-700">
            Email <span className="text-rose-600">*</span>
          </label>
          <Input
            id="waitlist-email"
            aria-label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => update({ email: e.target.value })}
            disabled={status === 'submitting'}
            error={errors.email}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="waitlist-name" className="block text-sm font-medium text-slate-700">
            Name
          </label>
          <Input
            id="waitlist-name"
            aria-label="Name"
            autoComplete="name"
            maxLength={100}
            value={form.name}
            onChange={(e) => update({ name: e.target.value })}
            disabled={status === 'submitting'}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="waitlist-phone" className="block text-sm font-medium text-slate-700">
            Phone <span className="text-slate-400 text-xs">(optional)</span>
          </label>
          <Input
            id="waitlist-phone"
            aria-label="Phone"
            type="tel"
            autoComplete="tel"
            maxLength={20}
            value={form.phone}
            onChange={(e) => update({ phone: e.target.value })}
            disabled={status === 'submitting'}
            error={errors.phone}
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">Platform</legend>
          <div className="flex flex-wrap gap-4">
            {ALLOWED_PLATFORMS.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="platform"
                  value={option}
                  checked={form.platform === option}
                  onChange={() => update({ platform: option })}
                  disabled={status === 'submitting'}
                />
                {option === 'BOTH' ? 'Both' : option === 'ANDROID' ? 'Android' : 'iOS'}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">I am a</legend>
          <div className="flex flex-wrap gap-4">
            {ALLOWED_ROLES.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="role"
                  value={option}
                  checked={form.role === option}
                  onChange={() => update({ role: option })}
                  disabled={status === 'submitting'}
                />
                {option === 'CUSTOMER' ? 'Shopper' : 'Vendor'}
              </label>
            ))}
          </div>
        </fieldset>

        <div
          aria-hidden="true"
          className="absolute -left-[9999px]"
          style={{ position: 'absolute', left: '-9999px' }}
        >
          <label htmlFor="waitlist-website">Website</label>
          <input
            ref={websiteRef}
            id="waitlist-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            defaultValue=""
          />
        </div>

        {errors.server && (
          <div role="status" aria-live="polite" className="text-sm text-rose-600">
            {errors.server}
          </div>
        )}

        <Button type="submit" variant="primary" fullWidth loading={status === 'submitting'} disabled={status === 'submitting'}>
          Join the waitlist
        </Button>

        <p className="text-xs text-slate-500 text-center">
          By joining you agree to be contacted about the app launch. See our{' '}
          <Link href="/privacy" className="text-royal-blue hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </Card>
  )
}
