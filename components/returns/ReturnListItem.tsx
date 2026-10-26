import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { formatGhs } from '@/lib/returns/ui/amount'
import { reasonLabel } from '@/lib/returns/ui/reasons'
import { ReturnStatusBadge } from '@/components/returns/ReturnStatusBadge'

interface ReturnListItemProps {
  request: {
    id: string
    status: string
    reason: string
    quantity: number
    createdAt: Date | string
    orderItemId: string
  }
  item: {
    name: string
    price: number
    quantity: number
  } | null
}

export function ReturnListItem({ request, item }: ReturnListItemProps) {
  return (
    <Link
      href={`/dashboard/customer/returns/${request.id}`}
      className="block border border-slate-200 rounded-2xl p-6 hover:border-royal-blue hover:shadow-md transition-all bg-white"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-semibold text-deep-navy">{item?.name ?? 'Item'}</span>
            <ReturnStatusBadge status={request.status} size="sm" />
          </div>
          <p className="text-sm text-slate-500">
            {item ? `${item.quantity} × ${formatGhs(String(item.price))}` : String(request.quantity)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-900">
            {new Date(request.createdAt).toLocaleDateString('en-GH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>
    </Link>
  )
}
