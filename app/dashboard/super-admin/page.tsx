import SuperAdminDashboardClient from './page.client'
import { Suspense } from 'react'

export default function SuperAdminDashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="animate-pulse space-y-4 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8"><div className="h-10 bg-slate-200 rounded w-64 mb-8"></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><div className="bg-white rounded-xl h-40"></div><div className="bg-white rounded-xl h-40"></div><div className="bg-white rounded-xl h-40"></div><div className="bg-white rounded-xl h-40"></div></div></div></div>}>
      <SuperAdminDashboardClient />
    </Suspense>
  )
}