import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { getCustomerSession } from '@/lib/returns/ui/server'
import { getPrisma } from '@/lib/prisma'
import { ReturnStatusBadge } from '@/components/returns/ReturnStatusBadge'
import { ReturnTimeline } from '@/components/returns/ReturnTimeline'
import { getStatusCopy } from '@/lib/returns/ui/status-copy'
import { formatGhs } from '@/lib/returns/ui/amount'
import { reasonLabel } from '@/lib/returns/ui/reasons'
import Image from 'next/image'
import { Card } from '@/components/Card'

export const dynamic = 'force-dynamic'

interface ReturnRequestDetail {
  id: string
  status: string
  reason: string
  quantity: number
  createdAt: Date
  updatedAt: Date
  orderItemId: string
  orderItem: {
    id: string
    price: number
    quantity: number
    product: { name: string; images: Array<{ url: string }> }
    order: { id: string }
  }
  events: Array<{
    id: string
    eventType: string
    createdBy: string | null
    createdAt: Date
  }>
  refunds: Array<{ amount: number; status: string }>
}

type TimelineActor = 'You' | 'Seller' | 'Dhream' | 'System'

function actorFor(event: ReturnRequestDetail['events'][number], customerId: string): TimelineActor {
  if (event.createdBy === customerId) return 'You'
  if (event.eventType.startsWith('VENDOR')) return 'Seller'
  if (event.eventType.startsWith('ADMIN') || event.eventType === 'ESCALATED') return 'Dhream'
  return 'System'
}

function labelFor(eventType: string): string {
  switch (eventType) {
    case 'RETURN_OPENED':
      return 'You opened a return request'
    case 'VENDOR_ACCEPTED':
      return 'Seller accepted your return'
    case 'VENDOR_REJECTED':
      return 'Seller declined your return'
    case 'ESCALATED':
      return 'Escalated to Dhream for review'
    case 'ADMIN_APPROVED':
      return 'Dhream approved your return'
    case 'ADMIN_DENIED':
      return 'Dhream declined your return'
    case 'REFUND_REQUESTED':
      return 'Refund requested'
    case 'RETURN_CLOSED':
      return 'Return completed'
    default:
      return eventType
  }
}

export default async function ReturnDetailPage({
  params,
}: {
  params: { returnId: string }
}) {
  if (!isReturnsFlowEnabled()) {
    notFound()
  }

  const session = await getCustomerSession()
  if (!session) {
    redirect('/login?redirect=' + encodeURIComponent(`/dashboard/customer/returns/${params.returnId}`))
  }

  const request = await getPrisma().returnRequest.findFirst({
    where: { id: params.returnId, customerId: session.userId },
    select: {
      id: true,
      status: true,
      reason: true,
      quantity: true,
      createdAt: true,
      updatedAt: true,
      orderItemId: true,
      orderItem: {
        select: {
          id: true,
          price: true,
          quantity: true,
          product: { select: { name: true, images: { select: { url: true } } } },
          order: { select: { id: true } },
        },
      },
      events: {
        select: { id: true, eventType: true, createdBy: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      refunds: { select: { amount: true, status: true } },
    },
  })

  if (!request) {
    notFound()
  }

  const copy = getStatusCopy(request.status)
  const processedRefund = request.refunds.find((r) => r.status === 'PROCESSED')

  const events = request.events.map((event) => ({
    when: event.createdAt.toISOString(),
    actor: actorFor(event, session.userId),
    what: labelFor(event.eventType),
  }))

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <LinkBack />
        <h1 className="text-2xl font-bold text-deep-navy mb-2">Return Request</h1>
        <p className="text-sm text-slate-500 mb-6">
          Request {request.id.slice(-6).toUpperCase()} ·{' '}
          {new Date(request.createdAt).toLocaleDateString('en-GH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>

        <Card className="mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-500">Status</p>
                <p className="text-base font-semibold text-slate-900">{copy.label}</p>
              </div>
              <ReturnStatusBadge status={request.status} size="lg" />
            </div>
            <p className="text-sm text-slate-600 mb-4">{copy.description}</p>
            <p className="text-sm text-slate-600">{copy.nextStep}</p>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-slate-500 mb-2">Item</p>
              <div className="flex items-center gap-4">
                {request.orderItem.product.images[0]?.url && (
                  <Image
                    src={request.orderItem.product.images[0].url}
                    alt={request.orderItem.product.name}
                    width={48}
                    height={48}
                    className="w-16 h-16 rounded-xl object-cover"
                  />
                )}
                <div>
                  <p className="font-medium text-slate-900">{request.orderItem.product.name}</p>
                  <p className="text-sm text-slate-500">
                    Quantity {request.quantity} ·
                    {formatGhs(String(request.orderItem.price))} each
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-slate-500 mb-2">Reason</p>
              <p className="text-sm text-slate-900">{reasonLabel(request.reason)}</p>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-sm text-slate-500 mb-2">Requested amount</p>
              <p className="text-sm text-slate-900">
                Up to {formatGhs(String(request.orderItem.price))} per item
              </p>
            </div>

            {processedRefund && request.status === 'CLOSED' && (
              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-slate-500 mb-2">Refund sent</p>
                <p className="text-sm font-semibold text-emerald-700">
                  {formatGhs(String(processedRefund.amount))}
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className="mb-6">
          <div className="p-6">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-4">Updates</h3>
            <ReturnTimeline events={events} />
          </div>
        </Card>
      </div>
    </div>
  )
}

function LinkBack() {
  return (
    <a
      href="/dashboard/customer/returns"
      className="text-royal-blue hover:text-royal-blue/80 text-sm font-medium inline-flex items-center mb-6"
    >
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to My Returns
    </a>
  )
}
