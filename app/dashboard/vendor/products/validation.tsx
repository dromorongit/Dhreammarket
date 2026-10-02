import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth-middleware'

export default async function VendorProductsValidation({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = (await import('next/headers')).cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/products'))
  }

  const outcome = await verifyToken(token)

  if (!outcome.authenticated) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/products'))
  }

  if (outcome.role === 'VENDOR') {
    const { validateSession, getUserStatus } = await import('@/lib/auth-db')
    const result = await validateSession(outcome.sessionId)

    if (!result.valid) {
      redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/products'))
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
