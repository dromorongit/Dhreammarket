'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getOptimizedCloudinaryUrl } from '@/lib/cloudinary-image'
import { Card, CardContent, CardHeader } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'
import { formatPrice } from '@/lib/currency'
import { getVendorBadgeInfo } from '@/lib/vendor-badge'
import { MdVerified } from 'react-icons/md'

interface Service {
  id: string
  title: string
  description: string | null
  shortDescription: string | null
  startingPrice: number
  pricingType: string
  deliveryType: string
  thumbnail: string | null
  category: { id: string; name: string }
  store: { id: string; name: string; isVerified: boolean }
  estimatedDeliveryTime: string | null
  requirementsFromCustomer: string | null
}

export default function ServiceRequestForm() {
  const router = useRouter()
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [preferredBudget, setPreferredBudget] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const serviceId = params.get('serviceId')
    if (serviceId) {
      setSelectedService(serviceId)
    }
    fetchServices()
  }, [])

  const fetchServices = async () => {
    try {
      const res = await fetch('/api/services?limit=50&sortBy=createdAt&sortOrder=desc')
      if (res.ok) {
        const data = await res.json()
        setServices(data.services || [])
      }
    } catch (err) {
      console.error('Error fetching services:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!selectedService) {
      setError('Please select a service')
      return
    }

    if (!title.trim()) {
      setError('Please enter a project title')
      return
    }

    if (!description.trim()) {
      setError('Please enter a project description')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService,
          title: title.trim(),
          description: description.trim(),
          preferredCompletionDate: preferredDate || null,
          preferredBudget: preferredBudget || null,
        }),
      })

      if (res.ok) {
        router.push('/dashboard/customer/service-requests')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to submit request')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Select Service</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => setSelectedService(service.id)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  selectedService === service.id
                    ? 'border-royal-blue bg-royal-blue/5'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-start gap-3">
                      {service.thumbnail && (
                      <Image
                        src={getOptimizedCloudinaryUrl(service.thumbnail, 400)}
                        alt={service.title}
                        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                        width={64}
                        height={64}
                       unoptimized />
                    )}
                  <div className="min-w-0">
                    <h3 className="font-medium text-slate-900 text-sm truncate">{service.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{service.store.name}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs font-semibold text-royal-blue">
                        {formatPrice(service.startingPrice)}
                      </span>
                      <Badge variant="info" size="sm">
                        {service.pricingType}
                      </Badge>
                    </div>
                  </div>
                </div>
                {selectedService === service.id && (
                  <div className="mt-2 flex items-center gap-1 text-royal-blue text-xs font-medium">
                    <MdVerified className="w-3 h-3" />
                    Selected
                  </div>
                )}
              </button>
            ))}
          </div>
          {services.length === 0 && (
            <p className="text-slate-500 text-sm">No services available at the moment.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-slate-900">Project Details</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Project Title <span className="text-rose-500">*</span>
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Website Redesign for My Business"
              maxLength={200}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Project Description <span className="text-rose-500">*</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your project in detail. Include goals, requirements, and any specific expectations."
              rows={5}
              maxLength={5000}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Preferred Completion Date
            </label>
            <Input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Preferred Budget (optional)
            </label>
            <Input
              type="number"
              value={preferredBudget}
              onChange={(e) => setPreferredBudget(e.target.value)}
              placeholder="e.g., 500"
              min="0"
              step="0.01"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        <Button type="submit" loading={submitting} disabled={submitting}>
          Submit Request
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}