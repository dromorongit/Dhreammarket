import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Only customers can upload review images' }, { status: 403 })
    }

    const productId = params.id
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const reviewId = formData.get('reviewId') as string

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!reviewId) {
      return NextResponse.json({ error: 'Review ID is required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const upload = await fetch('https://api.cloudinary.com/v1_1/dreamarket/image/upload', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        file: buffer.toString('base64'),
        upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET || 'dhreamarket',
      }),
    })

    if (!upload.ok) {
      return NextResponse.json({ error: 'Image upload failed' }, { status: 500 })
    }

    const uploadData = await upload.json()

    const image = await getPrisma().reviewImage.create({
      data: {
        reviewId,
        url: uploadData.secure_url,
        alt: file.name,
      },
    })

    return NextResponse.json({ image }, { status: 201 })
  } catch (error) {
    console.error('Error uploading review image:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const imageId = params.id
    const image = await getPrisma().reviewImage.findUnique({ where: { id: imageId } })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const review = await getPrisma().productReview.findUnique({
      where: { id: image.reviewId },
      select: { userId: true },
    })

    if (review?.userId !== payload.userId && payload.role !== 'SUPER_ADMIN' && payload.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await getPrisma().reviewImage.delete({ where: { id: imageId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting review image:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}