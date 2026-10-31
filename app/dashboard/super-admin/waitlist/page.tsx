import SuperAdminWaitlistClient from './page.client'
import { Suspense } from 'react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Waitlist | Super Admin',
  robots: { index: false, follow: false },
}

export default function SuperAdminWaitlistPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading...</div>}>
      <SuperAdminWaitlistClient />
    </Suspense>
  )
}
