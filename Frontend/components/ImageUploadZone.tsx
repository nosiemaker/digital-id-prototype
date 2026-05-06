"use client"

import { useRef, useCallback } from "react"
import { Loader2, Upload, Check, X } from "lucide-react"

const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
  console.error('Cloudinary environment variables are not set. Please check your .env file.')
}

export type UploadState = {
  uploading: boolean
  preview:   string | null
  url:       string | null
  error:     string | null
}

export const emptyUpload = (): UploadState => ({
  uploading: false,
  preview: null,
  url: null,
  error: null,
})

export async function handleImageUpload(file: File, folder = "zdid/nrc"): Promise<string> {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary configuration is missing. Please check environment variables.')
  }

  const body = new FormData()
  body.append("file", file)
  body.append("upload_preset", CLOUDINARY_UPLOAD_PRESET)
  body.append("folder", folder)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body }
  )

  if (!res.ok) {
    let errorMessage = "Cloudinary upload failed"
    try {
      const err = await res.json()
      errorMessage = err?.error?.message || errorMessage
    } catch {
      // If response is not JSON, use status text
      errorMessage = `Upload failed with status: ${res.status} ${res.statusText}`
    }
    throw new Error(errorMessage)
  }

  const data = await res.json()
  if (!data.secure_url) {
    throw new Error('Invalid response from Cloudinary: missing secure_url')
  }
  return data.secure_url as string
}

export function ImageUploadZone({
  label,
  hint,
  state,
  onChange,
}: {
  label:    string
  hint:     string
  state:    UploadState
  onChange: (file: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith("image/")) onChange(file)
    },
    [onChange]
  )

  return (
    <div className="flex flex-col gap-2">
      <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>

      <div
        className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors min-h-[160px] group
          ${state.url ? "border-primary/60 bg-primary/5" : "border-border group-hover:border-primary/40 bg-secondary/30 group-hover:bg-secondary/50"}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          disabled={state.uploading}
          className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer disabled:cursor-not-allowed"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onChange(file)
            if (e.target) e.target.value = ''
          }}
        />

        {state.uploading && (
          <div className="flex flex-col items-center gap-2 text-primary">
            <Loader2 className="h-7 w-7 animate-spin" />
            <span className="text-xs font-medium">Uploading…</span>
          </div>
        )}

        {!state.uploading && state.preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={state.preview}
            alt={label}
            className="max-h-28 rounded-lg object-cover shadow"
          />
        )}

        {!state.uploading && !state.preview && (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Upload className="h-7 w-7" />
            <span className="text-sm font-medium">Click or drag to upload</span>
            <span className="text-xs">{hint}</span>
          </div>
        )}

        {state.url && (
          <div className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Check className="h-3 w-3 text-primary-foreground" />
          </div>
        )}
      </div>

      {state.error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <X className="h-3 w-3" /> {state.error}
        </p>
      )}
      {state.url && (
        <p className="text-xs text-primary truncate">✓ Uploaded successfully</p>
      )}
    </div>
  )
}
