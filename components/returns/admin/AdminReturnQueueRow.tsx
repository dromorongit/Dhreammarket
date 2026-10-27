import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { formatGhs } from '@/lib/returns/ui/amount'
import { reasonLabel } from '@/lib/returns/ui/reasons'
import { adminQueue, adminQueueLabel } from '@/lib/returns/ui/admin-copy'
import { ReturnStatusBadge } from '@/components/returns/ReturnStatusBadge'

interface AdminReturnQueueRowProps {
  request: {
    id: string
    status: string
    reason: string
    quantity: number
    escalationDeadline: Date | string | null
    createdAt: Date | string
    orderItem: {
      product: { name: string }
      order?: { id: string } | null
    }
    refunds: Array<{ id: string; status: string; amount: number | string }>
  }
  queue: string | null
  now: Date
}

function ageDays(createdAt: Date | string, now: Date): string {
  const ms = now.getTime() - new Date(createdAt).getTime()
  const days = Math.floor(ms / 86400000)
  if (days <= 0) return 'today'
  return `${days}d`
}

export function AdminReturnQueueRow({ request, queue, now }: AdminReturnQueueRowProps) {
  const shortId = request.id.slice(-8).toUpperCase()
  const orderRef = request.orderItem?.order?.id
    ? `Order #${request.orderItem.order.id.slice(-8).toUpperCase()}`
    : 'No order ref'
  const refund = request.refunds[0]
  const refundLabel = refund ? `${formatGhs(String(refund.amount))} - ${refund.status}` : null

  return (
    <Link
      href={`/dashboard/admin/returns/${request.id}`}
      className="block border border-slate-200 rounded-2xl p-4 sm:p-6 hover:border-royal-blue hover:shadow-sm transition-all bg-white"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-deep-navy text-sm">{shortId}</span>
            <span className="text-xs text-slate-500">{orderRef}</span>
            <ReturnStatusBadge status={request.status} size="sm" />
            {queue && (
              <Badge variant="outline" size="sm">
                {adminQueueLabel(queue as any)}
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {request.orderItem.product.name} \u00b7 {reasonLabel(request.reason)} \u00b7 {request.quantity} item
            {request.quantity !== 1 ? 's' : ''}
          </p>
          {refundLabel && (
            <p className="text-xs text-slate-500">Refund: {refundLabel}</p>
          )}
        </div>
        <div className="text-right sm:text-left">
          <p className="text-xs text-slate-500">Age: {ageDays(request.createdAt, now)}</p>
          {request.escalationDeadline && (
            <p className="text-xs text-slate-500">
              Deadline:{' '}
              {new Date(request.escalationDeadline).toLocaleDateString('en-GH', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
