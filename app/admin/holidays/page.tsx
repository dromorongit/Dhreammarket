import { getServerSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getPolicy } from '@/lib/delivery'
import HolidayEditor from './HolidayEditor'

export default async function HolidaysAdminPage() {
  const session = await getServerSession()
  if (!session) {
    redirect('/login?redirect=' + encodeURIComponent('/admin/holidays'))
  }
  if (session.role !== 'SUPER_ADMIN') {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <h1 className="text-xl font-semibold mb-2">Business Day Payout Holidays</h1>
        <p className="text-red-600 rounded border border-red-100 bg-red-50 px-3 py-2">
          SUPER_ADMIN access required.
        </p>
      </div>
    )
  }

  const policy = await getPolicy()
  const holidayList: string[] = policy.holidayList ?? []

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-1">Business Day Payout Holidays</h1>
      <p className="text-sm text-gray-600 mb-6">
        Manage the holiday list used by business-day payouts. SUPER_ADMIN only.
      </p>
      <HolidayEditor initial={holidayList} />
    </div>
  )
}
