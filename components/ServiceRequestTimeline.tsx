'use client'

import { cn } from '@/lib/utils'

interface TimelineStep {
  id: string
  status: string
  notes: string | null
  createdAt: string
  changer: {
    id: string
    profile: { firstName: string | null; lastName: string | null }
  }
}

interface ServiceRequestTimelineProps {
  history: TimelineStep[]
  className?: string
}

const STATUS_ORDER = [
  'PENDING',
  'UNDER_REVIEW',
  'QUOTED',
  'ACCEPTED',
  'DECLINED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Request Submitted',
  UNDER_REVIEW: 'Under Review',
  QUOTED: 'Quotation Sent',
  ACCEPTED: 'Quotation Accepted',
  DECLINED: 'Quotation Declined',
  IN_PROGRESS: 'Project Started',
  COMPLETED: 'Project Completed',
  CANCELLED: 'Request Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-slate-200 text-slate-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  QUOTED: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  DECLINED: 'bg-rose-100 text-rose-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
}

export function ServiceRequestTimeline({ history, className }: ServiceRequestTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-slate-500">No status updates yet.</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-0', className)}>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
        <div className="space-y-6">
          {history.map((entry, index) => {
            const isLast = index === history.length - 1
            return (
              <div key={entry.id} className="relative flex gap-4">
                <div className="relative z-10 flex-shrink-0">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center border-2 border-white',
                      STATUS_COLORS[entry.status] || 'bg-slate-200 text-slate-700'
                    )}
                  >
                    {isLast ? (
                      <div className="w-2 h-2 bg-current rounded-full" />
                    ) : (
                      <div className="w-1.5 h-1.5 bg-current rounded-full" />
                    )}
                  </div>
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-slate-900 text-sm">
                      {STATUS_LABELS[entry.status] || entry.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  {entry.notes && (
                    <p className="text-sm text-slate-600 mb-1">{entry.notes}</p>
                  )}
                  <p className="text-xs text-slate-400">
                    by {entry.changer.profile?.firstName} {entry.changer.profile?.lastName}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}