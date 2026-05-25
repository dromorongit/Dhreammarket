import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth-middleware';
import { uploadImage, uploadMultipleImages } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyToken(token);
    if (!payload || payload.role !== 'VENDOR') {
      return NextResponse.json({ error: 'Forbidden: Only vendors can upload images' }, { status: 403 });
    }

    // Verify vendor is onboarded (has a store)
    // Note: We allow uploads for store logos/banners even before store creation
    // The store creation will use the uploaded URLs
    const store = await getPrisma().store.findUnique({
      where: { userId: payload.userId },
    });

    // Allow uploads for store setup (logos/banners) even without existing store
    // This enables vendors to upload images before creating their store

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const folder = formData.get('folder')?.toString() || 'dhream-market';

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

    // Validate each file
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxFileSize = 5 * 1024 * 1024; // 5MB

    for (const file of files) {
      if (!allowedMimeTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.name}. Only JPG, PNG, and WebP are allowed.` },
          { status: 400 }
        );
      }

      if (file.size > maxFileSize) {
        return NextResponse.json(
          { error: `File too large: ${file.name}. Maximum size is 5MB.` },
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
    }

    // Upload files to Cloudinary
    const uploadedImages = await uploadMultipleImages(files, uploadFolder);

    // Extract URLs
    const urls = uploadedImages.map((img) => ({
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
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      { 
        error: 'Failed to upload images. Please try again.',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
