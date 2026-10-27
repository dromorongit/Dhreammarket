import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { getPrisma } from '@/lib/prisma'
import { getVendorSession } from '@/lib/returns/ui/vendor-session'
import { parseAmountToPesewas } from '@/lib/returns/ui/amount'
import { VendorReturnRow } from '@/components/returns/vendor/VendorReturnRow'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/Button'

export const dynamic = 'force-dynamic'

export default async function VendorReturnsPage() {
  if (!isReturnsFlowEnabled()) {
    notFound()
  }

  const session = await getVendorSession()
  if (!session) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/vendor/returns'))
  }

  const now = new Date()

  const stores = await getPrisma().store.findMany({
    where: { userId: session.userId },
    select: { id: true },
  })
  const storeIds = stores.map((store) => store.id)

  const requests = await getPrisma().returnRequest.findMany({
    where: {
      orderItem: { product: { storeId: { in: storeIds } } },
    },
    orderBy: { createdAt: 'desc' },
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
        },
      },
    },
  })

  const rows = requests.map((request) => {
    const item = request.orderItem
    const unit = parseAmountToPesewas(String(item.price))
    const unitPesewas = unit.kind === 'ok' ? unit.pesewas : 0
    const lineTotalPesewas = unitPesewas * request.quantity
    const requestedRaw = (request as any).policySnapshot?.requestedAmount
    const parsedRequested = requestedRaw !== undefined && requestedRaw !== null ? parseAmountToPesewas(String(requestedRaw)) : null
    const amountPesewas = parsedRequested && parsedRequested.kind === 'ok' ? parsedRequested.pesewas : lineTotalPesewas
    const deadline = request.escalationDeadline
    let timeLeft: string | null = null
    if (deadline) {
      const ms = new Date(deadline).getTime() - now.getTime()
      if (ms <= 0) {
        timeLeft = 'Overdue'
      } else {
        const hours = Math.floor(ms / 3600000)
        const minutes = Math.floor((ms % 3600000) / 60000)
        timeLeft = hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`
      }
    }
    return {
      request,
      item: {
        name: item.product.name,
        imageUrl: item.product.images[0]?.url ?? null,
        quantity: item.quantity,
        price: item.price,
      },
      amountPesewas,
      timeLeft,
    }
  })

  rows.sort((a, b) => {
    const aPending = a.request.status === 'PENDING'
    const bPending = b.request.status === 'PENDING'
    if (aPending && !bPending) return -1
    if (!aPending && bPending) return 1
    return 0
  })

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Seller returns
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">Returns</h1>
          <p className="text-slate-600 mt-2">
            Return requests for items in your store. Respond before the deadline or the request is
            escalated to Dhream.
          </p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900">Your return requests</h2>
          <Link href="/dashboard/vendor">
            <Button variant="outline" size="sm">
              Back to dashboard
            </Button>
          </Link>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No return requests"
            description="Customers can open returns on your delivered items. Requests appear here and need your response within the response window."
            actionLabel="View dashboard"
            actionHref="/dashboard/vendor"
          />
        ) : (
          <div className="space-y-3">
            {rows.map(({ request, item, amountPesewas, timeLeft }) => (
              <VendorReturnRow
                key={request.id}
                request={request}
                item={item}
                amountPesewas={amountPesewas}
                timeLeft={timeLeft}
              />
            ))}
          </div>
        )}

        <p className="mt-8 text-sm text-slate-500">
          Accepting a return refunds the customer now and the amount is deducted from your earnings.
        </p>
      </div>
    </div>
  )
}