import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth-middleware'
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

  const outcome = await verifyToken(token)

  if (!outcome.authenticated) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/advertising'))
  }

  if (outcome.role !== 'VENDOR') {
    redirect('/')
  }

  const result = await validateSession(outcome.sessionId)
  if (!result.valid) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/advertising'))
  }

  const onboarded = await isVendorOnboarded(outcome.userId)
  if (!onboarded) {
    redirect('/dashboard/vendor/store')
  }

  return <>{children}</>
}
