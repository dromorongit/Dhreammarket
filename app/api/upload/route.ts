import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth-middleware';
import { uploadImage, uploadMultipleImages } from '@/lib/cloudinary';
import { rateLimit } from '@/lib/rate-limit';

// Force Node.js runtime (required for Cloudinary stream operations)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rateLimitCheck = rateLimit('upload')(request)
  if (rateLimitCheck.success !== true) {
    return rateLimitCheck.response
  }

  try {
    // Debug: Log environment variable status (safe - no secrets exposed)
    console.log('[Upload] Route execution started');
    console.log('[Upload] CLOUDINARY_CLOUD_NAME exists:', !!process.env.CLOUDINARY_CLOUD_NAME);
    console.log('[Upload] NODE_ENV:', process.env.NODE_ENV);
    console.log('[Upload] Request method:', request.method);

    // Verify authentication
    const token = request.cookies.get('token')?.value;
    if (!token) {
      console.log('[Upload] No auth token found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'VENDOR') {
      console.log('[Upload] Invalid token or non-vendor role:', payload?.role);
      return NextResponse.json({ error: 'Forbidden: Only vendors can upload images' }, { status: 403 });
    }

    console.log('[Upload] Auth verified for vendor:', payload.userId);

    // Verify vendor is onboarded (has a store)
    // Note: We allow uploads for store logos/banners even before store creation
    // The store creation will use the uploaded URLs
    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    });

    // Allow uploads for store setup (logos/banners) even without existing store
    // This enables vendors to upload images before creating their store

    // Parse multipart form data
    console.log('[Upload] Parsing formData...');
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const folder = formData.get('folder')?.toString() || 'dhream-market';

    // Debug: Log received files
    console.log('[Upload] Received files count:', files.length);
    if (files.length > 0) {
      console.log('[Upload] First file MIME type:', files[0]?.type);
      console.log('[Upload] First file size:', files[0]?.size);
      console.log('[Upload] First file name:', files[0]?.name);
    }
    console.log('[Upload] Target folder:', folder);

    // Validate files
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Validate file count (max 10 at a time)
    if (files.length > 10) {
      return NextResponse.json(
        { error: 'Maximum 10 files allowed per upload' },
        { status: 400 }
      );
    }

    // File upload validation - security hardening
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf']
    const maxFileSize = 10 * 1024 * 1024 // 10MB - security hardening requirement

    for (const file of files) {
      const fileExtension = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : ''

      if (!allowedMimeTypes.includes(file.type) || !allowedExtensions.includes(fileExtension)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only JPG, PNG, WebP, and PDF are allowed.' },
          { status: 400 }
        );
      }

      if (file.size > maxFileSize) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 10MB.' },
          { status: 400 }
        );
      }
    }

    // Determine subfolder based on requested folder type
    let uploadFolder = 'dhream-market';
    if (folder === 'products') {
      uploadFolder = 'dhream-market/products';
    } else if (folder === 'logos') {
      uploadFolder = 'dhream-market/logos';
    } else if (folder === 'banners') {
      uploadFolder = 'dhream-market/banners';
    } else if (folder === 'services') {
      uploadFolder = 'dhream-market/services';
    }

    // Debug: Log upload start
    console.log('[Upload] Starting Cloudinary upload...');

    // Upload files to Cloudinary
    const uploadedImages = await uploadMultipleImages(files, uploadFolder);

    // Debug: Log upload response
    console.log('[Upload] Upload completed, images count:', uploadedImages.length);

    // Extract URLs
    const urls = uploadedImages.map((img: { url: string; publicId: string; secureUrl: string }) => ({
      url: img.url,
      publicId: img.publicId,
      secureUrl: img.secureUrl,
    }));

    return NextResponse.json({
      success: true,
      urls,
      message: `${files.length} image(s) uploaded successfully`,
    });
  } catch (error: any) {
    console.error('[Upload] Error during upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Provide more specific error messages
    let userMessage = 'Failed to upload images. Please try again.';
    if (errorMessage.includes('Cloudinary configuration')) {
      userMessage = 'Image upload service is not configured. Please contact support.';
    } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      userMessage = 'Upload timed out. Please try again with a smaller file.';
    } else if (errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
      userMessage = 'Network error during upload. Please check your connection.';
    }
    
    return NextResponse.json(
      { 
        error: userMessage,
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
