'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'

interface FormData {
  name: string
  email: string
  subject: string
  message: string
  type: 'SUGGESTION' | 'BUG_REPORT' | 'GENERAL' | 'QUESTION'
}

interface FormErrors {
  name?: string
  email?: string
  subject?: string
  message?: string
  type?: string
}

interface ContactFormProps {
  supportEmail: string
}

export default function ContactForm({ supportEmail }: ContactFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
    type: 'GENERAL'
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1]
        if (token) {
          const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          if (response.ok) {
            const data = await response.json()
            setIsAuthenticated(true)
            setUserEmail(data.user.email)
            setFormData(prev => ({ ...prev, email: data.user.email, name: data.user.email.split('@')[0] }))
          }
        }
      } catch (e) {
        // Not logged in, that's fine
      }
    }
    checkAuth()
  }, [])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required'
    } else if (formData.subject.trim().length < 5) {
      newErrors.subject = 'Subject must be at least 5 characters'
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required'
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitStatus('idle')

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          subject: formData.subject,
          message: formData.message,
          email: formData.email,
          name: formData.name
        }),
        credentials: 'include'
      })

      if (response.ok) {
        setSubmitStatus('success')
        setFormData({ name: '', email: '', subject: '', message: '', type: 'GENERAL' })
      } else {
        const error = await response.json()
        throw new Error(error.error || 'Submission failed')
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'SUGGESTION': 'Suggestion',
      'BUG_REPORT': 'Bug Report',
      'GENERAL': 'General Inquiry',
      'QUESTION': 'Question'
    }
    return labels[type] || type
  }

  return (
    <Card variant="elevated">
      <CardContent className="p-6 sm:p-8">
        <div className="text-center mb-8">
          <Badge variant="default" className="mb-4">
            Send us a Message
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-bold text-deep-navy">
            We&apos;d love to hear from you
          </h2>
        </div>

        {submitStatus === 'success' && (
          <div className="mb-6 p-6 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-emerald-800 font-medium">Message sent successfully!</p>
                <p className="text-sm text-emerald-700 mt-1">
                  We&apos;ve received your message and will respond within 24-48 hours.
                </p>
              </div>
            </div>
          </div>
        )}

        {submitStatus === 'error' && (
          <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-red-800 font-medium">Something went wrong</p>
                <p className="text-sm text-red-700 mt-1">
                  Please try again or email us directly at {supportEmail}
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {isAuthenticated && (
            <div className="bg-royal-blue/5 border border-royal-blue/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-royal-blue flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-700">
                  You&apos;re logged in as <span className="font-medium text-royal-blue">{userEmail}</span>. 
                  Your message will be automatically linked to your account.
                </p>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-2">
              Feedback Type <span className="text-red-500">*</span>
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`w-full px-4 py-3 rounded-xl border text-slate-700 transition-all ${errors.type ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 outline-none disabled:bg-slate-50`}
            >
              <option value="GENERAL">General Inquiry</option>
              <option value="SUGGESTION">Suggestion</option>
              <option value="BUG_REPORT">Bug Report</option>
              <option value="QUESTION">Question</option>
            </select>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
              Your Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={isSubmitting || isAuthenticated}
              className={`w-full px-4 py-3 rounded-xl border transition-all ${errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 outline-none disabled:bg-slate-50`}
              placeholder="Enter your full name"
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={isSubmitting || isAuthenticated}
              className={`w-full px-4 py-3 rounded-xl border transition-all ${errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 outline-none disabled:bg-slate-50`}
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-2">
              Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              disabled={isSubmitting}
              className={`w-full px-4 py-3 rounded-xl border transition-all ${errors.subject ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 outline-none disabled:bg-slate-50`}
              placeholder="Brief summary of your message"
            />
            {errors.subject && <p className="mt-1 text-sm text-red-600">{errors.subject}</p>}
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-2">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              disabled={isSubmitting}
              rows={6}
              className={`w-full px-4 py-3 rounded-xl border transition-all ${errors.message ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 outline-none disabled:bg-slate-50 resize-none`}
              placeholder="Please describe your issue, suggestion, or question in detail..."
            />
            {errors.message && <p className="mt-1 text-sm text-red-600">{errors.message}</p>}
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full md:w-auto" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sending...
              </span>
            ) : 'Send Message'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
