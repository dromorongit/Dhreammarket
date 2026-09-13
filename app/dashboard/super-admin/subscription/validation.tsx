import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth-middleware'

export default async function SuperAdminSubscriptionValidation({ children }: { children: React.ReactNode }) {
  const token = (await import('next/headers')).cookies().get('token')?.value

  if (!token) {
    redirect('/login')
  }

  const outcome = await verifyToken(token)
  if (!outcome.authenticated || outcome.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  return <>{children}</>
}