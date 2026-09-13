import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth-middleware'
import { getUserStatus } from '@/lib/auth-db'

export default async function VendorSubscriptionValidation({ children }: { children: React.ReactNode }) {
  const token = (await import('next/headers')).cookies().get('token')?.value

  if (!token) {
    redirect('/login')
  }

  const outcome = await verifyToken(token)
  if (!outcome.authenticated || outcome.role !== 'VENDOR') {
    redirect('/login')
  }

  const userStatus = await getUserStatus(outcome.userId, outcome.role)

  if (!userStatus.isEmailVerified) {
    redirect('/verify-email')
  }

  if (!userStatus.isOnboarded) {
    redirect('/dashboard/vendor/store')
  }

  return <>{children}</>
}