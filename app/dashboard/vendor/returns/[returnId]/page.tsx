import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/Card'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { getPrisma } from '@/lib/prisma'
import { getVendorSession } from '@/lib/returns/ui/vendor-session'
import { reasonLabel } from '@/lib/returns/ui/reasons'
import { formatGhs, parseAmountToPesewas, pesewasToGhsString } from '@/lib/returns/ui/amount'
import { getSellerStatusCopy } from '@/lib/returns/ui/seller-copy'
import { ReturnStatusBadge } from '@/components/returns/ReturnStatusBadge'
import { VendorReturnRespond } from '@/components/returns/vendor/VendorReturnRespond'

export const dynamic = 'force-dynamic'

export default async function VendorReturnRespondPage({
  params,
}: {
  params: { returnId: string }
}) {
  if (!isReturnsFlowEnabled()) {
    notFound()
  }

  const session = await getVendorSession()
  if (!session) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/returns'))
  }

  const stores = await getPrisma().store.findMany({
    where: { userId: session.userId },
    select: { id: true },
  })
  const storeIds = stores.map((store) => store.id)

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
              store: { select: { id: true } },
            },
          },
        },
      },
      refunds: { select: { id: true, status: true, amount: true } },
    },
  })

  if (!request || !storeIds.includes(request.orderItem.product.store.id)) {
    notFound()
  }

  const copy = getSellerStatusCopy(request.status)
  const unit = parseAmountToPesewas(String(request.orderItem.price))
  const unitPesewas = unit.kind === 'ok' ? unit.pesewas : 0
  const lineTotalPesewas = unitPesewas * request.quantity
  const requestedRaw = (request as any).policySnapshot?.requestedAmount
  let requestedPesewas: number | null = null
  if (requestedRaw !== undefined && requestedRaw !== null) {
    const parsedRequested = parseAmountToPesewas(String(requestedRaw))
    if (parsedRequested.kind === 'ok') requestedPesewas = parsedRequested.pesewas
  }
  const amountPesewas = requestedPesewas ?? lineTotalPesewas

  if (request.status === 'PENDING') {
    return (
      <VendorReturnRespond
        returnId={request.id}
        reason={request.reason}
        quantity={request.quantity}
        amountPesewas={amountPesewas}
        deadline={request.escalationDeadline?.toISOString() ?? null}
        itemName={request.orderItem.product.name}
        itemImage={request.orderItem.product.images[0]?.url ?? null}
        refunds={request.refunds.map((r) => ({ id: r.id, status: r.status, amount: String(r.amount) }))}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link href="/dashboard/vendor/returns">
            <Button variant="outline" size="sm">
              Back to returns
            </Button>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">Return request</h1>
          <p className="text-slate-600 mt-2">
            {copy.description} {copy.nextStep}
          </p>
        </div>

        <Card className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-deep-navy truncate">{request.orderItem.product.name}</span>
              <ReturnStatusBadge status={request.status} />
            </div>
            <p className="text-sm text-slate-500">
              {reasonLabel(request.reason)} \u00b7 {request.quantity} item{request.quantity !== 1 ? 's' : ''}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Reference amount</p>
                <p className="text-sm font-medium text-slate-900">
                  {formatGhs(pesewasToGhsString(amountPesewas))}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Requested by</p>
                <p className="text-sm text-slate-500">
                  {new Date(request.createdAt).toLocaleDateString('en-GH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
            {request.escalationDeadline && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Respond by</p>
                <p className="text-sm font-medium text-slate-900">
                  {new Date(request.escalationDeadline).toLocaleDateString('en-GH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            )}
            {request.refunds.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Refund</p>
                <p className="text-sm text-slate-500">
                  {request.refunds.map((r) => `Refund ${formatGhs(String(r.amount))} - ${r.status}`).join(' \u00b7 ')}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-6">
            <p className="text-sm text-slate-500">
              No further action is available for this return request.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
