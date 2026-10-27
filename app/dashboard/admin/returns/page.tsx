import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { getPrisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/returns/ui/admin-session'
import { adminQueue } from '@/lib/returns/ui/admin-copy'
import { parseAmountToPesewas } from '@/lib/returns/ui/amount'
import { AdminReturnQueueRow } from '@/components/returns/admin/AdminReturnQueueRow'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/Button'

export const dynamic = 'force-dynamic'

export default async function AdminReturnsPage() {
  if (!isReturnsFlowEnabled()) {
    notFound()
  }

  const session = await getSuperAdminSession()
  if (!session) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/admin/returns'))
  }

  const now = new Date()

  const requests = await getPrisma().returnRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 300,
    select: {
      id: true,
      status: true,
      reason: true,
      quantity: true,
      escalationDeadline: true,
      createdAt: true,
      orderItem: {
        select: {
          product: { select: { name: true } },
          order: { select: { id: true } },
        },
      },
      refunds: { select: { id: true, status: true, amount: true } },
    },
  })

  const buckets = {
    'needs-escalation': [] as any[],
    'needs-decision': [] as any[],
    'awaiting-refund': [] as any[],
    'ready-to-close': [] as any[],
    done: [] as any[],
  }

  for (const request of requests) {
    const firstRefund = request.refunds[0] ?? null
    const queue = adminQueue(request.status as any, {
      overdue: request.escalationDeadline ? now.getTime() > new Date(request.escalationDeadline).getTime() : false,
      refundStatus: firstRefund?.status ?? null,
    })
    if (queue) {
      buckets[queue].push({ request, queue })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-deep-navy/10 px-3 py-1 text-xs font-semibold text-deep-navy uppercase tracking-wider">
              Admin returns
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">Returns queue</h1>
          <p className="text-slate-600 mt-2">
            Triage and decide return requests across the platform.
          </p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">All requests</h2>
          <Link href="/dashboard/admin">
            <Button variant="outline" size="sm">
              Back to dashboard
            </Button>
          </Link>
        </div>

        {requests.length === 0 ? (
          <EmptyState
            title="No return requests"
            description="Return requests opened by customers appear here."
            actionLabel="View dashboard"
            actionHref="/dashboard/admin"
          />
        ) : (
          <div className="space-y-8">
            {(['needs-escalation', 'needs-decision', 'awaiting-refund', 'ready-to-close', 'done'] as const).map((queue) => {
              const items = buckets[queue]
              return (
                <section key={queue} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900 capitalize">
                      {queue.replace(/-/g, ' ')}
                    </h3>
                    <span className="text-xs text-slate-500">{items.length}</span>
                  </div>
                  {items.length === 0 ? (
                    <p className="text-sm text-slate-500">No items in this queue.</p>
                  ) : (
                    <div className="space-y-3">
                      {items.map(({ request }) => (
                        <AdminReturnQueueRow
                          key={request.id}
                          request={request}
                          queue={queue}
                          now={now}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
