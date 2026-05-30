import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { uploadMultipleImages } from '@/lib/cloudinary'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin only' }, { status: 403 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const folder = formData.get('folder')?.toString() || 'brands'

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    if (files.length > 1) {
      return NextResponse.json({ error: 'Only one file allowed for brand logos' }, { status: 400 })
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    const maxFileSize = 5 * 1024 * 1024

    for (const file of files) {
      if (!allowedMimeTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.name}. Only JPG, PNG, and WebP are allowed.` },
          { status: 400 }
        )
      }
      if (file.size > maxFileSize) {
        return NextResponse.json({ error: `File too large: ${file.name}. Maximum size is 5MB.` }, { status: 400 })
      }
    }

    const uploadFolder =
      folder === 'brands' ? 'dhream-market/brands' : `dhream-market/${folder}`

    const uploadedImages = await uploadMultipleImages(files, uploadFolder)
    const urls = uploadedImages.map((img) => ({
      url: img.url,
      publicId: img.publicId,
      secureUrl: img.secureUrl,
    }))

    return NextResponse.json({
      success: true,
      urls,
      message: 'Image uploaded successfully',
    })
  } catch (error) {
    console.error('[SuperAdmin Upload] Error:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
