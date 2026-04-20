"use client"

import Link from "next/link"
import { useState } from "react"
import {
  Shield,
  CheckCircle2,
  Download,
  Share2,
  QrCode,
  User,
  LayoutDashboard,
  LogOut,
  Settings,
  Bell,
  Eye,
  History,
  ChevronRight,
} from "lucide-react"

const sidebarLinks = [
  { label: "My ID Wallet", href: "/wallet", icon: LayoutDashboard, active: true },
  { label: "Profile", href: "/wallet", icon: User },
  { label: "Activity Log", href: "/wallet", icon: History },
  { label: "Notifications", href: "/wallet", icon: Bell },
  { label: "Settings", href: "/wallet", icon: Settings },
]

const recentActivity = [
  { action: "ID Verified", location: "Zanaco Bank, Lusaka", time: "2 hours ago", status: "success" },
  { action: "ID Shared", location: "Ministry of Health Portal", time: "Yesterday", status: "success" },
  { action: "Login Attempt", location: "Zamtel Service Centre", time: "3 days ago", status: "success" },
  { action: "ID Downloaded", location: "Self-service", time: "1 week ago", status: "success" },
]

export default function WalletPage() {
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [qrVisible, setQrVisible] = useState(false)

  return (
    <div className="min-h-screen bg-background font-sans flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card shrink-0 sticky top-0 h-screen">
        <div className="flex h-16 items-center gap-2.5 px-5 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-foreground">Zambia</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Digital ID</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {sidebarLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link key={link.label} href={link.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${link.active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{link.label}</span>
                {link.active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">MK</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">Mwamba Kalinda</p>
              <p className="text-xs text-muted-foreground truncate">ZM-2024-001-8872</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4" /><span>Sign Out</span>
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm h-16 flex items-center justify-between px-4 sm:px-6">
          <div>
            <h1 className="text-base font-bold text-foreground">My Digital ID Wallet</h1>
            <p className="text-xs text-muted-foreground">Manage and share your identity</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
          {/* ID Card */}
          <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-16 translate-x-16 pointer-events-none" />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground uppercase tracking-wider">Zambia Digital ID</p>
                  <p className="text-[10px] text-muted-foreground">Republic of Zambia</p>
                </div>
              </div>
              <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> VERIFIED
              </span>
            </div>

            <div className="flex gap-5 mb-6">
              <div className="h-20 w-20 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border">
                <span className="text-3xl font-bold text-primary">MK</span>
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xl font-bold text-foreground">Mwamba Kalinda</p>
                <p className="text-xs text-muted-foreground">NRC: 123456/78/9</p>
                <p className="text-xs text-muted-foreground">DOB: 14 March 1990 · Male</p>
                <p className="text-xs text-muted-foreground">Lusaka Province, Zambia</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-6">
              {[
                { label: "Digital ID", value: "ZM-2024-001-8872" },
                { label: "Issued", value: "23 Mar 2024" },
                { label: "Expires", value: "23 Mar 2034" },
                { label: "Status", value: "Active" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-secondary/60 px-3 py-2">
                  <p className="text-muted-foreground mb-0.5">{item.label}</p>
                  <p className={`font-semibold ${item.label === "Status" ? "text-primary" : "text-foreground"} font-mono`}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* QR Code */}
            {qrVisible && (
              <div className="mb-6 rounded-xl border border-border bg-secondary/40 p-4 flex items-center gap-4">
                <div className="h-24 w-24 rounded-lg bg-background flex items-center justify-center border border-border shrink-0">
                  <div className="grid grid-cols-5 gap-0.5 p-1">
                    {Array.from({ length: 25 }).map((_, i) => (
                      <div key={i} className={`h-3 w-3 rounded-sm ${[0,1,2,5,7,12,17,22,23,24,6,8,10,14,16,18,20].includes(i) ? "bg-foreground" : "bg-transparent"}`} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground mb-1">Verification QR Code</p>
                  <p className="text-xs text-muted-foreground">Valid for 15 minutes. Scan at any Zambia Digital ID partner to verify your identity.</p>
                  <p className="text-xs text-primary mt-1 font-mono">zidp.gov.zm/v/ZM-2024-001-8872</p>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShareModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Share2 className="h-4 w-4" /> Share ID
              </button>
              <button className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
                <Download className="h-4 w-4" /> Download ID
              </button>
              <button
                onClick={() => setQrVisible(!qrVisible)}
                className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                <QrCode className="h-4 w-4" /> {qrVisible ? "Hide QR" : "Show QR"}
              </button>
              <Link href="/verify" className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
                <Eye className="h-4 w-4" /> Verify Identity
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Recent Activity
            </h2>
            <div className="space-y-3">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.action}</p>
                      <p className="text-xs text-muted-foreground">{item.location}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setShareModalOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-foreground mb-1">Share Digital ID</h3>
            <p className="text-sm text-muted-foreground mb-5">Choose how you want to share your digital identity.</p>
            <div className="space-y-3">
              {["Share via Link", "Send via Email", "Generate QR Code", "Share to NFC"].map((opt) => (
                <button key={opt} onClick={() => setShareModalOpen(false)} className="w-full flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary hover:border-primary/30 transition-all text-left">
                  <ChevronRight className="h-4 w-4 text-primary" /> {opt}
                </button>
              ))}
            </div>
            <button onClick={() => setShareModalOpen(false)} className="mt-4 w-full rounded-lg border border-border py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
