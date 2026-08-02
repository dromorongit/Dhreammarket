import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import {
  getSubscriptionPlans,
  getSubscriptionPlanByName,
  getVendorSubscription,
  getUpcomingRenewals,
  getExpiredSubscriptions,
  getSubscriptionRevenueDashboard,
  trackSubscriptionUsage,
} from '@/lib/subscription/subscription-service'
import { logInfo, logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) {
    return { error: 'Unauthorized', status: 401, payload: null }
  }
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'SUPER_ADMIN') {
    return { error: 'Forbidden', status: 403, payload: null }
  }
  return { error: null, status: 200, payload }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'plans': {
        const plans = await getSubscriptionPlans()
        return NextResponse.json({ plans })
      }

      case 'revenue': {
        const range = searchParams.get('range') || 'thismonth'
        const revenue = await getSubscriptionRevenueDashboard()
        return NextResponse.json({ revenue })
      }

      case 'upcomingRenewals': {
        const days = parseInt(searchParams.get('days') || '30', 10)
        const renewals = await getUpcomingRenewals(days)
        return NextResponse.json({ renewals })
      }

      case 'expired': {
        const expired = await getExpiredSubscriptions()
        return NextResponse.json({ expired })
      }

      case 'distribution': {
        const prisma = getPrisma()
        const dist = await prisma.vendorSubscription.groupBy({
          by: ['planId'],
          where: { status: 'ACTIVE' },
          _count: { id: true },
          _sum: { totalPaid: true },
        })
        const plans = await prisma.subscriptionPlan.findMany({
          where: { isActive: true },
          select: { id: true, name: true, priceMonthly: true, priceYearly: true },
        })
        const planMap = Object.fromEntries(plans.map((p) => [p.id, p]))
        return NextResponse.json({
          distribution: dist.map((d) => ({
            planName: planMap[d.planId]?.name ?? 'Unknown',
            count: d._count.id,
            totalPaid: d._sum.totalPaid ?? 0,
          })),
        })
      }

      case 'vendorAnalytics': {
        const vendorId = searchParams.get('vendorId')
        if (!vendorId) {
          return NextResponse.json({ error: 'Vendor ID required' }, { status: 400 })
        }
        const subscription = await getVendorSubscription(vendorId)
        if (!subscription) {
          return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
        }
        return NextResponse.json({ subscription })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    logError('Error in admin subscription endpoint:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request)
    if (auth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { action, name, priceMonthly, priceYearly, productsLimit, servicesLimit, isActive, isFeatured, displayOrder, description, benefits } = body

    switch (action) {
      case 'createPlan': {
        if (!name) {
          return NextResponse.json({ error: 'Plan name required' }, { status: 400 })
        }
        const prisma = getPrisma()
        const existing = await prisma.subscriptionPlan.findUnique({ where: { name } })
        if (existing) {
          return NextResponse.json({ error: 'Plan already exists' }, { status: 409 })
        }
        const plan = await prisma.subscriptionPlan.create({
          data: {
            name,
            priceMonthly: priceMonthly ?? null,
            priceYearly: priceYearly ?? null,
            productsLimit: productsLimit ?? 20,
            servicesLimit: servicesLimit ?? 10,
            isActive: isActive ?? true,
            isFeatured: isFeatured ?? false,
            displayOrder: displayOrder ?? 0,
            description,
            benefits: benefits ?? [],
          },
        })
        logInfo(`Plan created: ${name}`)
        return NextResponse.json({ plan }, { status: 201 })
      }

      case 'editPlan': {
        if (!name) {
          return NextResponse.json({ error: 'Plan name required' }, { status: 400 })
        }
        const prisma = getPrisma()
        const plan = await prisma.subscriptionPlan.update({
          where: { name },
          data: {
            ...(priceMonthly !== undefined && { priceMonthly }),
            ...(priceYearly !== undefined && { priceYearly }),
            ...(productsLimit !== undefined && { productsLimit }),
            ...(servicesLimit !== undefined && { servicesLimit }),
            ...(isActive !== undefined && { isActive }),
            ...(isFeatured !== undefined && { isFeatured }),
            ...(displayOrder !== undefined && { displayOrder }),
            ...(description !== undefined && { description }),
            ...(benefits !== undefined && { benefits }),
            updatedAt: new Date(),
          },
        })
        logInfo(`Plan updated: ${name}`)
        return NextResponse.json({ plan })
      }

      case 'deletePlan': {
        if (!name) {
          return NextResponse.json({ error: 'Plan name required' }, { status: 400 })
        }
        const prisma = getPrisma()
        const plan = await prisma.subscriptionPlan.findUnique({ where: { name } })
        if (!plan) {
          return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
        }
        await prisma.subscriptionPlan.delete({ where: { name } })
        logInfo(`Plan deleted: ${name}`)
        return NextResponse.json({ message: 'Plan deleted successfully' })
      }

      case 'togglePlan': {
        if (!name) {
          return NextResponse.json({ error: 'Plan name required' }, { status: 400 })
        }
        const prisma = getPrisma()
        const plan = await prisma.subscriptionPlan.update({
          where: { name },
          data: { isActive: !(await prisma.subscriptionPlan.findUnique({ where: { name } }))?.isActive, updatedAt: new Date() },
        })
        logInfo(`Plan toggled: ${name}, isActive=${plan.isActive}`)
        return NextResponse.json({ plan })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    logError('Error in admin subscription POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}