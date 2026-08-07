import 'dotenv/config'
import { getPrisma } from '../lib/prisma'
import { isPaystackConfigured } from '../lib/paystack'

const key = process.env.PAYSTACK_SECRET_KEY
console.log('[repro] PAYSTACK_SECRET_KEY =', JSON.stringify(key))
console.log('[repro] isPaystackConfigured =', isPaystackConfigured())

async function main() {
  const c = getPrisma()
  const pool = (c as any)._poolConfig
  try {
    const [userCount, planCount, subCount] = await Promise.all([
      c.user.count(),
      c.subscriptionPlan.count(),
      c.vendorSubscription.count(),
    ])
    console.log('[repro] counts: users=%d plans=%d subs=%d', userCount, planCount, subCount)
    const samplePlans = await c.subscriptionPlan.findMany({ select: { id: true, name: true, priceMonthly: true, priceYearly: true, isActive: true } })
    console.log('[repro] plans:', JSON.stringify(samplePlans))
    const subsWithPlan = await c.vendorSubscription.findMany({ take: 5, select: { vendorId: true, planId: true, plan: { select: { name: true } }, status: true, billingCycle: true, currentPeriodStart: true, currentPeriodEnd: true } })
    console.log('[repro] subs+plan:', JSON.stringify(subsWithPlan, (k,v)=> v instanceof Date ? v.toISOString() : v))
    const paystackPaymentCount = await c.subscriptionPayment.count()
    console.log('[repro] existing sub payments:', paystackPaymentCount)
  } catch (e: any) {
    console.error('[repro] DB ERROR:', e.message)
  } finally {
    try { await c.$disconnect() } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
