'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from './Card'
import { Button } from './Button'
import { Badge } from './Badge'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'

interface Collection {
  id: string
  name: string
  slug: string
  description?: string | null
  isPublic: boolean
  itemCount: number
  createdAt: string
}

export function CollectionsGrid() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCollections()
  }, [])

  const fetchCollections = async () => {
    try {
      const response = await fetch('/api/collections/summary')
      if (response.ok) {
        const data = await response.json()
        setCollections(data.collections)
      }
    } catch (error) {
      console.error('Error fetching collections:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
        ))}
      </div>
    )
  }

  if (collections.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-16 h-16 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v2a2 2 0 01-2 2H7a2 2 0 01-2-2V5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V5a2 2 0 012-2h10a2 2 0 012 2v5a2 2 0 01-2 2M5 12a2 2 0 002 2h10a2 2 0 002-2M12 12v6" />
          </svg>
        }
        title="No collections yet"
        description="Create a collection to organize your favorite products and services"
        actionLabel="Create Collection"
        actionHref="/dashboard/customer/collections/new"
      />
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {collections.map((collection) => (
        <Link key={collection.id} href={`/dashboard/customer/collections/${collection.slug}`}>
          <Card variant="elevated" className="group flex flex-col overflow-hidden hover:shadow-xl transition-all duration-300">
            <div className="aspect-[4/3] bg-gradient-to-br from-royal-blue/10 to-deep-navy/10 flex items-center justify-center">
              <svg className="w-12 h-12 text-royal-blue/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="p-4 flex-1">
              <h3 className="font-semibold text-deep-navy mb-1">{collection.name}</h3>
              {collection.description && (
                <p className="text-sm text-gray-500 line-clamp-2 mb-2">{collection.description}</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{collection.itemCount} items</span>
                <Badge variant="info">{collection.isPublic ? 'Public' : 'Private'}</Badge>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  )
}