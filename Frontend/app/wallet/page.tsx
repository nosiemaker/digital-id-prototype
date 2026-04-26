"use client"

/**
 * /wallet — Citizen wallet page
 *
 * On mount:
 *  1. Calls GET /auth/me to get the full session (citizen_din, citizen_status,
 *     is_email_verified).
 *  2. Passes enrollmentState to <EnrollmentBanner /> which decides whether
 *     to show the "complete registration" CTA or the "under review" notice.
 *
 * Banner trigger rules (derived in useMe):
 *   NOT_STARTED  →  citizen_din is null  →  amber banner with CTA
 *   PENDING      →  citizen_status=PENDING  →  blue info banner
 *   ACTIVE       →  no banner, full wallet UI
 */

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { authApi, tokenStore } from "@/lib/axios"

import {
  Shield,
  CheckCircle2,
  Download,
  Share2,
  QrCode,
  User,
  Users,
  LayoutDashboard,
  LogOut,
  Settings,
  Bell,
  Eye,
  History,
  ChevronRight,
  Globe,
  Moon,
  Smartphone,
  Clock,
  Loader2,
  UserCircle,
  CreditCard,
} from "lucide-react"
import { useMe } from "@/hooks/useMe"
import { EnrollmentBanner } from "@/components/enrollment/enrollmentBanner"

const sidebarLinks = [
  { id: "wallet", label: "My ID Wallet", icon: LayoutDashboard },
  { id: "profile", label: "Profile", icon: User },
  { id: "family", label: "Family Tree", icon: Users },
  { id: "activity", label: "Activity Log", icon: History },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "settings", label: "Settings", icon: Settings },
]

const recentActivity = [
  { action: "ID Verified", location: "Zanaco Bank, Lusaka", time: "2 hours ago", status: "success", type: "verify" },
  { action: "ID Shared", location: "Ministry of Health Portal", time: "Yesterday", status: "success", type: "share" },
  { action: "Login Attempt", location: "Zamtel Service Centre", time: "3 days ago", status: "success", type: "login" },
  { action: "ID Downloaded", location: "Self-service", time: "1 week ago", status: "success", type: "download" },
  { action: "Connection Added", location: "Family Portal", time: "2 weeks ago", status: "success", type: "family" },
  { action: "Address Updated", location: "Ministry of Home Affairs", time: "1 month ago", status: "success", type: "profile" },
]

const notifications = [
  { id: 1, title: "Identity Verified", message: "Your Digital ID was successfully verified at Zanaco Bank.", time: "2 hours ago", unread: true },
  { id: 2, title: "New Family Connection", message: "Mutale Kalinda has been added to your family tree.", time: "2 days ago", unread: false },
  { id: 3, title: "System Update", message: "A new version of the Digital ID Wallet is available.", time: "1 week ago", unread: false },
  { id: 4, title: "Security Alert", message: "New login detected from a Chrome browser on Windows.", time: "2 weeks ago", unread: false },
]

const familyMembers = [
  { relation: "Spouse", name: "Chanda Kalinda", din: "ZM-2024-002-1142", status: "Verified" },
  { relation: "Son", name: "Mutale Kalinda", din: "ZM-2024-002-8871", status: "Verified" },
  { relation: "Daughter", name: "Lombe Kalinda", din: "ZM-2024-002-8873", status: "Verified" },
  { relation: "Father", name: "John Kalinda", din: "ZM-2020-001-4412", status: "Verified" },
  { relation: "Mother", name: "Mary Kalinda", din: "ZM-2020-001-4413", status: "Verified" },
]

function getPageTitle(tab: string) {
  switch (tab) {
    case "wallet": return "My Digital ID Wallet"
    case "profile": return "My Profile"
    case "family": return "My Family Tree"
    case "activity": return "Activity Log"
    case "notifications": return "Notifications"
    case "settings": return "Settings"
    default: return "Digital ID Wallet"
  }
}

function getPageSubtitle(tab: string) {
  switch (tab) {
    case "wallet": return "Manage and share your identity"
    case "profile": return "View and manage your personal details"
    case "family": return "View your verified family connections"
    case "activity": return "A history of your identity usage"
    case "notifications": return "Stay updated on your ID status"
    case "settings": return "Manage your preferences and security"
    default: return ""
  }
}

