'use client';

import Image from 'next/image';
import { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/Card';
import { Button } from '@/components/Button';

interface ImageUploadProps {
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: 'products' | 'logos' | 'banners' | 'verification';
  maxFiles?: number;
  maxSizeMB?: number;
  label?: string;
  hint?: string;
}

export default function ImageUpload({
  value = [],
  onChange,
  folder = 'products',
  maxFiles = 10,
  maxSizeMB = 5,
  label = 'Images',
  hint,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files) return;

      setError(null);
      const fileArray = Array.from(files);

      // Validate file count
      if (value.length + fileArray.length > maxFiles) {
        setError(`Maximum ${maxFiles} images allowed`);
        return;
      }

      // Validate each file
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const maxSize = maxSizeMB * 1024 * 1024;

      for (const file of fileArray) {
        if (!allowedTypes.includes(file.type)) {
          setError(`Invalid file type: ${file.name}. Only JPG, PNG, and WebP allowed.`);
          return;
        }
        if (file.size > maxSize) {
          setError(`File too large: ${file.name}. Maximum size is ${maxSizeMB}MB.`);
          return;
        }
      }

      setUploading(true);
      setUploadProgress(Array(value.length + fileArray.length).fill(0));

      try {
        const formData = new FormData();
        fileArray.forEach((file) => {
          formData.append('files', file);
        });
        formData.append('folder', folder);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Upload failed');
        }

        // Add new URLs to existing ones
        const newUrls = data.urls.map((item: { url: string }) => item.url);
        onChange([...value, ...newUrls]);
      } catch (err: any) {
        console.error('Upload error:', err);
        setError(err.message || 'Failed to upload images');
      } finally {
        setUploading(false);
        setUploadProgress([]);
      }
    },
    [value, onChange, folder, maxFiles, maxSizeMB]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset input value so same file can be selected again
      if (e.target.value) e.target.value = '';
    },
    [handleFiles]
  );

  const removeImage = useCallback(
    (index: number) => {
      const newUrls = value.filter((_, i) => i !== index);
      onChange(newUrls);
    },
    [value, onChange]
  );

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      )}

      {/* Upload Area */}
      <div
        onClick={handleButtonClick}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${uploading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          onChange={handleInputChange}
          className="hidden"
          disabled={uploading}
        />

        <div className="space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-600">
              <span className="font-medium text-blue-600 hover:text-blue-500">
                Click to upload
              </span>{' '}
              or drag and drop
            </p>
            <p className="text-xs text-gray-500 mt-1">
              JPG, PNG, or WebP up to {maxSizeMB}MB each
            </p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">Uploading...</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Hint */}
      {hint && !error && (
        <p className="text-sm text-gray-500">{hint}</p>
      )}

      {/* Image Previews */}
      {value.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {value.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200"
            >
              <Image
                src={url}
                alt={`Preview ${index + 1}`}
                className="object-cover"
                fill
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200" />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeImage(index);
                }}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                title="Remove image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {index === 0 && (
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black bg-opacity-60 text-white text-xs rounded">
                  Main
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add More Button */}
      {value.length > 0 && value.length < maxFiles && !uploading && (
        <Button
          type="button"
          variant="outline"
          onClick={handleButtonClick}
          className="w-full"
        >
          + Add Another Image
        </Button>
      )}
    </div>
  );
}
