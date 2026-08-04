import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth-db'

export default async function SuperAdminAdvertisingValidation({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = (await import('next/headers')).cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/super-admin/advertising'))
  }

  const { verifyTokenEdge } = await import('@/lib/auth-edge')
  const payload = await verifyTokenEdge(token)

  if (!payload) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/super-admin/advertising'))
  }

  if (payload.role !== 'SUPER_ADMIN') {
    redirect('/')
  }

  const { validateSession } = await import('@/lib/auth-db')
  const result = await validateSession(payload.sessionId)

  if (!result.valid) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/super-admin/advertising'))
  }

  return <>{children}</>
}
