import { NextRequest, NextResponse } from 'next/server'
import { getPrisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/adminAuth'
import { generateSignedDocumentUrl } from '@/lib/verification-documents'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } },
) {
  try {
    const authCheck = await requireAdmin()
    if (authCheck instanceof NextResponse) {
      return authCheck
    }

    const document = await getPrisma().verificationDocument.findUnique({
      where: { id: params.documentId },
      select: {
        id: true,
        documentType: true,
        fileName: true,
        applicationId: true,
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const { url, expiresAt } = generateSignedDocumentUrl(document.id)

    return NextResponse.json({
      document: {
        id: document.id,
        documentType: document.documentType,
        fileName: document.fileName,
      },
      url,
      expiresAt,
    })
  } catch (error) {
    console.error('Error generating verification document URL:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
