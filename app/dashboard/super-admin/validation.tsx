import { redirect } from 'next/navigation'
import { validateSession } from '@/lib/auth-db'
import { verifyToken } from '@/lib/auth-middleware'

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

  const outcome = await verifyToken(token)

  if (!outcome.authenticated) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/super-admin'))
  }

  if (outcome.role !== 'SUPER_ADMIN') {
    redirect('/')
  }

  const result = await validateSession(outcome.sessionId)

  if (!result.valid) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/super-admin'))
  }

  return <>{children}</>
}
