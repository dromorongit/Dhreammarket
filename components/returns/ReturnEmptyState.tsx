'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/EmptyState'

export function ReturnEmptyState() {
  return (
    <EmptyState
      icon={
        <svg className="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012 2h2a2 2 0 012 2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      }
      title="No returns yet"
      description="You haven't opened any return requests. Returns can be opened on a delivered item within the return window."
      actionLabel="Browse My Orders"
      actionHref="/dashboard/customer/orders"
    />
  )
}
