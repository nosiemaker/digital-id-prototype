import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function pickFile(accept: string = 'image/*,application/pdf'): Promise<File | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      console.log('Using Capacitor Camera for file picking')
      // Use Capacitor Camera plugin for mobile
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt, // Allow both camera and gallery with prompt
        promptLabelHeader: 'Select Document',
        promptLabelPhoto: 'Choose from Gallery',
        promptLabelPicture: 'Take Photo'
      })

      console.log('Camera result:', image)

      // Convert data URL to File object
      const response = await fetch(image.dataUrl!)
      const blob = await response.blob()
      const file = new File([blob], `document.${image.format}`, { type: `image/${image.format}` })
      console.log('Created file:', file)
      return file
    } catch (error) {
      console.error('File picker error:', error)
      // Fallback to web file input if Capacitor fails
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = accept
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0] || null
          resolve(file)
        }
        input.click()
      })
    }
  } else {
    console.log('Using web file picker')
    // Web fallback - create a hidden file input
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = accept
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0] || null
        resolve(file)
      }
      input.click()
    })
  }
}
