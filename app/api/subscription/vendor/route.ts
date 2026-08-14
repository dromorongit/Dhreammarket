import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import {
  getSubscriptionPlans,
  getVendorSubscription,
  createSubscription,
  renewSubscription,
  upgradeSubscription,
  downgradeSubscription,
  cancelSubscription,
  reactivateSubscription,
  getUpcomingRenewals,
  getExpiredSubscriptions,
  getSubscriptionRevenueDashboard,
  getSubscriptionUsage,
  generateSubscriptionInvoice,
  processSubscriptionPayment,
  getSubscriptionHistory,
  } from '@/lib/subscription/subscription-service'
import { logInfo, logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let vendorId: string | null
    if (payload.role === 'VENDOR') {
      vendorId = payload.userId
    } else if (payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN') {
      vendorId = searchParams.get('vendorId')
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID required' }, { status: 400 })
    }

    const subscription = await getVendorSubscription(vendorId)
    if (!subscription) {
      return NextResponse.json({ subscription: null })
    }

    const usage = await getSubscriptionUsage(vendorId)
    const history = await getSubscriptionHistory(subscription.id, 20)

    return NextResponse.json({
      subscription: {
        ...subscription,
        plan: subscription.plan,
        usage,
        history,
      },
    })
  } catch (error) {
    logError('Error fetching vendor subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action, planName, billingCycle, subscriptionId } = body

    switch (action) {
      case 'subscribe': {
        if (!planName) {
          return NextResponse.json({ error: 'Plan name required' }, { status: 400 })
        }
        const subscription = await createSubscription(payload.userId, planName, billingCycle || 'MONTHLY')
        return NextResponse.json({ subscription }, { status: 201 })
      }

      case 'renew': {
        if (!subscriptionId) {
          return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 })
        }
        const subscription = await renewSubscription(subscriptionId)
        return NextResponse.json({ subscription })
      }

      case 'upgrade': {
        if (!planName) {
          return NextResponse.json({ error: 'Plan name required' }, { status: 400 })
        }
        const subscription = await upgradeSubscription(payload.userId, planName, billingCycle || 'MONTHLY')
        return NextResponse.json({ subscription })
      }

      case 'downgrade': {
        if (!planName) {
          return NextResponse.json({ error: 'Plan name required' }, { status: 400 })
        }
        const subscription = await downgradeSubscription(payload.userId, planName, billingCycle || 'MONTHLY')
        return NextResponse.json({ subscription })
      }

      case 'cancel': {
        const atPeriodEnd = body.atPeriodEnd ?? true
        const subscription = await cancelSubscription(payload.userId, atPeriodEnd)
        return NextResponse.json({ subscription })
      }

      case 'reactivate': {
        const subscription = await reactivateSubscription(payload.userId)
        return NextResponse.json({ subscription })
      }

      case 'generateInvoice': {
        if (!subscriptionId) {
          return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 })
        }
        const invoice = await generateSubscriptionInvoice(subscriptionId)
        return NextResponse.json({ invoice }, { status: 201 })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    logError('Error processing vendor subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { subscriptionId, autoRenew } = body

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 })
    }

    const prisma = getPrisma()
    const subscription = await prisma.vendorSubscription.findUnique({
      where: { id: subscriptionId },
    })
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const updated = await prisma.vendorSubscription.update({
      where: { id: subscriptionId },
      data: { autoRenew: autoRenew ?? !subscription.autoRenew, updatedAt: new Date() },
    })

    return NextResponse.json({ subscription: updated })
  } catch (error) {
    logError('Error updating subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const subscriptionId = searchParams.get('subscriptionId')

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Subscription ID required' }, { status: 400 })
    }

    const prisma = getPrisma()
    const subscription = await prisma.vendorSubscription.findUnique({
      where: { id: subscriptionId },
    })
    if (!subscription) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    await prisma.vendorSubscription.delete({
      where: { id: subscriptionId },
    })

    return NextResponse.json({ message: 'Subscription deleted successfully' })
  } catch (error) {
    logError('Error deleting subscription:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}