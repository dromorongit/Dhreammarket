import { redirect } from 'next/navigation'
import { validateSession, getUserStatus } from '@/lib/auth-db'

export default async function VendorNewProductValidation({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = (await import('next/headers')).cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/products/new'))
  }

  const { verifyTokenEdge } = await import('@/lib/auth-edge')
  const payload = await verifyTokenEdge(token)

  if (!payload) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/products/new'))
  }

  if (payload.role === 'VENDOR') {
    const { validateSession, getUserStatus } = await import('@/lib/auth-db')
    const result = await validateSession(payload.sessionId)

    if (!result.valid) {
      redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/products/new'))
    }

    const userStatus = await getUserStatus(payload.userId, payload.role)

    if (!userStatus.isEmailVerified) {
      redirect('/verify-email')
    }

    if (!userStatus.isOnboarded) {
      redirect('/dashboard/vendor/store')
    }
  }

  return <>{children}</>
}
