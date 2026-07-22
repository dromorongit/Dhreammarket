import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { uploadImage, deleteImage } from '@/lib/cloudinary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, and WebP are allowed.' }, { status: 400 })
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 })
    }

    const user = await getPrisma().user.findUnique({
      where: { id: payload.userId },
      include: { profile: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.profile?.avatar) {
      try {
        const publicId = user.profile.avatar.split('/').slice(-2).join('/').split('.')[0]
        await deleteImage(publicId)
      } catch {
        // Ignore delete errors
      }
    }

    const result = await uploadImage(file, 'dhream-market/avatars')

    const profile = await getPrisma().profile.upsert({
      where: { userId: payload.userId },
      update: { avatar: result.url },
      create: { userId: payload.userId, avatar: result.url },
    })

    return NextResponse.json({ profile, message: 'Avatar uploaded successfully' })
  } catch (error) {
    console.error('Error uploading avatar:', error)
    return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 })
  }
}
