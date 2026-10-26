import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/Button'
import { isReturnsFlowEnabled } from '@/lib/feature-flags'
import { getCustomerSession } from '@/lib/returns/ui/server'
import { getOrderItemEligibility } from '@/lib/returns/ui/eligibility'
import { NotFoundError } from '@/lib/returns/ui/server'
import { ReturnRequestForm } from '@/components/returns/ReturnRequestForm'
import { eligibilityReasonToCopy } from '@/lib/returns/ui/errors'
import { formatGhs } from '@/lib/returns/ui/amount'
import { Card } from '@/components/Card'

export const dynamic = 'force-dynamic'

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: { orderItemId?: string }
}) {
  if (!isReturnsFlowEnabled()) {
    notFound()
  }

  const session = await getCustomerSession()
  if (!session) {
    redirect('/login?redirect=' + encodeURIComponent('/dashboard/customer/returns/new'))
  }

  const orderItemId = searchParams.orderItemId
  if (!orderItemId) {
    notFound()
  }

  let eligibility
  try {
    eligibility = await getOrderItemEligibility(session.userId, orderItemId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound()
    }
    throw error
  }

  const { item, order, windowDays, eligibility: elig } = eligibility

  if (!elig.eligible) {
    const copy = eligibilityReasonToCopy(elig.reason)
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard/customer/orders" className="text-royal-blue hover:text-royal-blue/80 text-sm font-medium mb-4 inline-block">
            ← Back to My Orders
          </Link>
          <Card variant="outline" className="mt-4">
            <div className="p-8 text-center">
              <p className="text-lg font-semibold text-deep-navy mb-2">Cannot open a return for this item</p>
              <p className="text-slate-600 mb-4">{copy.message}</p>
              {copy.action && <p className="text-sm text-slate-500">{copy.action}</p>}
              <p className="text-sm text-slate-500 mt-4">
                Order {order.id.slice(-6).toUpperCase()} · {formatGhs(String(order.total))} · Status:{' '}
                {order.status}
              </p>
              <Link href={`/dashboard/customer/orders/${order.id}`}>
                <Button variant="outline" size="sm">
                  View order
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard/customer/orders" className="text-royal-blue hover:text-royal-blue/80 text-sm font-medium mb-4 inline-block">
          ← Back to My Orders
        </Link>
        <Card className="mt-4">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
              {item.imageUrl && (
                <Image
                  src={item.imageUrl}
                  alt={item.name}
                  width={48}
                  height={48}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              )}
              <div>
                <p className="text-sm text-slate-500">Item</p>
                <h2 className="font-semibold text-deep-navy">{item.name}</h2>
                <p className="text-sm text-slate-500">
                  Quantity {item.quantity} · {formatGhs(String(item.price))} each
                </p>
              </div>
            </div>
            <div className="border-t pt-6">
              <p className="text-sm text-slate-500 mb-2">
                Maximum refundable: <span className="font-semibold text-slate-900">{formatGhs(elig.maxRefundAmount.toString())}</span>
              </p>
              <p className="text-sm text-slate-500 mb-4">
                Return window: {windowDays} days from delivery.
              </p>
              <ReturnRequestForm
                orderItemId={item.id}
                itemName={item.name}
                itemQuantity={item.quantity}
                maxRefundAmount={elig.maxRefundAmount.toString()}
                windowDays={windowDays}
                vendorResponseHours={72}
              />
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
