import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { PerformanceLogger } from '@/lib/performance'

interface RouteParams {
  params: { id: string }
}

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: RouteParams) {
  const perf = new PerformanceLogger(request.method, request.url)
  const prismaPerfStart = perf.markPrismaStart()
  try {
    const { id } = await params
    const token = request.cookies.get('token')?.value
    if (!token) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requestData = await getPrisma().serviceRequest.findUnique({
      where: { id },
      select: { customerId: true, vendorId: true },
    })

     if (!requestData) {
       perf.markPrismaEnd(prismaPerfStart)
       perf.log()
       return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
     }

     const isCustomer = requestData.customerId === payload.userId
     const isVendor = requestData.vendorId === payload.userId
     const isAdmin = payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN'

     if (!isCustomer && !isVendor && !isAdmin) {
       perf.markPrismaEnd(prismaPerfStart)
       perf.log()
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
     }

     const history = await getPrisma().serviceRequestStatusHistory.findMany({
      where: { serviceRequestId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        changer: {
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    })

    perf.markPrismaEnd(prismaPerfStart)
    const response = NextResponse.json({ timeline: history })
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    perf.log()
    return response
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error fetching timeline:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}