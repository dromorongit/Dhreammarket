import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth-middleware'

export default async function SuperAdminSubscriptionValidation({ children }: { children: React.ReactNode }) {
  const token = (await import('next/headers')).cookies().get('token')?.value

  if (!token) {
    redirect('/login')
  }

  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'SUPER_ADMIN') {
    redirect('/login')
  }

  return <>{children}</>
}