export default function WalletPage() {
  const router = useRouter()
  const { me, enrollmentState, loading, error } = useMe()
  const [activeTab, setActiveTab] = useState("wallet")
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [qrVisible, setQrVisible] = useState(false)

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      await authApi.logout()
      router.push("/login")
    } catch (err) {
      tokenStore.clear()
      router.push("/login")
    }
  }

  // Redirect unauthenticated users
  useEffect(() => {
    if (!tokenStore.getAccess()) {
      router.replace("/login")
    }
  }, [])

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
            const isActive = activeTab === link.id
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{link.label}</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
              </button>
            )
          })}
        </nav>
        <div className="border-t border-border p-3">
          {me && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
                {me.name?.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{me.name}</p>
                <p className="text-xs text-muted-foreground truncate">{me.citizen_din || 'Not issued'}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => { tokenStore.clear(); router.replace("/login") }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors w-full"
          >
            <LogOut className="h-4 w-4" /><span>Sign Out</span>
          </button>
        </div>

      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {/* Top bar */}
        <div className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm h-16 flex items-center justify-between px-4 sm:px-6">
          <div>
            <h1 className="text-base font-bold text-foreground">{getPageTitle(activeTab)}</h1>
            <p className="text-xs text-muted-foreground">{getPageSubtitle(activeTab)}</p>
          </div>
          <div className="flex items-center gap-2">
            {me && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                <UserCircle className="h-4 w-4" />
                <span>{me.name}</span>
              </div>
            )}
            <button 
              onClick={() => setActiveTab("notifications")}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors relative"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
          {/* Loading skeleton */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && me && (
            <>
              {/* Enrollment banner */}
              <EnrollmentBanner state={enrollmentState} />

              {activeTab === "wallet" && (
                <>
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
                      {enrollmentState === "ACTIVE" && (
                        <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> VERIFIED
                        </span>
                      )}
                    </div>

                    <div className="flex gap-5 mb-6">
                      <div className="h-20 w-20 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border overflow-hidden">
                        <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary">
                          <User className="h-10 w-10" />
                        </div>
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-xl font-bold text-foreground">{me.name}</p>
                        <p className="text-xs text-muted-foreground">{me.email}</p>
                        {enrollmentState === "ACTIVE" && (
                          <>
                            <p className="text-xs text-muted-foreground">Status: Active</p>
                            <p className="text-xs text-muted-foreground">Zambia</p>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-6">
                      {[
                        { label: "Digital ID", value: me.citizen_din || "Not issued" },
                        { label: "Status", value: enrollmentState === "ACTIVE" ? "Active" : enrollmentState },
                        { label: "Email", value: me.is_email_verified ? "Verified" : "Not verified" },
                        { label: "Role", value: me.role },
                      ].map((item) => (
                        <div key={item.label} className="rounded-lg bg-secondary/60 px-3 py-2">
                          <p className="text-muted-foreground mb-0.5">{item.label}</p>
                          <p className={`font-semibold ${item.label === "Status" ? "text-primary" : "text-foreground"} font-mono`}>{item.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* QR Code */}
                    {qrVisible && enrollmentState === "ACTIVE" && (
                      <div className="mb-6 rounded-xl border border-border bg-secondary/40 p-4 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
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
                          <p className="text-xs text-primary mt-1 font-mono">{me.citizen_din ? `zidp.gov.zm/v/${me.citizen_din}` : 'Not available'}</p>
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => setShareModalOpen(true)}
                        disabled={enrollmentState !== "ACTIVE"}
                        className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Share2 className="h-4 w-4" /> Share ID
                      </button>
                      <button 
                        disabled={enrollmentState !== "ACTIVE"}
                        className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Download className="h-4 w-4" /> Download ID
                      </button>
                      <button
                        onClick={() => setQrVisible(!qrVisible)}
                        disabled={enrollmentState !== "ACTIVE"}
                        className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <QrCode className="h-4 w-4" /> {qrVisible ? "Hide QR" : "Show QR"}
                      </button>
                    </div>
                  </div>

                  {/* Recent Activity */}
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" /> Recent Activity
                    </h2>
                    <div className="space-y-3">
                      {recentActivity.slice(0, 4).map((item, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-3 hover:bg-secondary/60 transition-colors cursor-default">
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
                      <button 
                        onClick={() => setActiveTab("activity")}
                        className="w-full py-2 text-xs font-semibold text-primary hover:underline mt-2"
                      >
                        View All Activity
                      </button>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "profile" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Profile Header */}
                  <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="h-32 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
                    <div className="px-6 pb-6">
                      <div className="relative -mt-12 mb-4">
                        <div className="h-24 w-24 rounded-2xl bg-card border-4 border-card shadow-lg flex items-center justify-center overflow-hidden">
                          <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary">
                            <User className="h-12 w-12" />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div>
                          <h2 className="text-2xl font-bold text-foreground">{me.name}</h2>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <CheckCircle2 className="h-4 w-4 text-primary" /> {enrollmentState === "ACTIVE" ? "Verified Citizen" : "Enrollment Pending"}
                          </p>
                        </div>
                        <button className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors">
                          Edit Profile
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Profile Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                      {/* Personal Information */}
                      <div className="rounded-2xl border border-border bg-card p-6">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" /> Personal Information
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                          {[
                            { label: "Name", value: me.name },
                            { label: "Email", value: me.email },
                            { label: "User ID", value: me.user_id },
                            { label: "Role", value: me.role },
                          ].map((field) => (
                            <div key={field.label} className="space-y-1">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">{field.label}</p>
                              <p className="text-sm font-medium text-foreground">{field.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Contact Information */}
                      <div className="rounded-2xl border border-border bg-card p-6">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
                          <Bell className="h-4 w-4 text-primary" /> Contact & Status
                        </h3>
                        <div className="space-y-6">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Email Address</p>
                            <p className="text-sm font-medium text-foreground">{me.email}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Email Status</p>
                            <p className="text-sm font-medium text-foreground">{me.is_email_verified ? "Verified" : "Not verified"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {/* Status Card */}
                      <div className="rounded-2xl border border-border bg-card p-6">
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Enrollment Status</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between py-2 border-b border-border/50">
                            <span className="text-xs text-muted-foreground">Current Status</span>
                            <span className="text-xs font-bold text-primary flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> {enrollmentState}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2 border-b border-border/50">
                            <span className="text-xs text-muted-foreground">Email Verified</span>
                            <span className={`text-xs font-bold flex items-center gap-1 ${me.is_email_verified ? "text-primary" : "text-amber-400"}`}>
                              <CheckCircle2 className="h-3 w-3" /> {me.is_email_verified ? "Yes" : "No"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between py-2">
                            <span className="text-xs text-muted-foreground">DIN Issued</span>
                            <span className={`text-xs font-bold flex items-center gap-1 ${me.citizen_din ? "text-primary" : "text-amber-400"}`}>
                              <CheckCircle2 className="h-3 w-3" /> {me.citizen_din ? "Yes" : "No"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "family" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" /> Verified Family Tree
                    </h2>
                    
                    <div className="mb-10 p-8 rounded-3xl bg-secondary/20 border border-border flex flex-col items-center">
                      <p className="text-sm text-muted-foreground">Family tree integration coming soon</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {familyMembers.map((member) => (
                        <div key={member.din} className="flex items-center justify-between p-4 rounded-xl border border-border bg-secondary/30 hover:border-primary/40 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center font-bold text-primary">
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">{member.name}</p>
                              <p className="text-[10px] text-muted-foreground">{member.relation} · {member.din}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                            {member.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "activity" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-xl font-bold text-foreground mb-6">Full Activity Log</h2>
                    <div className="space-y-4">
                      {recentActivity.map((item, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-secondary/20">
                          <div className="mt-1 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <History className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-bold text-foreground">{item.action}</p>
                              <span className="text-[10px] font-medium text-muted-foreground">{item.time}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{item.location}</p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[10px] font-bold text-primary uppercase tracking-tight">Status: {item.status}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-foreground">Notifications</h2>
                      <button className="text-xs font-bold text-primary hover:underline">Mark all as read</button>
                    </div>
                    <div className="space-y-3">
                      {notifications.map((notif) => (
                        <div key={notif.id} className={`p-4 rounded-xl border border-border ${notif.unread ? 'bg-primary/5 border-primary/20' : 'bg-secondary/20'} relative overflow-hidden transition-all hover:bg-secondary/30`}>
                          {notif.unread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className={`text-sm font-bold ${notif.unread ? 'text-primary' : 'text-foreground'} mb-1`}>{notif.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                              <p className="text-[10px] text-muted-foreground mt-2 font-medium">{notif.time}</p>
                            </div>
                            {notif.unread && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "settings" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Account Settings */}
                    <div className="rounded-2xl border border-border bg-card p-6">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" /> Account Preferences
                      </h3>
                      <div className="space-y-4">
                        {[
                          { label: "Language", value: "English (UK)", icon: Globe },
                          { label: "Theme", value: "System Default", icon: Moon },
                          { label: "Linked Devices", value: "1 Device", icon: Smartphone },
                        ].map((setting) => (
                          <button key={setting.label} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors text-left group">
                            <div className="flex items-center gap-3">
                              <setting.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              <div>
                                <p className="text-xs font-bold text-foreground">{setting.label}</p>
                                <p className="text-[10px] text-muted-foreground">{setting.value}</p>
                              </div>
                            </div>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Security Settings */}
                    <div className="rounded-2xl border border-border bg-card p-6">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" /> Security & Privacy
                      </h3>
                      <div className="space-y-4">
                        {[
                          { label: "Two-Factor Auth", value: "Available", icon: Smartphone },
                          { label: "Change Password", value: "Secure account", icon: Settings },
                          { label: "Privacy Mode", value: "Standard", icon: Eye },
                        ].map((setting) => (
                          <button key={setting.label} className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors text-left group">
                            <div className="flex items-center gap-3">
                              <setting.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                              <div>
                                <p className="text-xs font-bold text-foreground">{setting.label}</p>
                                <p className="text-[10px] text-muted-foreground">{setting.value}</p>
                              </div>
                            </div>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notification Settings */}
                    <div className="rounded-2xl border border-border bg-card p-6 md:col-span-2">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5 flex items-center gap-2">
                        <Bell className="h-4 w-4 text-primary" /> Notification Settings
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { label: "Email Notifications", desc: "Receive updates about your ID via email." },
                          { label: "Push Notifications", desc: "Get real-time alerts on your smartphone." },
                          { label: "SMS Alerts", desc: "Critical security alerts via text message." },
                          { label: "Newsletter", desc: "Receive monthly updates from Digital ID Zambia." },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/10">
                            <div className="flex-1 pr-4">
                              <p className="text-xs font-bold text-foreground">{item.label}</p>
                              <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                            </div>
                            <div className="h-5 w-9 rounded-full bg-primary/20 relative flex items-center px-1 cursor-pointer">
                              <div className="h-3 w-3 rounded-full bg-primary" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setShareModalOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
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
