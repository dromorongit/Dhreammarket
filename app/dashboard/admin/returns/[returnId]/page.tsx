import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { getPrisma } from '@/lib/prisma'
import { getSuperAdminSession } from '@/lib/returns/ui/admin-session'
import { parseAmountToPesewas } from '@/lib/returns/ui/amount'
import { reasonLabel } from '@/lib/returns/ui/reasons'
import { isOverdue } from '@/lib/returns/overdue'
import { AdminReturnDetail } from '@/components/returns/admin/AdminReturnDetail'
import { Button } from '@/components/Button'

export const dynamic = 'force-dynamic'

export default async function AdminReturnDetailPage({
  params,
}: {
  params: { returnId: string }
}) {
  if (!isReturnsFlowEnabled()) {
    notFound()
  }

  const session = await getSuperAdminSession()
  if (!session) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/admin/returns'))
  }

  const request = await getPrisma().returnRequest.findUnique({
    where: { id: params.returnId },
    select: {
      id: true,
      status: true,
      reason: true,
      quantity: true,
      escalationDeadline: true,
      createdAt: true,
      policySnapshot: true,
      orderItem: {
        select: {
          id: true,
          quantity: true,
          price: true,
          product: {
            select: {
              id: true,
              name: true,
              images: { select: { url: true } },
            },
          },
          order: { select: { id: true } },
        },
      },
      refunds: { select: { id: true, status: true, amount: true } },
      events: {
        select: { id: true, eventType: true, createdAt: true, createdBy: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!request) {
    notFound()
  }

  const now = new Date()
  const overdue = isOverdue(
    { status: request.status, escalationDeadline: request.escalationDeadline },
    now
  )

  const unit = parseAmountToPesewas(String(request.orderItem.price))
  const unitPesewas = unit.kind === 'ok' ? unit.pesewas : 0
  const lineTotalPesewas = unitPesewas * request.quantity
  const requestedRaw = (request as any).policySnapshot?.requestedAmount
  const parsedRequested = requestedRaw !== undefined && requestedRaw !== null ? parseAmountToPesewas(String(requestedRaw)) : null
  const amountPesewas = parsedRequested && parsedRequested.kind === 'ok' ? parsedRequested.pesewas : lineTotalPesewas

  const refund = request.refunds[0] ?? null

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/dashboard/admin/returns">
            <Button variant="outline" size="sm">
              Back to queue
            </Button>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">Return request</h1>
          <p className="text-slate-600 mt-2">Arbitrate this return request.</p>
        </div>

        <AdminReturnDetail
          returnId={request.id}
          status={request.status}
          reason={request.reason}
          quantity={request.quantity}
          amountPesewas={amountPesewas}
          deadline={request.escalationDeadline?.toISOString() ?? null}
          itemName={request.orderItem.product.name}
          itemImage={request.orderItem.product.images[0]?.url ?? null}
          orderReference={request.orderItem.order ? `Order #${request.orderItem.order.id.slice(-8).toUpperCase()}` : 'No order ref'}
          refund={refund ? { id: refund.id, status: refund.status, amount: String(refund.amount) } : null}
          events={request.events.map((event) => ({
            id: event.id,
            eventType: event.eventType,
            createdAt: event.createdAt.toISOString(),
            createdBy: event.createdBy,
          }))}
          isOverdue={overdue}
        />
      </div>
    </div>
  )
}
