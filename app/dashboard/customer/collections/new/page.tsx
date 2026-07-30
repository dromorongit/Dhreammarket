'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Textarea } from '@/components/Textarea'

export default function NewCollectionPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          isPublic,
          slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = `/dashboard/customer/collections/${data.collection.slug}`
      } else {
        const data = await response.json()
        alert(data.error || 'Failed to create collection')
      }
    } catch (error) {
      console.error('Error creating collection:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-deep-navy mb-8">New Collection</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <Card.Header>
              <h3 className="font-semibold text-deep-navy">Collection Details</h3>
            </Card.Header>
            <Card.Content>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Collection Name
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Favorites"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe this collection..."
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 text-royal-blue focus:ring-royal-blue border-gray-300 rounded"
                  />
                  <label htmlFor="isPublic" className="text-sm text-gray-700">
                    Make this collection public
                  </label>
                </div>
              </div>
            </Card.Content>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Collection'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/dashboard/customer/collections">Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}