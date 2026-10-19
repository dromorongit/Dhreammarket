import { Metadata } from 'next'
import { getReceiptByToken } from '@/lib/receipts'
import { SITE_URL } from '@/lib/site-config'
import { formatCurrency } from '@/lib/currency'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/Button'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  return {
    title: 'Receipt - Dhream Market',
    robots: { index: false, follow: false },
  }
}

function formatVariantLabel(label: string | null): string {
  return label ? ` - ${label}` : ''
}

function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Receipt not found</h1>
          <p className="text-gray-600 mb-6">
            The receipt link is invalid, expired, or not available for viewing.
          </p>
          <Link
            href="/"
            className="text-royal-blue hover:underline text-sm font-medium"
          >
            Return to Dhream Market
          </Link>
        </div>
      </div>
    </div>
  )
}

export default async function ReceiptPage({ params }: { params: { token: string } }) {
  const receipt = await getReceiptByToken(params.token)

  if (!receipt) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Receipt body: print-friendly, mobile-first */}
      <div className="max-w-xs mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Store header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            {receipt.storeLogo ? (
              <Image src={receipt.storeLogo} alt={receipt.storeName} height={40} width={96} priority unoptimized />
            ) : (
              <div className="h-10 w-24 rounded-lg bg-slate-100 flex items-center justify-center">
                <span className="text-xs font-semibold text-slate-500">{receipt.storeName.slice(0, 12)}</span>
              </div>
            )}
            <h1 className="text-xl font-bold text-gray-900 mt-1">{receipt.storeName}</h1>
            {receipt.storeContact && (
              <p className="text-sm text-gray-600">{receipt.storeContact}</p>
            )}
          </div>
          <div className="text-right">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-800 text-xs font-semibold">
              #{receipt.displayNumber}
            </span>
          </div>
        </div>

        {/* Receipt meta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm">
          <div className="bg-gray-50 p-3 rounded-xl">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Date</p>
            <p className="text-gray-900">{new Date(receipt.createdAt).toLocaleDateString('en-GH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Status</p>
            <p className="text-gray-900">{receipt.status}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Payment</p>
            <p className="text-gray-900">
              {receipt.paymentStatus === 'PAID' ? 'Paid' : 'Unpaid'}
              {receipt.paymentMethod ? ` • ${receipt.paymentMethod}` : ''}
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded-xl">
            <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Customer</p>
            <p className="text-gray-900">{receipt.customerFirstName || 'Guest'}</p>
          </div>
        </div>

        {/* Items table */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">Items</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="pb-2 font-normal">Item</th>
                <th className="pb-2 text-right font-normal">Qty</th>
                <th className="pb-2 text-right font-normal">Unit</th>
                <th className="pb-2 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 text-gray-900">
                    <div className="text-gray-900">{item.name}</div>
                    {item.variantLabel && (
                      <div className="text-xs text-gray-500 mt-0.5">{item.variantLabel}</div>
                    )}
                  </td>
                  <td className="py-3 text-right text-gray-900">{item.quantity}</td>
                  <td className="py-3 text-right text-gray-900">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-3 text-right text-gray-900">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="space-y-3 mb-8">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="text-gray-900">{formatCurrency(receipt.subtotal)}</span>
          </div>
          {receipt.deliveryFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Delivery fee</span>
              <span className="text-gray-900">{formatCurrency(receipt.deliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between pt-3 border-t border-gray-200">
            <span className="text-sm font-bold text-gray-900">Total</span>
            <span className="text-sm font-bold text-gray-900">{formatCurrency(receipt.total)}</span>
          </div>
        </div>

        {/* Footer with growth loop */}
        <div className="pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500 mb-2">
            Receipt by <span className="font-semibold text-gray-900">{receipt.storeName}</span>, powered by{' '}
            <Link href="/" className="text-royal-blue hover:underline font-medium">
              Dhream Market
            </Link>
          </p>
          <div className="flex items-center justify-center gap-2">
            <Link
              href={`/vendor/${receipt.storeSlug}`}
              className="text-xs text-royal-blue hover:underline font-medium"
            >
              Visit {receipt.storeName}
            </Link>
            <span className="text-xs text-gray-400">·</span>
            <Link
              href="/"
              className="text-xs text-royal-blue hover:underline font-medium"
            >
              Dhream Market Home
            </Link>
          </div>
        </div>
      </div>

      {/* Sticky print button (mobile) */}
      <div className="fixed bottom-4 left-4 right-4 sm:hidden z-50">
        <Button
          fullWidth
          onClick={() => window.print()}
          className="text-sm px-6 py-3.5"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h10a2 2 0 002 2z" />
          </svg>
          Print / Save PDF
        </Button>
      </div>

      {/* Print-only styles */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #receipt-content, #receipt-content * {
              visibility: visible !important;
            }
            #receipt-content {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              padding: 0 !important;
              background: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
    </div>
  )
}
