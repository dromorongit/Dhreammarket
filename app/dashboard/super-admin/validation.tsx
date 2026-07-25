import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth-db'

export default async function SuperAdminDashboardValidation({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = (await import('next/headers')).cookies()
  const token = cookieStore.get('token')?.value

  if (!token) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/super-admin'))
  }

  const { verifyTokenEdge } = await import('@/lib/auth-edge')
  const payload = await verifyTokenEdge(token)

  if (!payload) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/super-admin'))
  }

  if (payload.role !== 'SUPER_ADMIN') {
    redirect('/')
  }

    const { validateSession } = await import('@/lib/auth-db')
  const result = await validateSession(payload.sessionId)

  if (!result.valid) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/super-admin'))
  }

  return <>{children}</>
}
