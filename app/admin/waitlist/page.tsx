import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth-middleware'

export default async function AdminWaitlistRedirectPage() {
  const token = cookies().get('token')?.value
  if (!token) redirect('/login?redirect=' + encodeURIComponent('/dashboard/super-admin/waitlist'))

  const outcome = await verifyToken(token)
  if (!outcome.authenticated || outcome.role !== 'SUPER_ADMIN') {
    redirect('/')
  }
  redirect('/dashboard/super-admin/waitlist')
}
