import { redirect } from 'next/navigation'
import { validateSession, getUserStatus } from '@/lib/auth-db'
import { verifyToken } from '@/lib/auth-middleware'

export default async function AdminDashboardValidation({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = (await import('next/headers')).cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/admin'))
  }

  const outcome = await verifyToken(token)

  if (!outcome.authenticated) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/admin'))
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(outcome.role)) {
    redirect('/')
  }

  if (outcome.role === 'ADMIN') {
    const result = await validateSession(outcome.sessionId)

    if (!result.valid) {
      redirect('/login?redirect=' + encodeURIComponent('/dashboard/admin'))
    }

    const userStatus = await getUserStatus(outcome.userId, outcome.role)

    if (!userStatus.isEmailVerified) {
      redirect('/verify-email')
    }
  }

  return <>{children}</>
}
