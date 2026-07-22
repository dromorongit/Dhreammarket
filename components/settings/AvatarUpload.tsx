'use client'

import { useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import { Button } from '@/components/Button'

interface AvatarUploadProps {
  avatarUrl?: string | null
  onUpload?: (url: string) => void
  onRemove?: () => void
  size?: number
}

export default function AvatarUpload({ avatarUrl, onUpload, onRemove, size = 120 }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFile = useCallback(
    async (files: FileList | null) => {
      if (!files || !files[0]) return
      setUploading(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('file', files[0])

        const response = await fetch('/api/account/avatar', {
          method: 'POST',
          body: formData,
        })

        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Upload failed')
        }

        onUpload?.(data.profile.avatar)
      } catch (err: any) {
        setError(err.message || 'Failed to upload avatar')
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [onUpload]
  )

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative rounded-full overflow-hidden border-2 border-slate-200 bg-slate-100" style={{ width: size, height: size }}>
        {avatarUrl ? (
          <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={(e) => handleFile(e.target.files)}
        className="hidden"
        disabled={uploading}
      />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? 'Uploading...' : avatarUrl ? 'Change Avatar' : 'Upload Avatar'}
        </Button>
        {avatarUrl && onRemove && (
          <Button variant="ghost" size="sm" onClick={onRemove}>Remove</Button>
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  )
}
