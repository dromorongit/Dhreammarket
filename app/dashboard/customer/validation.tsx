import { redirect } from 'next/navigation'
import { validateSession, getUserStatus } from '@/lib/auth-db'

export default async function CustomerDashboardValidation({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = (await import('next/headers')).cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/customer'))
  }

  const { verifyTokenEdge } = await import('@/lib/auth-edge')
  const payload = await verifyTokenEdge(token)

  if (!payload) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/customer'))
  }

  const result = await validateSession(payload.sessionId)

  if (!result.valid) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/customer'))
  }

  const userStatus = payload.role === 'CUSTOMER'
    ? await getUserStatus(payload.userId, payload.role)
    : { isEmailVerified: true, isOnboarded: true }

  if (!userStatus.isEmailVerified) {
    redirect('/verify-email')
  }

  return <>{children}</>
}
