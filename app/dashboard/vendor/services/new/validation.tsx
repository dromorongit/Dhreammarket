import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth-middleware'

export default async function VendorNewServiceValidation({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = (await import('next/headers')).cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/services/new'))
  }

  const outcome = await verifyToken(token)

  if (!outcome.authenticated) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/services/new'))
  }

  if (outcome.role === 'VENDOR') {
    const { validateSession, getUserStatus } = await import('@/lib/auth-db')
    const result = await validateSession(outcome.sessionId)

    if (!result.valid) {
      redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/services/new'))
    }

    const userStatus = await getUserStatus(outcome.userId, outcome.role)

    if (!userStatus.isEmailVerified) {
      redirect('/verify-email')
    }

    if (!userStatus.isOnboarded) {
      redirect('/dashboard/vendor/store')
    }
  }

  return <>{children}</>
}
