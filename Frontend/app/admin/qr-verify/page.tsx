"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { QrCode, ArrowLeft } from "lucide-react"
import { ScanIDModal } from "@/components/ScanIDModal"

export default function AdminQRVerifyPage() {
  const router = useRouter()
  const [open, setOpen] = useState(true)

  useEffect(() => {
    setOpen(true)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="p-6 sm:p-8">
        <div className="flex flex-col gap-3 max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">QR Verify</h1>
              <p className="text-sm text-muted-foreground">Scan a citizen&apos;s ZDID QR code to verify their information.</p>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5">
            <p className="text-sm text-foreground mb-4">The scanner will open immediately. Close it to return to the dashboard.</p>
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <QrCode className="h-4 w-4" />
              Open Scanner
            </button>
          </div>

          <button
            onClick={() => router.push("/admin/dashboard")}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </button>
        </div>
      </div>

      <ScanIDModal open={open} onClose={() => router.push("/admin/dashboard")} />
    </div>
  )
}
