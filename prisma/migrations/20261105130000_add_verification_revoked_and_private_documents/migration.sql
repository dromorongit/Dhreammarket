-- Add REVOKED verification status and revokedAt timestamp so revocation is
-- distinct from rejection. Make VerificationDocument storage private by
-- renaming documentUrl to documentPath (a private storage path, never a public
-- URL). Documents are served only through an admin-authorized signed URL
-- endpoint.

-- AlterTable: append REVOKED to the VerificationStatus enum.
ALTER TYPE "VerificationStatus" ADD VALUE 'REVOKED';

-- AlterTable: add revokedAt to vendor_verification_applications.
ALTER TABLE "vendor_verification_applications" ADD COLUMN "revokedAt" TIMESTAMP(3);

-- AlterTable: rename documentUrl to documentPath in verification_documents.
ALTER TABLE "verification_documents" RENAME COLUMN "documentUrl" TO "documentPath";
