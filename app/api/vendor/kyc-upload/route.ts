import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth-middleware'
import { uploadKycDocument, isPublicUrl } from '@/lib/cloudinary'
import { rateLimit } from '@/lib/rate-limit'

// Force Node.js runtime (required for Cloudinary stream operations)
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FILES = 10
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const KYC_FOLDER = 'dhream-market/verification-documents'

const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']

function resourceTypeForFileName(fileName: string): 'image' | 'raw' {
  return fileName.toLowerCase().endsWith('.pdf') ? 'raw' : 'image'
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

    const rateLimitCheck = rateLimit('upload', payload.userId)(request)
    if (rateLimitCheck.success !== true) {
      return rateLimitCheck.response
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const applicationId = formData.get('applicationId')?.toString()

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed per upload` }, { status: 400 })
    }
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId is required' }, { status: 400 })
    }

    // Only the vendor who owns the verification application may upload KYC documents
    const application = await getPrisma().vendorVerificationApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, vendorId: true },
    })
    if (!application) {
      return NextResponse.json({ error: 'Verification application not found' }, { status: 404 })
    }
    if (application.vendorId !== payload.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const urls: Array<{
      url: string
      publicId: string
      resourceType: 'image' | 'raw'
      fileName: string
      size: number
    }> = []

    for (const file of files) {
      const fileExtension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : ''

      if (!allowedMimeTypes.includes(file.type) || !allowedExtensions.includes(fileExtension)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.name}. Only JPG, PNG, WebP, and PDF are allowed for KYC documents.` },
          { status: 400 }
        )
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File too large: ${file.name}. Maximum size is 10MB.` }, { status: 400 })
      }

      const result = await uploadKycDocument(file, KYC_FOLDER, file.type)

      // KYC documents must never be exposed as public URLs.
      if (isPublicUrl(result.url)) {
        return NextResponse.json(
          { error: `Refused to store public URL for KYC document ${file.name}` },
          { status: 500 }
        )
      }

      urls.push({
        url: result.url,
        publicId: result.publicId,
        resourceType: result.resourceType,
        fileName: file.name,
        size: result.size,
      })
    }

    return NextResponse.json({
      success: true,
      urls,
      message: `${files.length} KYC document(s) uploaded as private authenticated assets`,
    })
  } catch (error: any) {
    console.error('[KYC Upload] Error during upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to upload KYC documents. Please try again.', details: process.env.NODE_ENV === 'development' ? errorMessage : undefined },
      { status: 500 }
    );
  }
}
