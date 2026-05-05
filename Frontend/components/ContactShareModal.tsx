"use client"

/**
 * ContactShareModal
 *
 * A modal for sharing contact details via QR code.
 * Generates a QR code with contact information that can be scanned by others.
 */

import { useState, useEffect } from "react"
import {
  X,
  QrCode,
  User,
  Copy,
  Check,
} from "lucide-react"
import QRCode from "qrcode"

interface ContactShareModalProps {
  open: boolean
  onClose: () => void
  me: any
}

export function ContactShareModal({
  open,
  onClose,
  me,
}: ContactShareModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open && me) {
      const contactData = {
        type: "contact",
        name: me.name,
        din: me.citizen_din,
        email: me.email,
        phone: me.phone,
        // Add more fields if available
      }
      const jsonString = JSON.stringify(contactData)
      QRCode.toDataURL(jsonString, {
        width: 256,
        margin: 2,
        color: {
          dark: '#0F1110',
          light: '#FFFFFF'
        }
      }).then(setQrDataUrl)
    }
  }, [open, me])

  const copyContactDetails = () => {
    const details = `Name: ${me?.name || "N/A"}\nDIN: ${me?.citizen_din || "N/A"}\nEmail: ${me?.email || "N/A"}\nPhone: ${me?.phone || "N/A"}`
    navigator.clipboard.writeText(details)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Share Contact Details</h2>
                <p className="text-xs text-muted-foreground">Let others scan your contact QR</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 space-y-4">
            {/* QR Code */}
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="relative">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Contact QR Code"
                    className="w-48 h-48 rounded-xl border border-border shadow-lg"
                  />
                ) : (
                  <div className="w-48 h-48 rounded-xl border border-border bg-secondary/50 flex items-center justify-center">
                    <QrCode className="h-12 w-12 text-muted-foreground animate-pulse" />
                  </div>
                )}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Scan this QR code to share your contact details
              </p>
            </div>

            {/* Copy Details */}
            <button
              onClick={copyContactDetails}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary border border-border py-3 text-sm font-bold text-foreground hover:bg-secondary/80 transition-colors"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy Contact Details"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}