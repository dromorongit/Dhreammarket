import { v2 as cloudinary } from 'cloudinary';

// Lazy configuration - only configure when actually needed
let isConfigured = false;

function configureCloudinary() {
  if (isConfigured) return;
  
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error('[Cloudinary] Configuration missing. Please check environment variables:');
    console.error('[Cloudinary] CLOUDINARY_CLOUD_NAME:', cloudName ? 'SET' : 'MISSING');
    console.error('[Cloudinary] CLOUDINARY_API_KEY:', apiKey ? 'SET' : 'MISSING');
    console.error('[Cloudinary] CLOUDINARY_API_SECRET:', apiSecret ? 'SET' : 'MISSING');
    throw new Error('Cloudinary configuration is incomplete. Check environment variables.');
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  
  isConfigured = true;
  console.log('[Cloudinary] Configuration initialized successfully');
}

/**
 * Upload an image file to Cloudinary
 * @param file - The file to upload (File or Buffer)
 * @param folder - The Cloudinary folder to upload to
 * @param mimeType - Optional mime type when uploading a Buffer
 * @returns Promise<{url: string, publicId: string, secureUrl: string}>
 */
export async function uploadImage(
  file: File | Buffer,
  folder: string = 'dhream-market',
  mimeType?: string
): Promise<{ url: string; publicId: string; secureUrl: string }> {
  // Configure Cloudinary at runtime (not at module load time)
  configureCloudinary();

  const fileName = file instanceof File ? file.name : 'upload';
  const fileType = mimeType || (file instanceof File ? file.type : '');
  const fileSize = file instanceof File ? file.size : Buffer.byteLength(file);

  // Convert File to Buffer (Node.js compatible)
  const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;
  
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ],
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] Upload error:', {
            error,
            folder,
            fileName,
            fileType,
            fileSize,
          });
          reject(new Error(`Cloudinary upload failed: ${error.message || JSON.stringify(error)}`));
        } else if (result) {
          console.log('[Cloudinary] Upload success:', {
            publicId: result.public_id,
            url: result.secure_url,
            folder,
          });
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            secureUrl: result.secure_url,
          });
        } else {
          reject(new Error('Cloudinary upload returned no result'));
        }
      }
    );

    stream.end(buffer);
  });
}

/**
 * Upload a video file to Cloudinary
 * @param file - The file to upload (File or Buffer)
 * @param folder - The Cloudinary folder to upload to
 * @param mimeType - Optional mime type when uploading a Buffer
 * @returns Promise<{url: string, publicId: string, secureUrl: string}>
 */
export async function uploadVideo(
  file: File | Buffer,
  folder: string = 'dhream-market',
  mimeType?: string
): Promise<{ url: string; publicId: string; secureUrl: string }> {
  configureCloudinary();

  const fileName = file instanceof File ? file.name : 'upload';
  const fileType = mimeType || (file instanceof File ? file.type : '');
  const fileSize = file instanceof File ? file.size : Buffer.byteLength(file);
  const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'webm'],
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] Video upload error:', {
            error,
            folder,
            fileName,
            fileType,
            fileSize,
          });
          reject(new Error(`Cloudinary video upload failed: ${error.message || JSON.stringify(error)}`));
        } else if (result) {
          console.log('[Cloudinary] Video upload success:', {
            publicId: result.public_id,
            url: result.secure_url,
            folder,
          });
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            secureUrl: result.secure_url,
          });
        } else {
          reject(new Error('Cloudinary video upload returned no result'));
        }
      }
    );

    stream.end(buffer);
  });
}

/**
 * Upload multiple images
 * @param files - Array of files to upload
 * @param folder - The Cloudinary folder to upload to
 * @returns Promise<Array<{url: string, publicId: string, secureUrl: string}>>
 */
export async function uploadMultipleImages(
  files: File[],
  folder: string = 'dhream-market'
): Promise<Array<{ url: string; publicId: string; secureUrl: string }>> {
  const uploadPromises = files.map((file) => uploadImage(file, folder));
  return Promise.all(uploadPromises);
}

