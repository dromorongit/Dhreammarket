'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'

interface CollectionDetailProps {
  params: { slug: string }
}

export default function CollectionDetailPage({ params }: CollectionDetailProps) {
  const [collection, setCollection] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCollection()
  }, [params.slug])

  const fetchCollection = async () => {
    try {
      const response = await fetch(`/api/collections`)
      if (response.ok) {
        const data = await response.json()
        const found = data.collections?.find((c: any) => c.slug === params.slug)
        setCollection(found || null)
      }
    } catch (error) {
      console.error('Error fetching collection:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-6" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <Card>
            <Card.Content className="p-12 text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Collection not found</h3>
              <p className="text-gray-600 mb-4">The collection you&apos;re looking for doesn&apos;t exist.</p>
              <Link href="/dashboard/customer/collections" className="text-royal-blue hover:underline">
                Back to Collections
              </Link>
            </Card.Content>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-deep-navy">{collection.name}</h1>
            {collection.description && (
              <p className="text-gray-600 mt-1">{collection.description}</p>
            )}
          </div>
          <Badge variant={collection.isPublic ? 'secondary' : 'outline'}>
            {collection.isPublic ? 'Public' : 'Private'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {collection.items?.map((item: any) => (
            <Card key={item.id} variant="elevated" className="overflow-hidden">
              <Link href={item.product ? `/marketplace/product/${item.product.slug}` : `/services/${item.service?.slug}`}>
                <div className="aspect-[4/3] bg-slate-100 flex items-center justify-center">
                  <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </Link>
              <div className="p-3">
                <h3 className="text-sm font-semibold text-deep-navy line-clamp-2">
                  {item.product?.name || item.service?.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {item.product?.store?.name || item.service?.store?.name}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {(!collection.items || collection.items.length === 0) && (
          <Card>
            <Card.Content className="p-12 text-center">
              <p className="text-gray-500">This collection is empty</p>
            </Card.Content>
          </Card>
        )}
      </div>
    </div>
  )
}