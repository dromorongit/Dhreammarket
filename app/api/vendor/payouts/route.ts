import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendorId')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}
    if (vendorId) where.vendorId = vendorId
    if (status) where.status = status

    // Get payouts
    const payouts = await getPrisma().vendorPayout.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        store: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    })

    // Get total count for pagination
    const total = await getPrisma().vendorPayout.count({ where })

    return NextResponse.json({
      payouts,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    console.error('Error fetching vendor payouts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const outcome = await verifyToken(token)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const payload = outcome

    const { vendorId, storeId, amount, reference, note } = await request.json()

    // Validate required fields
    if (!vendorId || !storeId || !amount) {
      return NextResponse.json(
        { error: 'Vendor ID, store ID, and amount are required' },
        { status: 400 }
      )
    }

    // Verify vendor and store exist
    const [vendor, store] = await Promise.all([
      getPrisma().user.findUnique({ where: { id: vendorId, role: 'VENDOR' } }),
      getPrisma().store.findUnique({ where: { id: storeId } })
    ])

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 })
    }

    // Create payout record
    const payout = await getPrisma().vendorPayout.create({
      data: {
        vendorId,
        storeId,
        amount,
        status: 'PENDING',
        reference,
        note
      },
      include: {
        vendor: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        store: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json(payout, { status: 201 })
  } catch (error) {
    console.error('Error creating vendor payout:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}