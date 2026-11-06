-- Add resource_type to verification_documents so the Cloudinary storage
-- resource type ('image' | 'raw') is kept alongside the private documentPath.
ALTER TABLE "verification_documents" ADD COLUMN "resource_type" VARCHAR(20);
