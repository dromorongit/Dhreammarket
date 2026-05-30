'use client'

import { useState, useEffect } from 'react'
import {
  type ManagedHomepageData,
  EMPTY_MANAGED_DATA,
  sectionsBySlug,
} from '@/lib/homepage-product-utils'

export function useManagedHomepageData() {
  const [data, setData] = useState<ManagedHomepageData>(EMPTY_MANAGED_DATA)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/homepage/public', { cache: 'no-store' })
        const json = await response.json()
        if (json && typeof json === 'object') {
          setData({
            sections: Array.isArray(json.sections) ? json.sections : [],
            brands: Array.isArray(json.brands) ? json.brands : [],
          })
        }
      } catch (error) {
        console.error('Error fetching managed homepage data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return {
    data,
    loading,
    sectionsBySlug: sectionsBySlug(data.sections),
  }
}
