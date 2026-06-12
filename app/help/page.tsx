'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Input } from '@/components/Input'

interface FAQ {
  id: string
  category: 'Customer' | 'Vendor' | 'Payments' | 'Orders' | 'Verification' | 'Preorders' | 'Backorders'
  question: string
  answer: string
}

const customerGuides = [
  { title: 'Creating an Account', href: '/register', icon: '👤' },
  { title: 'Placing Orders', href: '/help/placing-orders', icon: '🛒' },
  { title: 'Making Payments', href: '/help/making-payments', icon: '💳' },
  { title: 'Tracking Orders', href: '/dashboard/customer/orders', icon: '📍' },
  { title: 'Understanding Preorders', href: '/help/preorders', icon: '⏳' },
  { title: 'Understanding Backorders', href: '/help/backorders', icon: '↩️' },
  { title: 'Refunds', href: '/refund', icon: '💰' },
  { title: 'Returns', href: '/help/returns', icon: '🔄' },
]

const vendorGuides = [
  { title: 'Creating a Store', href: '/dashboard/vendor/store', icon: '🏪' },
  { title: 'Vendor Verification', href: '/dashboard/vendor/verification', icon: '✅' },
  { title: 'KYC Submission', href: '/dashboard/vendor/verification', icon: '📄' },
  { title: 'Managing Products', href: '/dashboard/vendor/products', icon: '📦' },
  { title: 'Managing Inventory', href: '/dashboard/vendor/products', icon: '📊' },
  { title: 'Preorders', href: '/help/preorders', icon: '⏳' },
  { title: 'Backorders', href: '/help/backorders', icon: '↩️' },
  { title: 'Fulfillment Workflow', href: '/dashboard/vendor/fulfillment', icon: '🚚' },
  { title: 'Restock Orders', href: '/dashboard/vendor/restock', icon: '📥' },
  { title: 'Purchase Orders', href: '/dashboard/vendor/purchase-orders', icon: '📋' },
]

const faqData: FAQ[] = [
  {
    id: '1',
    category: 'Customer',
    question: 'How do I create an account?',
    answer: 'Click on the "Sign Up" button in the top right corner of the homepage. Fill in your email, password, and select "Customer" as your role. Verify your email address to complete registration.'
  },
  {
    id: '2',
    category: 'Customer',
    question: 'How do I place an order?',
    answer: 'Browse products, add items to your cart, then proceed to checkout. Select your payment method (Paystack), enter shipping details, and complete the payment. You\'ll receive an order confirmation via email.'
  },
  {
    id: '3',
    category: 'Customer',
    question: 'How can I track my order?',
    answer: 'Go to your Dashboard > Orders. Click on any order to see its current status. You can also track order updates through email notifications.'
  },
  {
    id: '4',
    category: 'Vendor',
    question: 'How do I become a vendor?',
    answer: 'Register an account and select "Vendor" as your role. Complete your profile, set up your store, and submit your store for verification. Our team will review your application within 1-2 business days.'
  },
  {
    id: '5',
    category: 'Vendor',
    question: 'How do I add products?',
    answer: 'Navigate to your Vendor Dashboard > Products. Click "Add Product", fill in product details, upload images via Cloudinary, set pricing and stock, then publish.'
  },
  {
    id: '6',
    category: 'Payments',
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit/debit cards, mobile money, and bank transfers through Paystack, our secure payment processor.'
  },
  {
    id: '7',
    category: 'Payments',
    question: 'How do I request a refund?',
    answer: 'Contact the seller directly through your order page to initiate a refund request. If unresolved, our support team can assist. Refunds are processed within 5-7 business days.'
  },
  {
    id: '8',
    category: 'Verification',
    question: 'Why is my store verification taking long?',
    answer: 'Verification typically takes 1-2 business days. Delays may occur if additional documentation is needed. Check your email for updates or contact support.'
  },
  {
    id: '9',
    category: 'Verification',
    question: 'What documents are required for verification?',
    answer: 'We require a valid government-issued ID (passport, driver\'s license, or national ID) and proof of business registration if applicable. Business licenses may be required for certain product categories.'
  },
  {
    id: '10',
    category: 'Preorders',
    question: 'How do preorders work?',
    answer: 'Preorder items are products that will be available in the future. When you place a preorder, you\'ll be charged immediately and the item will ship once it arrives at the vendor\'s warehouse.'
  },
  {
    id: '11',
    category: 'Backorders',
    question: 'What are backorders?',
    answer: 'Backorder items are temporarily out of stock but will be restocked soon. When you place a backorder, you\'ll be charged immediately and the item will ship once inventory is replenished.'
  },
  {
    id: '12',
    category: 'Orders',
    question: 'How long does delivery take?',
    answer: 'Delivery times vary by seller location and shipping method. Standard delivery typically takes 3-7 business days. You\'ll receive tracking information once your order ships.'
  },
]

