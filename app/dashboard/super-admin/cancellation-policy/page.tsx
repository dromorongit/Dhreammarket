import { getPrisma } from '@/lib/prisma'
import { requireSuperAdmin } from '@/lib/adminAuth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card'
import { formatPrice } from '@/lib/currency'

interface CancellationRow {
  id: string
  userId: string
  orderId: string
  feeAmount: number | null
  refundAmount: number | null
  createdAt: Date
  user: { id: string; email: string } | null
  order: { id: string; total: number; paymentStatus: string; createdAt: Date } | null
}

export default async function CancellationPolicyPage() {
  const authCheck = await requireSuperAdmin()
  if (authCheck instanceof Response) {
    // Not reachable in a server render context, but satisfies the type.
    return null
  }

  const prisma = getPrisma()
  const rows = (await prisma.customerCancellation.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      userId: true,
      orderId: true,
      feeAmount: true,
      refundAmount: true,
      createdAt: true,
      user: { select: { id: true, email: true } },
      order: { select: { id: true, total: true, paymentStatus: true, createdAt: true } },
    },
  })) as unknown as CancellationRow[]

  const totalFee = rows.reduce((sum, row) => sum + Number(row.feeAmount || 0), 0)
  const totalRefund = rows.reduce((sum, row) => sum + Number(row.refundAmount || 0), 0)

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Customer Cancellation Policy</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-sm text-slate-600 mb-4">
              Read-only platform revenue record of every paid non-manual
              customer cancellation. Fee totals are retained in GHS; the
              Paystack processing fee is never part of a refund.
            </p>
            <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
              <div className="bg-white p-4 rounded-lg border border-slate-200">
                <p className="text-slate-500">Cancellations</p>
                <p className="font-semibold text-slate-900">{rows.length}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-200">
                <p className="text-slate-500">Total fees (GHS)</p>
                <p className="font-semibold text-slate-900">{formatPrice(totalFee)}</p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-slate-200">
                <p className="text-slate-500">Total refunds (GHS)</p>
                <p className="font-semibold text-slate-900">{formatPrice(totalRefund)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cancellation records</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600">
                    <th className="p-3 text-left">Created</th>
                    <th className="p-3 text-left">User</th>
                    <th className="p-3 text-left">Order</th>
                    <th className="p-3 text-left">Fee (GHS)</th>
                    <th className="p-3 text-left">Refund (GHS)</th>
                    <th className="p-3 text-left">Order status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="p-3 text-slate-500" colSpan={6}>
                        No cancellation records yet.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-3">
                          {new Date(row.createdAt).toLocaleString('en-GH', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3">
                          {row.user?.email ?? row.userId}
                        </td>
                        <td className="p-3 font-mono text-xs">{row.orderId.slice(-8)}</td>
                        <td className="p-3">{formatPrice(Number(row.feeAmount || 0))}</td>
                        <td className="p-3">{formatPrice(Number(row.refundAmount || 0))}</td>
                        <td className="p-3 text-slate-500 text-xs">
                          {row.order?.paymentStatus}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
