import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth-middleware'

export async function getVendorSession(): Promise<{ userId: string } | null> {
  const token = cookies().get('token')?.value
  if (!token) return null
  const outcome = await verifyToken(token)
  if (!outcome.authenticated || outcome.role !== 'VENDOR') return null
  return { userId: outcome.userId }
}
