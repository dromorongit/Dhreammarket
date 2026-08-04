import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth-db'
import { isVendorOnboarded } from '@/lib/onboarding'

export default async function VendorAdvertisingValidation({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = (await import('next/headers')).cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/advertising'))
  }

  const { verifyTokenEdge } = await import('@/lib/auth-edge')
  const payload = await verifyTokenEdge(token)

  if (!payload) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/advertising'))
  }

  if (payload.role !== 'VENDOR') {
    redirect('/')
  }

  const result = await validateSession(payload.sessionId)
  if (!result.valid) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/advertising'))
  }

  const onboarded = await isVendorOnboarded(payload.userId)
  if (!onboarded) {
    redirect('/dashboard/vendor/store')
  }

  return <>{children}</>
}
