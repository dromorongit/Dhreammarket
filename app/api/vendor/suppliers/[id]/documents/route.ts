import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth-middleware'
import { isVendorOnboarded } from '@/lib/onboarding'
import { addSupplierDocument } from '@/lib/supplier-procurement'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const isOnboarded = await isVendorOnboarded(payload.userId)
    if (!isOnboarded) {
      return NextResponse.json(
        { error: 'Complete store setup to manage suppliers' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const documentType = formData.get('documentType') as string
    const metadataStr = formData.get('metadata') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!documentType) {
      return NextResponse.json({ error: 'Document type is required' }, { status: 400 })
    }

    const validTypes = ['CONTRACT', 'INVOICE', 'QUOTATION', 'AGREEMENT']
    if (!validTypes.includes(documentType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const dataUri = `data:${file.type};base64,${base64}`

    const documentUrl = dataUri

    const metadata = metadataStr ? JSON.parse(metadataStr) : undefined

    const result = await addSupplierDocument(
      params.id,
      documentType as any,
      documentUrl,
      file.name,
      metadata
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      document: result.document,
    })
  } catch (error) {
    console.error('Error uploading supplier document:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}