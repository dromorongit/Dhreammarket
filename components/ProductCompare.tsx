'use client'

import { useState, useEffect } from 'react'
import { Card } from './Card'
import { Button } from './Button'
import { Badge } from './Badge'
import { StarRating } from './StarRating'

interface ProductCompareProps {
  productId: string
}

export function ProductCompareButton({ productId }: ProductCompareProps) {
  const [compared, setCompared] = useState(false)
  const [compareCount, setCompareCount] = useState(0)

  useEffect(() => {
    fetchCompareList()
  }, [])

  const fetchCompareList = async () => {
    try {
      const response = await fetch('/api/compare')
      if (response.ok) {
        const data = await response.json()
        setCompareCount(data.products?.length || 0)
        setCompared(data.products?.some((p: any) => p.id === productId) || false)
      }
    } catch (error) {
      console.error('Error fetching compare list:', error)
    }
  }

  const toggleCompare = async () => {
    try {
      const method = compared ? 'DELETE' : 'POST'
      const response = await fetch('/api/compare', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })

      if (response.ok) {
        setCompared(!compared)
        setCompareCount((prev) => (compared ? prev - 1 : prev + 1))
      }
    } catch (error) {
      console.error('Error toggling compare:', error)
    }
  }

  return (
    <Button
      variant={compared ? 'primary' : 'outline'}
      size="sm"
      onClick={toggleCompare}
      className="w-full"
    >
      {compared ? '✓ In Comparison' : '+ Compare'}
    </Button>
  )
}

interface CompareSidebarProps {
  products: any[]
  onRemove: (productId: string) => void
}

export function CompareSidebar({ products, onRemove }: CompareSidebarProps) {
  if (products.length === 0) return null

  const attributes = ['price', 'salesPrice', 'dealsPrice', 'stock', 'averageRating', 'reviewCount']

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 sticky top-4">
      <h3 className="font-semibold text-deep-navy mb-3">Compare Products</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left p-2 text-gray-500">Attribute</th>
              {products.map((p) => (
                <th key={p.id} className="text-left p-2 text-gray-900">
                  <div className="flex items-center justify-between">
                    <span className="font-medium line-clamp-1">{p.name}</span>
                    <button onClick={() => onRemove(p.id)} className="text-gray-400 hover:text-red-500 ml-2">
                      ×
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {attributes.map((attr) => (
              <tr key={attr}>
                <td className="p-2 text-gray-500 capitalize">{attr}</td>
                {products.map((p) => (
                  <td key={p.id} className="p-2 text-gray-900">
                    {p[attr] !== undefined && p[attr] !== null ? p[attr] : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {products.length >= 2 && (
        <div className="mt-3 text-xs text-gray-400">
          {products.length}/4 products compared
        </div>
      )}
    </div>
  )
}