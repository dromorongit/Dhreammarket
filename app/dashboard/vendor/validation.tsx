import { redirect } from 'next/navigation'
import { validateSession, getUserStatus } from '@/lib/auth-db'
import { verifyToken } from '@/lib/auth-middleware'

export default async function VendorDashboardValidation({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = (await import('next/headers')).cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor'))
  }

  const outcome = await verifyToken(token)

  if (!outcome.authenticated) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor'))
  }

  if (outcome.role === 'VENDOR') {
    const result = await validateSession(outcome.sessionId)

    if (!result.valid) {
      redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor'))
    }

    const userStatus = await getUserStatus(outcome.userId, outcome.role)

    if (!userStatus.isEmailVerified) {
      redirect('/verify-email')
    }

    const headersList = await (await import('next/headers')).headers()
    const invokePath = headersList.get('x-invoke-path')

    if (!userStatus.isOnboarded && invokePath !== '/dashboard/vendor/store') {
      redirect('/dashboard/vendor/store')
    }
  }

  return <>{children}</>
}
