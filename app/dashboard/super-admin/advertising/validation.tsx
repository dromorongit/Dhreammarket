import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth-middleware'
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

  const outcome = await verifyToken(token)

  if (!outcome.authenticated) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/super-admin/advertising'))
  }

  if (outcome.role !== 'SUPER_ADMIN') {
    redirect('/')
  }

  const result = await validateSession(outcome.sessionId)

  if (!result.valid) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/super-admin/advertising'))
  }

  return <>{children}</>
}
