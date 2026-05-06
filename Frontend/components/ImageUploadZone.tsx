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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex flex-col">
          <label className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {label}
          </label>
          <span className="text-[10px] text-muted-foreground mt-0.5">{hint}</span>
        </div>
        {state.url && <Check className="h-4 w-4 text-primary shrink-0" />}
      </div>

      {state.preview && (
        <div className="relative rounded-xl overflow-hidden border border-border bg-secondary/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.preview}
            alt={label}
            className="w-full max-h-40 object-cover"
          />
          {state.uploading && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-primary">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <span className="text-xs font-medium">Uploading...</span>
            </div>
          )}
        </div>
      )}

      {!state.preview && state.uploading && (
        <div className="flex items-center justify-center p-6 border border-border rounded-xl bg-secondary/30">
          <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
          <span className="text-xs text-muted-foreground">Uploading...</span>
        </div>
      )}

      <label className={`relative flex items-center justify-center w-full gap-2 rounded-xl border py-3 text-sm font-bold transition-colors cursor-pointer ${
        state.uploading 
          ? "bg-secondary/50 border-border text-muted-foreground cursor-not-allowed" 
          : "bg-secondary border-border text-foreground hover:bg-secondary/80"
      }`}>
        <Upload className="h-4 w-4" />
        {state.preview ? "Change Image" : "Attach Image"}
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
      </label>

      {state.error && (
        <p className="text-xs text-destructive flex items-center gap-1.5 mt-1 bg-destructive/10 p-2 rounded-lg border border-destructive/20">
          <X className="h-3.5 w-3.5 shrink-0" /> {state.error}
        </p>
      )}
    </div>
  )
}
