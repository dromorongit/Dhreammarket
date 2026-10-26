'use client'

type TimelineActor = 'You' | 'Seller' | 'Dhream' | 'System'

interface ReturnTimelineEvent {
  when: string
  actor: TimelineActor
  what: string
}

interface ReturnTimelineProps {
  events: ReturnTimelineEvent[]
  className?: string
}

const ACTOR_COLOR: Record<TimelineActor, string> = {
  You: 'border-royal-blue/30 bg-royal-blue/5 text-royal-blue',
  Seller: 'border-amber-200 bg-amber-50 text-amber-700',
  Dhream: 'border-deep-navy/30 bg-deep-navy/5 text-deep-navy',
  System: 'border-slate-200 bg-slate-100 text-slate-500',
}

const ACTOR_INITIAL: Record<TimelineActor, string> = {
  You: 'Y',
  Seller: 'S',
  Dhream: 'D',
  System: 'X',
}

export function ReturnTimeline({ events, className }: ReturnTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500" role="list">
        <p className="text-sm">No updates yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4" role="list" aria-label="Return request updates">
      {events.map((event, index) => (
        <div key={event.when + index} className="flex gap-3" role="listitem">
          <div className="flex flex-col items-center">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium border
                ${ACTOR_COLOR[event.actor]}
              `}
            >
              {ACTOR_INITIAL[event.actor]}
            </div>
            {index < events.length - 1 && <div className="w-0.5 h-8 bg-slate-200 mt-2" />}
          </div>
          <div className="flex-1 pb-4">
            <p className="text-sm font-medium text-slate-900">{event.what}</p>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <span>{event.actor}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={event.when}>{new Date(event.when).toLocaleDateString('en-GH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}</time>
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
