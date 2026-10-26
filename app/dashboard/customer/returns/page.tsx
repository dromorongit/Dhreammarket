import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { getCustomerSession } from '@/lib/returns/ui/server'
import { getPrisma } from '@/lib/prisma'
import { ReturnListItem } from '@/components/returns/ReturnListItem'
import { ReturnEmptyState } from '@/components/returns/ReturnEmptyState'

export const dynamic = 'force-dynamic'

export default async function MyReturnsPage() {
  if (!isReturnsFlowEnabled()) {
    notFound()
  }

  const session = await getCustomerSession()
  if (!session) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/customer/returns'))
  }

  const requests = await getPrisma().returnRequest.findMany({
    where: { customerId: session.userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      reason: true,
      quantity: true,
      createdAt: true,
      orderItemId: true,
      orderItem: {
        select: {
          id: true,
          quantity: true,
          price: true,
          product: { select: { name: true, images: { select: { url: true } } } },
        },
      },
    },
  })

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-royal-blue/10 px-3 py-1 text-xs font-semibold text-royal-blue uppercase tracking-wider">
              Returns
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-deep-navy">My Returns</h1>
          <p className="text-slate-600 mt-2">
            Track your return requests and refunds.
          </p>
        </div>

        {requests.length === 0 ? (
          <ReturnEmptyState />
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const item = request.orderItem
              return (
                <ReturnListItem
                  key={request.id}
                  request={{
                    id: request.id,
                    status: request.status,
                    reason: request.reason,
                    quantity: request.quantity,
                    createdAt: request.createdAt,
                    orderItemId: request.orderItemId,
                  }}
                  item={item ? { name: item.product.name, price: item.price, quantity: item.quantity } : null}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
