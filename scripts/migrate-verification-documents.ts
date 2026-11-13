import * as fs from 'fs'
import * as path from 'path'
import { pathToFileURL } from 'node:url'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), '.env') })

import { getPrisma } from '../lib/prisma'
import {
  uploadKycDocument,
  deleteImage,
  isPublicUrl,
  default as cloudinary,
} from '../lib/cloudinary'

function guessResourceType(fileName: string): 'image' | 'raw' {
  return path.extname(fileName).toLowerCase() === '.pdf' ? 'raw' : 'image'
}

interface MigrationArgs {
  dryRun: boolean
  execute: boolean
  confirmHost: string | null
}

export function parseMigrationArgs(args: string[]): MigrationArgs {
  const execute = args.includes('--execute')
  const confirmHostArg = args.find((argument) => argument.startsWith('--confirm-host='))
  return {
    dryRun: !execute,
    execute,
    confirmHost: confirmHostArg ? confirmHostArg.slice('--confirm-host='.length) : null,
  }
}

export function targetDatabase(databaseUrl: string): { host: string; database: string } {
  const parsed = new URL(databaseUrl)
  return {
    host: parsed.hostname,
    database: decodeURIComponent(parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? ''),
  }
}

export function requireConfirmHost(databaseUrl: string | undefined, confirmHost: string | null): { host: string; database: string } {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set')
  }
  const { host, database } = targetDatabase(databaseUrl)
  if (confirmHost === null || confirmHost !== host) {
    throw new Error(`refusing to run: --confirm-host must match the DATABASE_URL host (${host})`)
  }
  return { host, database }
}

async function main() {
  const args = process.argv.slice(2)
  const { dryRun, execute, confirmHost } = parseMigrationArgs(args)

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const { host, database } = targetDatabase(databaseUrl)
  console.log(`Target database: ${host}/${database}`)

  // Writes and deletes only happen with --execute, and only after the
  // --confirm-host value matches the DATABASE_URL host. Dry run is the default.
  if (execute) {
    try {
      requireConfirmHost(databaseUrl, confirmHost)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }

  const prisma = getPrisma()

  const documents = await prisma.verificationDocument.findMany({
    select: { id: true, documentPath: true, resourceType: true, fileName: true, applicationId: true },
  })

  let migrated = 0
  let failed = 0
  let skipped = 0

  console.log(`Found ${documents.length} verification document(s). Dry run: ${dryRun}`)

  for (const doc of documents) {
    // Idempotency: skip documents already migrated to a private path with a
    // stored resource type.
    if (!isPublicUrl(doc.documentPath)) {
      if (doc.resourceType) {
        console.log(`SKIP ${doc.id}: already private path "${doc.documentPath}" (resource_type=${doc.resourceType})`)
        skipped++
        continue
      }
      // Private path recorded before resource_type existed: re-upload to
      // populate resource_type without touching the stored public_id.
    }

    console.log(`MIGRATE ${doc.id}: "${doc.documentPath}"`)

    if (dryRun) {
      const resourceType = guessResourceType(doc.fileName ?? 'document')
      console.log(`  [dry-run] would re-upload as authenticated ${resourceType} and store resource_type`)
      migrated++
      continue
    }

    try {
      // Download the public file
      const response = await fetch(doc.documentPath)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      const buffer = Buffer.from(await response.arrayBuffer())

      // Same type ('authenticated') and resource_type as the KYC upload path:
      // 'raw' for PDFs, 'image' for images.
      const resourceType = guessResourceType(doc.fileName ?? 'document')
      const folder = 'dhream-market/verification-documents'

      const result = await uploadKycDocument(buffer, folder, guessMimeType(doc.fileName ?? 'document'))

      // Verify the private copy exists in Cloudinary before touching the
      // original. Never delete on failure.
      try {
        await cloudinary.api.resource(result.publicId, {
          resource_type: result.resourceType,
          type: 'authenticated',
        })
      } catch (verifyErr) {
        throw new Error(
          `private copy not found in Cloudinary after upload: ${verifyErr instanceof Error ? verifyErr.message : String(verifyErr)}`
        )
      }

      // Update documentPath to the new private path (public_id) and store
      // resource_type alongside it.
      await prisma.verificationDocument.update({
        where: { id: doc.id },
        data: { documentPath: result.publicId, resourceType: result.resourceType },
      })

      // Delete the public original only after the private copy is verified
      // and the DB row updated. invalidate: true purges CDN caches.
      const publicIdFromUrl = extractPublicIdFromUrl(doc.documentPath)
      if (publicIdFromUrl) {
        const originalResourceType = guessResourceType(doc.fileName ?? 'document')
        try {
          await deleteImage(publicIdFromUrl, originalResourceType)
          console.log(`  deleted public original "${publicIdFromUrl}" (resource_type=${originalResourceType}, invalidate=true)`)
        } catch (deleteErr) {
          console.warn(`  Warning: could not delete public original for ${doc.id}:`, deleteErr)
        }
      }

      console.log(`  OK -> private path "${result.publicId}" (resource_type=${result.resourceType})`)
      migrated++
    } catch (err) {
      failed++
      // Never delete the original on failure.
      console.error(`  FAILED ${doc.id}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${failed} failed, ${skipped} skipped`)
}

function guessMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.pdf':
      return 'application/pdf'
    default:
      return 'application/octet-stream'
  }
}

function extractPublicIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const parts = parsed.pathname.split('/')
    const uploadIndex = parts.indexOf('upload')
    if (uploadIndex === -1 || uploadIndex + 2 >= parts.length) return null
    // Skip version segment if present (e.g. /upload/v1234/folder/name.jpg)
    let start = uploadIndex + 1
    if (/^v\d+$/.test(parts[start])) start++
    const publicIdWithExt = parts.slice(start).join('/')
    const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '')
    return publicId || null
  } catch {
    return null
  }
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (invokedDirectly) {
  main().catch((err) => {
    console.error('Migration script failed:', err)
    process.exit(1)
  })
}
