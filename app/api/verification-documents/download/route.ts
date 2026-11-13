import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { verifyDocumentToken } from '@/lib/verification-documents'
import { requireAdmin } from '@/lib/adminAuth'
import { verifyToken } from '@/lib/auth-middleware'
import { getSignedDocumentDownloadUrl } from '@/lib/cloudinary'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 })
    }

    const payload = verifyDocumentToken(token)
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
    }

    const document = await getPrisma().verificationDocument.findUnique({
      where: { id: payload.documentId },
      include: {
        application: {
          select: { vendorId: true, id: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // (a) Admins may access any document
    const adminResult = await requireAdmin()
    if (!(adminResult instanceof NextResponse)) {
      await logDocumentAccess(document.applicationId, adminResult.userId, adminResult.role)
      const { url, expiresAt } = getSignedDocumentDownloadUrl(document.documentPath, {
        resourceType: (document.resourceType as 'image' | 'raw') || 'image',
      })
      return NextResponse.json({
        document: { id: document.id, documentType: document.documentType, fileName: document.fileName },
        url,
        expiresAt,
      })
    }

    // (b) The vendor who owns the application may access their own documents
    const sessionToken = cookies().get('token')?.value
    if (!sessionToken) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const outcome = await verifyToken(sessionToken)
    if (!outcome.authenticated) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (document.application.vendorId !== outcome.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await logDocumentAccess(document.applicationId, outcome.userId, outcome.role)
    const { url, expiresAt } = getSignedDocumentDownloadUrl(document.documentPath, {
      resourceType: (document.resourceType as 'image' | 'raw') || 'image',
    })
    return NextResponse.json({
      document: { id: document.id, documentType: document.documentType, fileName: document.fileName },
      url,
      expiresAt,
    })
  } catch (error) {
    console.error('Error downloading verification document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function logDocumentAccess(
  applicationId: string,
  userId: string,
  role: string
): Promise<void> {
  try {
    await getPrisma().verificationAuditLog.create({
      data: {
        applicationId,
        adminId: userId,
        action: 'DOCUMENT_ACCESSED' as any,
        note: 'Verification document accessed via signed URL',
      },
    })
  } catch (error) {
    console.error('Failed to create document access audit log:', error)
  }
}
