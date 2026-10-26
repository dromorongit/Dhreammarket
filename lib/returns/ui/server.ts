import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth-middleware'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'

export function requireReturnsFlowEnabled(): boolean {
  return isReturnsFlowEnabled()
}

export class NotFoundError extends Error {
  constructor() {
    super('Not found')
    this.name = 'NotFoundError'
  }
}

export async function getCustomerSession(): Promise<{ userId: string } | null> {
  const token = cookies().get('token')?.value
  if (!token) return null
  const outcome = await verifyToken(token)
  if (!outcome.authenticated) return null
  if (outcome.role !== 'CUSTOMER') return null
  return { userId: outcome.userId }
}