const contactCategories = [
  'Orders',
  'Payments',
  'Verification',
  'Vendor Support',
  'Technical Issues',
  'Refunds',
  'Other'
]

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFAQCategory, setSelectedFAQCategory] = useState<string>('All')
  const [expandedFAQId, setExpandedFAQId] = useState<string | null>(null)
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    category: 'Orders',
    message: ''
  })
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({})
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

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
            setContactForm(prev => ({
              ...prev,
              email: data.user.email,
              name: data.user.profile?.firstName || data.user.email.split('@')[0]
            }))
          }
        }
      } catch (e) {
        // Not logged in, that's fine
      }
    }
    checkAuth()
  }, [])

  const filteredFAQs = faqData.filter(faq => {
    const matchesCategory = selectedFAQCategory === 'All' || faq.category === selectedFAQCategory
    const matchesSearch = !searchQuery.trim() ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const handleContactChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setContactForm(prev => ({ ...prev, [name]: value }))
    if (contactErrors[name]) {
      setContactErrors(prev => ({ ...prev, [name]: '' }))
    }
  }

  const validateContactForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!contactForm.name.trim()) errors.name = 'Name is required'
    if (!contactForm.email.trim()) errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email)) errors.email = 'Invalid email address'
    if (!contactForm.subject.trim()) errors.subject = 'Subject is required'
    if (!contactForm.message.trim()) errors.message = 'Message is required'
    setContactErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitStatus('idle')
    if (!validateContactForm()) return

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
        credentials: 'include'
      })
      if (response.ok) {
        setSubmitStatus('success')
        setContactForm({ name: '', email: '', phone: '', subject: '', category: 'Orders', message: '' })
      } else {
        setSubmitStatus('error')
      }
    } catch (error) {
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-deep-navy to-purple-900 relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/assets/images/help.jpg"
            alt=""
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-royal-blue/20 to-transparent"></div>
          <div className="absolute top-20 -right-40 w-96 h-96 bg-premium-gold/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 -left-40 w-96 h-96 bg-royal-blue/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center text-white">
            <Badge variant="premium" className="mb-4 mx-auto">
              Help Center
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4 tracking-tight">
              How can we help you?
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Find answers, guides, and support for Dhream Market customers and vendors.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-10 pb-16 lg:pb-24">
        {/* For Customers */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-deep-navy">For Customers</h2>
            <Badge variant="default">{customerGuides.length} guides</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {customerGuides.map((guide, index) => (
              <Card key={index} variant="elevated" className="hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="text-3xl mb-3">{guide.icon}</div>
                  <h3 className="font-semibold text-slate-800 mb-2">{guide.title}</h3>
                  <a href={guide.href} className="text-royal-blue hover:underline text-sm font-medium">
                    Learn more →
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* For Vendors */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-deep-navy">For Vendors</h2>
            <Badge variant="default">{vendorGuides.length} guides</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {vendorGuides.map((guide, index) => (
              <Card key={index} variant="elevated" className="hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6">
                  <div className="text-3xl mb-3">{guide.icon}</div>
                  <h3 className="font-semibold text-slate-800 mb-2">{guide.title}</h3>
                  <a href={guide.href} className="text-royal-blue hover:underline text-sm font-medium">
                    Learn more →
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Policies */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-deep-navy mb-6">Policies</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-800 mb-2">Privacy Policy</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Learn how we protect and use your personal information.
                </p>
                <a href="/privacy" className="text-royal-blue hover:underline font-medium text-sm">
                  Read policy →
                </a>
              </CardContent>
            </Card>
            <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-800 mb-2">Terms of Service</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Understand the rules and guidelines for using our platform.
                </p>
                <a href="/terms" className="text-royal-blue hover:underline font-medium text-sm">
                  Read policy →
                </a>
              </CardContent>
            </Card>
            <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <h3 className="font-semibold text-slate-800 mb-2">Payment Policy</h3>
                <p className="text-sm text-slate-600 mb-4">
                  Information about payments, refunds, and transaction policies.
                </p>
                <a href="/payment-policy" className="text-royal-blue hover:underline font-medium text-sm">
                  Read policy →
                </a>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-deep-navy mb-6">Frequently Asked Questions</h2>
          
          <Card variant="elevated" className="mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search FAQs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                    icon={
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {['All', 'Customer', 'Vendor', 'Payments', 'Orders', 'Verification', 'Preorders', 'Backorders'].map(category => (
                    <Button
                      key={category}
                      variant={selectedFAQCategory === category ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedFAQCategory(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {filteredFAQs.length === 0 ? (
              <Card variant="elevated">
                <CardContent className="p-12 text-center">
                  <p className="text-slate-600">No FAQs found matching your search.</p>
                </CardContent>
              </Card>
            ) : (
              filteredFAQs.map(faq => (
                <Card
                  key={faq.id}
                  variant="outline"
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${expandedFAQId === faq.id ? 'ring-2 ring-royal-blue' : ''}`}
                  onClick={() => setExpandedFAQId(expandedFAQId === faq.id ? null : faq.id)}
                >
                  <CardContent className="p-0">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-lg font-semibold text-slate-800 pr-4">{faq.question}</h3>
                        <button className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                          <svg
                            className={`w-5 h-5 text-slate-600 transition-transform duration-200 ${expandedFAQId === faq.id ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      {expandedFAQId === faq.id && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </section>

        {/* Contact Support */}
        <section>
          <h2 className="text-2xl font-bold text-deep-navy mb-6">Contact Support</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-royal-blue to-purple-600 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.505a1 1 0 01-.502 1.21l-2.257 1.13a11 11 0 005.516.516l1.13-2.257a1 1 0 011.21-.502l4.505 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <p className="font-medium text-slate-700">Customer Support</p>
                <p className="text-2xl font-bold text-deep-navy">0596522239</p>
              </CardContent>
            </Card>
            <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.505a1 1 0 01-.502 1.21l-2.257 1.13a11 11 0 005.516.516l1.13-2.257a1 1 0 011.21-.502l4.505 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <p className="font-medium text-slate-700">Vendor Support</p>
                <p className="text-2xl font-bold text-deep-navy">0508548181</p>
              </CardContent>
            </Card>
            <Card variant="elevated" className="hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6 text-center">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.505a1 1 0 01-.502 1.21l-2.257 1.13a11 11 0 005.516.516l1.13-2.257a1 1 0 011.21-.502l4.505 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <p className="font-medium text-slate-700">Technical Support</p>
                <p className="text-2xl font-bold text-deep-navy">0279354362</p>
              </CardContent>
            </Card>
          </div>

          <Card variant="elevated">
            <CardContent className="p-6 sm:p-8">
              <div className="text-center mb-8">
                <Badge variant="default" className="mb-4">Send us a Message</Badge>
                <h3 className="text-2xl font-bold text-deep-navy">We&apos;re here to help</h3>
              </div>

              {submitStatus === 'success' && (
                <div className="mb-6 p-6 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-emerald-800 font-medium">Message sent successfully!</p>
                  <p className="text-sm text-emerald-700 mt-1">We&apos;ll respond within 24-48 hours.</p>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="mb-6 p-6 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-800 font-medium">Something went wrong</p>
                  <p className="text-sm text-red-700 mt-1">Please try again or call us directly.</p>
                </div>
              )}

              <form onSubmit={handleContactSubmit} className="space-y-6 max-w-3xl mx-auto">
                {isAuthenticated && (
                  <div className="bg-royal-blue/5 border border-royal-blue/20 rounded-xl p-4">
                    <p className="text-sm text-slate-700">
                      You&apos;re logged in. Your message will be automatically linked to your account.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={contactForm.name}
                      onChange={handleContactChange}
                      disabled={isSubmitting || isAuthenticated}
                      className={`w-full px-4 py-3 rounded-xl border transition-all ${contactErrors.name ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 outline-none disabled:bg-slate-50`}
                      placeholder="Enter your full name"
                    />
                    {contactErrors.name && <p className="mt-1 text-sm text-red-600">{contactErrors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                      Email Address <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={contactForm.email}
                      onChange={handleContactChange}
                      disabled={isSubmitting || isAuthenticated}
                      className={`w-full px-4 py-3 rounded-xl border transition-all ${contactErrors.email ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 outline-none disabled:bg-slate-50`}
                      placeholder="you@example.com"
                    />
                    {contactErrors.email && <p className="mt-1 text-sm text-red-600">{contactErrors.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={contactForm.phone}
                      onChange={handleContactChange}
                      disabled={isSubmitting}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 outline-none"
                      placeholder="024 XXX XXXX"
                    />
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={contactForm.category}
                      onChange={handleContactChange}
                      disabled={isSubmitting}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 outline-none"
                    >
                      {contactCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-2">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={contactForm.subject}
                    onChange={handleContactChange}
                    disabled={isSubmitting}
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${contactErrors.subject ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 outline-none disabled:bg-slate-50`}
                    placeholder="Brief summary of your inquiry"
                  />
                  {contactErrors.subject && <p className="mt-1 text-sm text-red-600">{contactErrors.subject}</p>}
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-slate-700 mb-2">
                    Message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={contactForm.message}
                    onChange={handleContactChange}
                    disabled={isSubmitting}
                    rows={6}
                    className={`w-full px-4 py-3 rounded-xl border transition-all ${contactErrors.message ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'} focus:border-royal-blue focus:ring-2 focus:ring-royal-blue/20 outline-none resize-none`}
                    placeholder="Please describe your issue in detail..."
                  />
                  {contactErrors.message && <p className="mt-1 text-sm text-red-600">{contactErrors.message}</p>}
                </div>

                <div className="text-center">
                  <Button type="submit" variant="primary" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>
              </form>

              <div className="mt-8 p-4 bg-slate-50 rounded-xl">
                <p className="text-sm text-slate-600 text-center">
                  Our support team operates Monday to Friday, 9:00 AM - 6:00 PM (GMT)
                </p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}