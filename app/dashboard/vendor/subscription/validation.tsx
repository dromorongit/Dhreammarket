import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth-middleware'
import { getUserStatus } from '@/lib/auth-db'

export default async function VendorSubscriptionValidation({ children }: { children: React.ReactNode }) {
  const token = (await import('next/headers')).cookies().get('token')?.value

  if (!token) {
    redirect('/login')
  }

  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'VENDOR') {
    redirect('/login')
  }

  const userStatus = await getUserStatus(payload.userId, payload.role)

  if (!userStatus.isEmailVerified) {
    redirect('/verify-email')
  }

  if (!userStatus.isOnboarded) {
    redirect('/dashboard/vendor/store')
  }

  return <>{children}</>
}