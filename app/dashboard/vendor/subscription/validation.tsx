import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verifyToken } from '@/lib/auth-middleware'

export default async function VendorSubscriptionValidation({ children }: { children: React.ReactNode }) {
  const token = (await import('next/headers')).cookies().get('token')?.value

  if (!token) {
    redirect('/login')
  }

  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'VENDOR') {
    redirect('/login')
  }

  return <>{children}</>
}