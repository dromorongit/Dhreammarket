import { redirect } from 'next/navigation'
import { validateSession, getUserStatus } from '@/lib/auth-db'

export default async function CustomerServiceRequestsValidation({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = (await import('next/headers')).cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/customer/service-requests'))
  }

  const { verifyTokenEdge } = await import('@/lib/auth-edge')
  const payload = await verifyTokenEdge(token)

  if (!payload) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/customer/service-requests'))
  }

  if (payload.role === 'CUSTOMER') {
    const { validateSession, getUserStatus } = await import('@/lib/auth-db')
    const result = await validateSession(payload.sessionId)

    if (!result.valid) {
      redirect('/login?redirect=' + encodeURIComponent('/dashboard/customer/service-requests'))
    }

    const userStatus = await getUserStatus(payload.userId, payload.role)

    if (!userStatus.isEmailVerified) {
      redirect('/verify-email')
    }
  }

  return <>{children}</>
}