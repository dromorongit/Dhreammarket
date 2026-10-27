import Link from 'next/link'
import { Badge } from '@/components/Badge'
import { formatGhs, pesewasToGhsString } from '@/lib/returns/ui/amount'
import { reasonLabel } from '@/lib/returns/ui/reasons'
import { getSellerStatusCopy, sellerStatusIsActionable } from '@/lib/returns/ui/seller-copy'
import { statusToneToBadgeVariant } from '@/lib/returns/ui/status-copy'

interface VendorReturnRowProps {
  request: {
    id: string
    status: string
    reason: string
    quantity: number
    escalationDeadline: Date | string | null
    createdAt: Date | string
  }
  item: {
    name: string
    imageUrl: string | null
    quantity: number
    price: number | string
  } | null
  amountPesewas: number
  timeLeft: string | null
}

function deadlineText(deadline: Date | string | null, now: Date): string | null {
  if (!deadline) return null
  const ms = new Date(deadline).getTime() - now.getTime()
  if (ms <= 0) return 'Overdue'
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

export function VendorReturnRow({ request, item, amountPesewas, timeLeft }: VendorReturnRowProps) {
  const copy = getSellerStatusCopy(request.status)
  const actionable = sellerStatusIsActionable(request.status as any)
  const amount = formatGhs(pesewasToGhsString(amountPesewas))

  return (
    <Link
      href={`/dashboard/vendor/returns/${request.id}`}
      className="block border border-slate-200 rounded-2xl p-4 sm:p-6 hover:border-royal-blue hover:shadow-sm transition-all bg-white"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            {item?.imageUrl && (
              <img
                src={item.imageUrl}
                alt=""
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 bg-slate-50 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-deep-navy truncate block">{item?.name ?? 'Item'}</span>
              <Badge variant={statusToneToBadgeVariant(copy.tone)} size="sm" className="mt-1 sm:mt-0">
                {copy.label}
              </Badge>
            </div>
          </div>
          {item && (
            <p className="text-sm text-slate-500">
              {item.quantity} \u00d7 {formatGhs(String(item.price))}
            </p>
          )}
          <p className="text-sm text-slate-500">
            {reasonLabel(request.reason)} \u00b7 {request.quantity} item{request.quantity !== 1 ? 's' : ''}
          </p>
          <p className="text-sm font-medium text-slate-900">
            {amount}
          </p>
        </div>
        <div className="text-right sm:text-left">
          <p className="text-sm font-medium text-slate-900">{timeLeft ?? '-'}</p>
          <p className="text-xs text-slate-500">
            {new Date(request.createdAt).toLocaleDateString('en-GH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>
      {actionable && (
        <div className="mt-4 sm:mt-0">
          <Link
            href={`/dashboard/vendor/returns/${request.id}`}
            className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 text-sm font-semibold text-royal-blue bg-royal-blue/5 border border-royal-blue/20 rounded-xl hover:bg-royal-blue/10"
          >
            Respond
          </Link>
        </div>
      )}
    </Link>
  )
}