/**
 * Upload multiple videos
 * @param files - Array of files to upload
 * @param folder - The Cloudinary folder to upload to
 * @returns Promise<Array<{url: string, publicId: string, secureUrl: string}>>
 */
export async function uploadMultipleVideos(
  files: File[],
  folder: string = 'dhream-market'
): Promise<Array<{ url: string; publicId: string; secureUrl: string }>> {
  const uploadPromises = files.map((file) => uploadVideo(file, folder));
  return Promise.all(uploadPromises);
}

export function isPublicUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Upload a KYC document as a private/authenticated Cloudinary asset.
 * KYC documents must never go through the public upload helper.
 * PDFs are uploaded as resource_type 'raw', images as 'image'.
 * The stored path is the Cloudinary public_id (never a public URL).
 */
export async function uploadKycDocument(
  file: File | Buffer,
  folder: string = 'dhream-market/verification-documents',
  mimeType?: string
): Promise<{ url: string; publicId: string; resourceType: 'image' | 'raw'; size: number }> {
  configureCloudinary();

  const fileName = file instanceof File ? file.name : 'upload';
  const fileType = mimeType || (file instanceof File ? file.type : '');
  const fileSize = file instanceof File ? file.size : Buffer.byteLength(file);
  const buffer = file instanceof File ? Buffer.from(await file.arrayBuffer()) : file;

  const resourceType: 'image' | 'raw' = fileType.startsWith('image/') ? 'image' : 'raw';
  const safePublicId = `kyc/${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        type: 'authenticated',
        public_id: safePublicId,
        allowed_formats:
          resourceType === 'image'
            ? ['jpg', 'jpeg', 'png', 'webp']
            : ['pdf', 'jpg', 'jpeg', 'png', 'webp'],
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] KYC upload error:', { error, folder, fileName, fileType, fileSize, resourceType });
          reject(new Error(`Cloudinary KYC upload failed: ${error.message || JSON.stringify(error)}`));
        } else if (result) {
          console.log('[Cloudinary] KYC upload success:', { publicId: result.public_id, resourceType, folder });
          resolve({
            url: result.public_id,
            publicId: result.public_id,
            resourceType,
            size: fileSize,
          });
        } else {
          reject(new Error('Cloudinary KYC upload returned no result'));
        }
      }
    );

    stream.end(buffer);
  });
}

/**
 * Issue a real short-lived Cloudinary signed download URL for an authenticated
 * (private) asset. The URL is never a permanent public URL.
 */
export function getSignedDocumentDownloadUrl(
  publicId: string,
  options: { resourceType?: 'image' | 'raw'; ttlSeconds?: number } = {}
): { url: string; expiresAt: Date } {
  configureCloudinary();
  const expiresAt = new Date(Date.now() + (options.ttlSeconds ?? 15 * 60) * 1000);

  const url = cloudinary.utils.private_download_url(publicId, '', {
    type: 'authenticated',
    resource_type: options.resourceType ?? 'image',
    expires_at: Math.floor(expiresAt.getTime() / 1000),
  })

  return { url, expiresAt };
}

/**
 * Delete an image from Cloudinary by public ID
 * @param publicId - The public ID of the image to delete
 */
export async function deleteImage(publicId: string, resourceType: 'image' | 'raw' | 'video' = 'image'): Promise<void> {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true }, (error, result) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Generate optimized image URL with transformations
 * @param publicId - The Cloudinary public ID
 * @param options - Transformation options
 * @returns Optimized URL string
 */
export function getOptimizedUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: 'scale' | 'crop' | 'fit' | 'limit' | 'pad';
    quality?: number | 'auto';
    format?: 'auto' | 'jpg' | 'png' | 'webp';
  } = {}
): string {
  configureCloudinary();
  const { width = 800, height = 800, crop = 'limit', quality = 'auto', format = 'auto' } = options;

  return cloudinary.url(publicId, {
    secure: true,
    width,
    height,
    crop,
    quality,
    fetch_format: format,
  });
}

export default cloudinary;
