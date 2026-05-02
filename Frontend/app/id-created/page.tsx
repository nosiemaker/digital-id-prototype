"use client"

import Link from "next/link"
import { Shield, CheckCircle2, ArrowRight, Download, QrCode } from "lucide-react"

export default function IDCreatedPage() {
  return (
    <div className="min-h-screen bg-background font-sans flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg text-center">
        {/* Success icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 border-2 border-primary shadow-lg shadow-primary/20">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>

        <h1 className="text-3xl font-bold text-foreground text-balance">Digital ID Created!</h1>
        <p className="mt-3 text-muted-foreground leading-relaxed">
          Your Zambia Digital ID has been successfully generated and is now active. Your identity is secure and verified.
        </p>

        {/* Digital ID card */}
        <div className="mt-8 rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl text-left relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-8 translate-x-8 pointer-events-none" />

          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground uppercase tracking-wider">Zambia Digital ID</p>
                <p className="text-[10px] text-muted-foreground">Republic of Zambia</p>
              </div>
            </div>
            <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">ACTIVE</span>
          </div>

          <div className="flex gap-5 mb-5">
            <div className="h-20 w-20 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border">
              <span className="text-3xl font-bold text-primary">MK</span>
            </div>
            <div className="flex-1 space-y-1.5">
              <p className="text-lg font-bold text-foreground">Mwamba Kalinda</p>
              <p className="text-xs text-muted-foreground">NRC: 123456/78/9</p>
              <p className="text-xs text-muted-foreground">DOB: 14 March 1990 · Male</p>
              <p className="text-xs text-muted-foreground">Province: Lusaka</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5 text-xs">
            <div className="rounded-lg bg-secondary/60 px-3 py-2">
              <p className="text-muted-foreground mb-0.5">Digital ID</p>
              <p className="font-mono font-semibold text-foreground">ZM-2024-001-8872</p>
            </div>
            <div className="rounded-lg bg-secondary/60 px-3 py-2">
              <p className="text-muted-foreground mb-0.5">Issued</p>
              <p className="font-semibold text-foreground">23 March 2024</p>
            </div>
            <div className="rounded-lg bg-secondary/60 px-3 py-2">
              <p className="text-muted-foreground mb-0.5">Expires</p>
              <p className="font-semibold text-foreground">23 March 2034</p>
            </div>
            <div className="rounded-lg bg-secondary/60 px-3 py-2">
              <p className="text-muted-foreground mb-0.5">Status</p>
              <p className="font-semibold text-primary">Verified</p>
            </div>
          </div>

          {/* QR code placeholder */}
          <div className="flex items-center gap-4 rounded-xl border border-border bg-secondary/40 p-3">
            <div className="h-16 w-16 rounded-lg bg-background flex items-center justify-center shrink-0 border border-border">
              <div className="grid grid-cols-4 gap-0.5">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className={`h-2.5 w-2.5 rounded-sm ${[0, 2, 5, 7, 8, 10, 13, 15].includes(i) ? "bg-foreground" : "bg-transparent"}`} />
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <QrCode className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Verification QR Code</span>
              </div>
              <p className="text-xs text-muted-foreground">Scan to instantly verify this identity at any partner agency.</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <Link
            href="/citizens/wallet"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
          >
            View My Digital ID <ArrowRight className="h-4 w-4" />
          </Link>
          <button className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
            <Download className="h-4 w-4" /> Download ID
          </button>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          A confirmation has been sent to your registered email address.{" "}
          <Link href="/" className="text-primary hover:underline">Return to Home</Link>
        </p>
      </div>
    </div>
  )
}
