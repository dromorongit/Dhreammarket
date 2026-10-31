import type { SellerTrustProfile } from '@/lib/trust/types'
import { formatRate, formatDelivery, formatReturns, formatRating } from '@/lib/trust/copy'

export function SellerTrustProfileCard({
  profile,
  storeName,
}: {
  profile: SellerTrustProfile
  storeName: string
}) {
  const identityLabel = profile.identity.status === 'VERIFIED' ? 'Identity verified' : 'Identity not verified'

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Identity</h2>
        <p className="mt-1 text-slate-700">{identityLabel}</p>
        {profile.identity.verifiedSince ? (
          <p className="text-sm text-slate-500">
            Verified since {profile.identity.verifiedSince.toISOString().slice(0, 10)}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Time on platform</h2>
        <p className="mt-1 text-slate-700">{profile.tenure.daysOnPlatform} days</p>
        {profile.tenure.firstSaleAt ? (
          <p className="text-sm text-slate-500">
            First sale {profile.tenure.firstSaleAt.toISOString().slice(0, 10)}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Completed orders</h2>
        <p className="mt-1 text-slate-700">
          {profile.orders.completed} in the last {profile.window.rollingDays} days
        </p>
        <p className="text-sm text-slate-500">{profile.orders.lifetimeCompleted} lifetime</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Signals</h2>
        <ul className="mt-3 space-y-3">
          <li className="text-sm text-slate-700">
            {formatRate(profile.fulfilment, 'Orders fulfilled')}
          </li>
          <li className="text-sm text-slate-700">
            {formatRate(profile.cancellation, 'Orders cancelled by seller')}
          </li>
          <li className="text-sm text-slate-700">{formatDelivery(profile.delivery)}</li>
          <li className="text-sm text-slate-700">{formatReturns(profile.sellerFaultReturns)}</li>
          <li className="text-sm text-slate-700">
            Rating: {formatRating(profile.ratings)}
          </li>
        </ul>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">How we calculate this</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc pl-5">
          <li>Identity reflects the verification application approved by Dhream.</li>
          <li>Completed orders are paid orders marked delivered or completed.</li>
          <li>Fulfilment rate is completed orders divided by completed plus seller-cancelled orders.</li>
          <li>Cancellation rate counts only seller-attributable cancellations; customer-requested cancellations are excluded.</li>
          <li>Delivery reliability is the median days from payment to delivery.</li>
          <li>Seller-fault returns count returns for not-as-described, damaged, wrong-item or not-received reasons that were accepted or approved. Counts below 5 are suppressed.</li>
          <li>Ratings are averages of reviews tied to paid, delivered orders from verified purchases; reviews from the store owner are excluded. Shown only with 5 or more reviews.</li>
          <li>Rates require at least 10 orders; otherwise shown as not enough data.</li>
          <li>In-progress orders are excluded from all rates.</li>
        </ul>
      </div>
    </section>
  )
}
