import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload an image file to Cloudinary
 * @param file - The file to upload (from FormData)
 * @param folder - The Cloudinary folder to upload to
 * @returns Promise<{url: string, publicId: string, secureUrl: string}>
 */
export async function uploadImage(
  file: File,
  folder: string = 'dhream-market'
): Promise<{ url: string; publicId: string; secureUrl: string }> {
  return new Promise((resolve, reject) => {
    // Convert File to Buffer
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const buffer = Buffer.from(e.target?.result as ArrayBuffer);
      
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
            reject(error);
          } else if (result) {
            resolve({
              url: result.url,
              publicId: result.public_id,
              secureUrl: result.secure_url,
            });
          }
        }
      );

      stream.end(buffer);
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsArrayBuffer(file);
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
  const { width = 800, height = 800, crop = 'limit', quality = 'auto', format = 'auto' } = options;

  return cloudinary.url(publicId, {
    width,
    height,
    crop,
    quality,
    fetch_format: format,
  });
}

export default cloudinary;
