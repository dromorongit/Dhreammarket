'use client'

import { useQuery } from '@tanstack/react-query'
import { type ManagedHomepageData, EMPTY_MANAGED_DATA, sectionsBySlug } from '@/lib/homepage-product-utils'

export function useManagedHomepageData() {
  const { data, isLoading } = useQuery<{ sections: unknown[]; brands: unknown[] }>({
    queryKey: ['homepage-public'],
    queryFn: async () => {
      const response = await fetch('/api/homepage/public', { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to fetch managed homepage data')
      return response.json()
    },
  })

  const managedData = (data ?? EMPTY_MANAGED_DATA) as ManagedHomepageData

  return {
    data: managedData,
    loading: isLoading,
    sectionsBySlug: sectionsBySlug(managedData.sections),
  }
}
