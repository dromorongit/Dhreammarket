import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { uploadImage } from '@/lib/cloudinary'
import { PerformanceLogger } from '@/lib/performance'

interface RouteParams {
  params: { id: string }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest, { params }: RouteParams) {
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

    const existing = await getPrisma().serviceRequest.findUnique({
      where: { id },
      select: { customerId: true, vendorId: true, status: true },
    })

    if (!existing) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Service request not found' }, { status: 404 })
    }

    const isCustomer = existing.customerId === payload.userId
    const isVendor = existing.vendorId === payload.userId
    const isAdmin = payload.role === 'ADMIN' || payload.role === 'SUPER_ADMIN'

    if (!isCustomer && !isVendor && !isAdmin) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (existing.status === 'CANCELLED' || existing.status === 'COMPLETED') {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Cannot upload attachments for a completed or cancelled request' }, { status: 400 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const maxSize = 10 * 1024 * 1024

    if (!allowedTypes.includes(file.type)) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'Invalid file type. Supported types: JPEG, PNG, WebP, PDF, ZIP, DOC, DOCX' }, { status: 400 })
    }

    if (file.size > maxSize) {
      perf.markPrismaEnd(prismaPerfStart)
      perf.log()
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uploadResult = await uploadImage(buffer, file.type, `dhream-market/service-requests/${id}`)

    const attachment = await getPrisma().serviceRequestAttachment.create({
      data: {
        serviceRequestId: id,
        fileName: file.name,
        fileUrl: uploadResult.url,
        fileType: file.type,
        fileSize: file.size,
        uploadedBy: payload.userId,
      },
    })
    perf.markPrismaEnd(prismaPerfStart)

    perf.log()
    return NextResponse.json({ attachment }, { status: 201 })
  } catch (error) {
    perf.markPrismaEnd(prismaPerfStart)
    perf.log()
    console.error('Error uploading attachment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}