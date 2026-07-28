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
 * Delete an image from Cloudinary by public ID
 * @param publicId - The public ID of the image to delete
 */
export async function deleteImage(publicId: string): Promise<void> {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
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
