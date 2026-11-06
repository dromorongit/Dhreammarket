import jwt from 'jsonwebtoken'
import { SITE_URL } from '@/lib/site-config'

const SIGNED_URL_TTL_SECONDS = 15 * 60 // 15 minutes

export type SignedDocumentUrl = {
  url: string
  expiresAt: Date
  token: string
}

export function isLegacyPublicUrl(path: string): boolean {
  try {
    const url = new URL(path)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function assertPrivateDocumentPath(documentPath: string): void {
  if (isLegacyPublicUrl(documentPath)) {
    throw new Error(
      `Document "${documentPath}" is a legacy public URL. Re-upload it as a private asset before generating a signed URL.`
    )
  }
  if (!documentPath || documentPath.trim().length === 0) {
    throw new Error('Document path is empty. Re-upload the document as a private asset before generating a signed URL.')
  }
}

export function generateSignedDocumentUrl(documentId: string): SignedDocumentUrl {
  const JWT_SECRET = process.env.JWT_SECRET
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000)
  const token = jwt.sign({ documentId, exp: Math.floor(expiresAt.getTime() / 1000) }, JWT_SECRET)
  const url = `${SITE_URL}/api/verification-documents/download?token=${encodeURIComponent(token)}`
  return { url, expiresAt, token }
}

export function verifyDocumentToken(token: string): { documentId: string } | null {
  const JWT_SECRET = process.env.JWT_SECRET
  if (!JWT_SECRET) {
    console.error('JWT_SECRET environment variable is not set')
    return null
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & { documentId?: string }
    if (typeof decoded === 'object' && decoded.documentId) {
      return { documentId: decoded.documentId as string }
    }
    return null
  } catch {
    return null
  }
}
