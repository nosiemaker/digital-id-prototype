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

      // Show custom choice dialog
      const choice = await new Promise<'camera' | 'gallery' | null>((resolve) => {
        const modal = document.createElement('div')
        modal.innerHTML = `
          <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            font-family: system-ui, -apple-system, sans-serif;
          ">
            <div style="
              background: white;
              border-radius: 12px;
              padding: 24px;
              max-width: 300px;
              width: 90%;
              text-align: center;
            ">
              <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600;">Select Document</h3>
              <button id="camera-btn" style="
                width: 100%;
                padding: 12px;
                margin-bottom: 8px;
                background: #2563eb;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
              ">📷 Take Photo</button>
              <button id="gallery-btn" style="
                width: 100%;
                padding: 12px;
                margin-bottom: 16px;
                background: #16a34a;
                color: white;
                border: none;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
              ">🖼️ Choose from Gallery</button>
              <button id="cancel-btn" style="
                width: 100%;
                padding: 8px;
                background: transparent;
                color: #6b7280;
                border: none;
                font-size: 14px;
                cursor: pointer;
              ">Cancel</button>
            </div>
          </div>
        `
        document.body.appendChild(modal)

        document.getElementById('camera-btn')!.onclick = () => {
          document.body.removeChild(modal)
          resolve('camera')
        }
        document.getElementById('gallery-btn')!.onclick = () => {
          document.body.removeChild(modal)
          resolve('gallery')
        }
        document.getElementById('cancel-btn')!.onclick = () => {
          document.body.removeChild(modal)
          resolve(null)
        }
      })

      if (!choice) return null

      // Use Capacitor Camera plugin for mobile
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: choice === 'camera' ? CameraSource.Camera : CameraSource.Photos
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
