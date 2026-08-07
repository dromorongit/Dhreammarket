import { NextRequest } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { subscriptionPlans, planBenefits, getFeatureRestrictions } from '@/lib/subscription/types'
import { SubscriptionDashboardData } from '@/lib/subscription/types'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    }

    const prisma = getPrisma()
    const subscription = await prisma.vendorSubscription.findUnique({
      where: { vendorId: payload.userId },
      include: { plan: true },
    })

    const plans = subscriptionPlans.map((p) => ({
      name: p.name,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      productsLimit: p.productsLimit,
      servicesLimit: p.servicesLimit,
      benefits: planBenefits[p.name as keyof typeof planBenefits],
      restrictions: getFeatureRestrictions(p.name),
    }))

    const currentPlan = subscription?.plan?.name ?? 'Free'
    const status = subscription?.status ?? 'NONE'
    const nextRenewal = subscription?.nextRenewalAt?.toISOString() ?? null
    const startDate = subscription?.currentPeriodStart?.toISOString() ?? null
    const endDate = subscription?.currentPeriodEnd?.toISOString() ?? null

    const productCount = await prisma.product.count({
      where: { store: { userId: payload.userId } },
    })
    const serviceCount = await prisma.service.count({
      where: { vendorId: payload.userId },
    })

    const plan = subscription?.plan ?? subscriptionPlans.find((p) => p.name === 'Free')
    const productsLimit = plan?.productsLimit ?? 20
    const servicesLimit = plan?.servicesLimit ?? 10

    const invoices = await prisma.subscriptionInvoice.findMany({
      where: { subscription: { vendorId: payload.userId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const payments = await prisma.subscriptionPayment.findMany({
      where: { subscription: { vendorId: payload.userId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const usage = [
      { metric: 'products_count', currentValue: productCount, limit: productsLimit > 0 ? productsLimit : null, percentage: productsLimit > 0 ? Math.min((productCount / productsLimit) * 100, 100) : 0 },
      { metric: 'services_count', currentValue: serviceCount, limit: servicesLimit > 0 ? servicesLimit : null, percentage: servicesLimit > 0 ? Math.min((serviceCount / servicesLimit) * 100, 100) : 0 },
    ]

    const billingHistory = invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
      status: inv.status,
      periodStart: inv.periodStart.toISOString(),
      periodEnd: inv.periodEnd.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    }))

    const data: SubscriptionDashboardData = {
      subscriptionId: subscription?.id ?? '',
      currentPlan,
      subscriptionStatus: status,
      startDate,
      endDate,
      nextRenewal,
      productsRemaining: productsLimit > 0 ? Math.max(productsLimit - productCount, 0) : -1,
      servicesRemaining: servicesLimit > 0 ? Math.max(servicesLimit - serviceCount, 0) : -1,
      billingHistory,
      usage,
      plans,
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error fetching subscription dashboard:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
  }
}