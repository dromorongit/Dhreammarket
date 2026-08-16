import { headers } from 'next/headers'
import VendorDashboardValidation from './validation'

export default async function VendorDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = headers()
  const nextUrl = headersList.get('next-url') || ''
  const isStorePage = nextUrl === '/dashboard/vendor/store' || nextUrl.startsWith('/dashboard/vendor/store?')

  return (
    <VendorDashboardValidation skipOnboardingCheck={isStorePage}>
      {children}
    </VendorDashboardValidation>
  )
}
