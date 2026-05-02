"use client"

/**
 * /wallet — Citizen wallet page with integrated Digital ID Card
 *
 * Backend integration:
 *  - GET /digital-id/{din}          → Fetches signed ID payload
 *  - GET /digital-id/server-public-key → Caches verifier key
 *  - POST /qr/{din}/generate        → Generates signed QR payload
 */

import { useRouter } from "next/navigation"
import Link from "next/link"

import { useState, useEffect, useCallback } from "react"
import { tokenStore, digitalIdApi, qrApi, authApi, auditApi, thirdPartyApi, type AuditLog, type DigitalIDPayload as ApiDigitalIDPayload, type QRPayload as ApiQRPayload, type ServerPublicKeyResponse } from "@/lib/axios"


import {
  Shield,
  CheckCircle2,
  QrCode as QrCodeIcon,
  User,
  Users,
  LayoutDashboard,
  LogOut,
  Settings,
  Bell,
  Eye,
  History,
  ChevronRight,
  FileText,
  Link2,
  Globe,
  Moon,
  Smartphone,
  Loader2,
  UserCircle,
  Crown,
  Building2,
  ArrowRight,
  Share2,
  ScanLine,
} from "lucide-react"
import { Logo } from "@/components/Logo"

import { useMe } from "@/hooks/useMe"
import { EnrollmentBanner } from "@/components/enrollment/enrollmentBanner"
import DigitalIDCard from "@/components/DigitalIDCard"
import { ShareIDModal } from "@/components/ShareIDModal"
import { ScanIDModal } from "@/components/ScanIDModal"
import { EditProfileModal } from "@/components/EditProfileModal"


interface QRPayload extends ApiQRPayload {}
interface ServerPublicKey extends ServerPublicKeyResponse {}

/* ------------------------------------------------------------------ */
// Sidebar & mock data (preserved from original)
/* ------------------------------------------------------------------ */

const sidebarLinks = [
  { id: "wallet", label: "My ID Wallet", icon: LayoutDashboard },
  { id: "profile", label: "Profile", icon: User },
  { id: "family", label: "Family Tree", icon: Users },
  { id: "activity", label: "Activity Log", icon: History },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "partners", label: "Partners", icon: Link2 },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "notice-of-death", label: "Submit Notice of Death", icon: FileText, href: "/citizens/notice-of-death" },
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
    case "partners": return "Official Partners"
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
    case "partners": return "Connect with verified services and institutions"
    case "settings": return "Manage your preferences and security"
    default: return ""
  }
}
/* ------------------------------------------------------------------ */
// Main Page
/* ------------------------------------------------------------------ */

export default function WalletPage() {
  const router = useRouter()
  const { me, enrollmentState, loading: meLoading, error: meError } = useMe()
  const [activeTab, setActiveTab] = useState("wallet")
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const [editProfileModalOpen, setEditProfileModalOpen] = useState(false)
  
  // Backend integration state
  const [digitalID, setDigitalID] = useState<ApiDigitalIDPayload | null>(null)
  const [digitalIDLoading, setDigitalIDLoading] = useState(false)
  const [digitalIDError, setDigitalIDError] = useState<string | null>(null)
  
  const [qrPayload, setQrPayload] = useState<QRPayload | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  
  const [cardFlipped, setCardFlipped] = useState(false)
  const [serverPublicKey, setServerPublicKey] = useState<ServerPublicKey | null>(null)

  const [activeInstitutions, setActiveInstitutions] = useState<any[]>([])
  const [institutionsLoading, setInstitutionsLoading] = useState(false)

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsTotal, setLogsTotal] = useState(0)


  /* -------------------- Helper Functions -------------------- */

  // Helper function to calculate age from date of birth
  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  // Determine citizen type based on age
  const getCitizenType = (dob: string, citizenType?: string): string => {
    if (citizenType) return citizenType
    
    const age = calculateAge(dob)
    if (age < 16) return "CHILD_UNDER_16"
    if (age < 18) return "CHILD_ABOVE_16"
    if (age < 65) return "ADULT"
    return "SENIOR"
  }

  // Format citizen type for display
  const formatCitizenType = (type: string): string => {
    switch (type) {
      case "CHILD_UNDER_16": return "Child (Under 16)"
      case "CHILD_ABOVE_16": return "Child (16-17)"
      case "ADULT": return "Adult"
      case "SENIOR": return "Senior Citizen"
      default: return type
    }
  }

  const formatAction = (action: string) => {
    return action.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(" ");
  }

  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  }


  /* -------------------- API Calls (via axios.ts) -------------------- */

  const fetchCitizenData = useCallback(async (din: string) => {
    setDigitalIDLoading(true)
    setDigitalIDError(null)
    try {
     const response = await digitalIdApi.get(din)
      setDigitalID(response.payload)
      localStorage.setItem("zdid_server_public_key", response.server_public_key);
    } catch (err: any) {
      setDigitalIDError(err?.detail || "Failed to fetch citizen data")
    } finally {
      setDigitalIDLoading(false)
    }
  }, [])

  const fetchServerPublicKey = useCallback(async () => {
    try {
      const response = await digitalIdApi.getServerPublicKey()
      setServerPublicKey(response)
    } catch {
      // Non-critical; verifiers can still work
    }
  }, [])

  const generateQR = useCallback(async (din: string) => {
    setQrLoading(true)
    try {
      const response = await qrApi.generate(din)
      setQrPayload(response)
      // Auto-flip to back to show QR
      setCardFlipped(true)
    } catch (err: any) {
      const detail = err?.detail || "Failed to generate QR"
      alert(detail)
    } finally {
      setQrLoading(false)
    }
  }, [])

  const fetchActiveInstitutions = useCallback(async () => {
    setInstitutionsLoading(true)
    try {
      const data = await thirdPartyApi.getActive()
      // API returns either an array directly or wrapped in a key
      const list = Array.isArray(data) ? data : (data as any)?.results ?? (data as any)?.institutions ?? []
      setActiveInstitutions(list)
    } catch (err: any) {
      console.error("Failed to fetch active institutions", {
        message: err.message,
        detail: err.detail,
        status: err.status,
      })
      setActiveInstitutions([])
    } finally {
      setInstitutionsLoading(false)
    }
  }, [])


  const fetchLogs = useCallback(async (page = 1) => {
    setLogsLoading(true)
    try {
      const data = await auditApi.getMyLogs(page)
      setLogs(data.results)
      setLogsTotal(data.total)
    } catch (err: any) {
      console.error("Failed to fetch logs", {
        message: err?.message,
        detail: err?.detail,
        status: err?.status,
        error: err
      })
    } finally {
      setLogsLoading(false)
    }

  }, [])


  /* -------------------- Effects -------------------- */

  // Redirect unauthenticated
  useEffect(() => {
    if (!tokenStore.getAccess()) {
      router.replace("/login")
    }
  }, [router])

  // Fetch citizen data when user is active
  useEffect(() => {
    if (enrollmentState === "ACTIVE" && me?.citizen_din) {
      fetchCitizenData(me.citizen_din)
      fetchServerPublicKey()
    }
  }, [enrollmentState, me, fetchCitizenData, fetchServerPublicKey])

  useEffect(() => {
    if (activeTab === "partners") {
      fetchActiveInstitutions()
    }
    if (activeTab === "activity" || activeTab === "wallet") {
      fetchLogs()
    }
  }, [activeTab, fetchActiveInstitutions, fetchLogs])


  /* -------------------- Handlers -------------------- */

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      await authApi.logout()
      router.replace("/login")
    } catch {
      tokenStore.clear()
      router.replace("/login")
    }
  }

  const handleGenerateQR = () => {
    if (!me?.citizen_din) return
    generateQR(me.citizen_din)
  }

  /* -------------------- Render -------------------- */

  return (
    <div className="min-h-screen bg-background font-sans flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card shrink-0 sticky top-0 h-screen">
        <div className="flex h-16 items-center gap-2.5 px-4 border-b border-border">
          <Logo width={32} height={32} />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-foreground">ZAMREN</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Digital ID Wallet</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {sidebarLinks.map((link) => {
            const Icon = link.icon
            const isActive = activeTab === link.id
            if (link.href) {
              return (
                <a
                  key={link.id}
                  href={link.href}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{link.label}</span>
                </a>
              )
            }
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
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
                {me.name?.split(" ").map((n: string) => n[0]).join("")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{me.name}</p>
                <p className="text-xs text-muted-foreground truncate">{me.citizen_din || "Not issued"}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
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
          {meLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Error */}
          {!meLoading && meError && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-5 py-4 text-sm text-destructive">
              {meError}
            </div>
          )}

          {!meLoading && !meError && me && (
            <>
              {/* Enrollment banner */}
              <EnrollmentBanner state={enrollmentState} />

              {activeTab === "wallet" && (
                <div className="space-y-6">
                  {/* Complete Profile CTA */}
                  {enrollmentState === "NOT_STARTED" && (
                    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-1 shadow-lg">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-transparent opacity-50" />
                      <div className="relative flex flex-col items-center justify-between gap-4 p-4 sm:flex-row sm:p-6">
                        <div className="flex items-center gap-4 text-center sm:text-left">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20">
                            <Logo width={32} height={32} />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-foreground">Complete Your Registration</h3>
                            <p className="text-sm text-muted-foreground">Unlock your Digital ID and access all government services online.</p>
                          </div>
                        </div>
                        <Link
                          href="/registration/identity"
                          className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 sm:w-auto"
                        >
                          Complete Now
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </div>
                    </div>
                  )}
                  {/* Integrated Digital ID Card */}
                  {enrollmentState === "ACTIVE" ? (
                    <div className="rounded-2xl border border-primary/20 bg-[#0c0c0c] p-4 sm:p-6 shadow-2xl relative overflow-hidden">
                      {/* Chitenge background pattern */}
                      <div className="absolute inset-0 opacity-[0.04] pointer-events-none z-0">
                        <svg viewBox="0 0 680 700" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
                          <defs>
                            <pattern id="chitenge" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                              <path d="M0 30 L15 0 L30 30 L15 60 Z" fill="none" stroke="#00c98d" strokeWidth="0.8" />
                              <path d="M30 30 L45 0 L60 30 L45 60 Z" fill="none" stroke="#00c98d" strokeWidth="0.8" />
                              <circle cx="15" cy="30" r="4" fill="none" stroke="#00c98d" strokeWidth="0.6" />
                              <circle cx="45" cy="30" r="4" fill="none" stroke="#00c98d" strokeWidth="0.6" />
                              <line x1="0" y1="30" x2="60" y2="30" stroke="#004D40" strokeWidth="0.5" />
                              <line x1="15" y1="0" x2="15" y2="60" stroke="#004D40" strokeWidth="0.5" />
                              <line x1="45" y1="0" x2="45" y2="60" stroke="#004D40" strokeWidth="0.5" />
                              <path d="M0 0 Q15 15 30 0 Q45 15 60 0" fill="none" stroke="#00c98d" strokeWidth="0.5" />
                              <path d="M0 60 Q15 45 30 60 Q45 45 60 60" fill="none" stroke="#00c98d" strokeWidth="0.5" />
                            </pattern>
                          </defs>
                          <rect width="680" height="700" fill="url(#chitenge)" />
                        </svg>
                      </div>

                      <div className="relative z-10">
                        {/* Topbar inside card area */}
                        {/* Digital ID Card */}
                        {digitalIDLoading ? (
                          <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-[#00c98d]" />
                          </div>
                        ) : digitalIDError ? (
                          <div className="rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/5 px-4 py-3 text-xs text-[#f59e0b] mb-4">
                            {digitalIDError}
                          </div>
                        ) : (
                          <DigitalIDCard
                            me={me}
                            digitalID={digitalID}
                            qrPayload={qrPayload}
                            loading={digitalIDLoading}
                            onFlip={() => setCardFlipped((f) => !f)}
                            flipped={cardFlipped}
                            onGenerateQR={handleGenerateQR}
                            qrLoading={qrLoading}
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Inactive / Pending State Card */
                    <div className="rounded-2xl border border-primary/30 bg-card p-6 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
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
                        <span className="text-xs text-amber-400 font-semibold bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                          {enrollmentState}
                        </span>
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
                          <p className="text-xs text-muted-foreground">Status: {enrollmentState}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        {[
                          { label: "Digital ID", value: me.citizen_din || "Not issued" },
                          { label: "Status", value: enrollmentState },
                          { label: "Email", value: me.is_email_verified ? "Verified" : "Not verified" },
                          { label: "Role", value: me.role },
                        ].map((item) => (
                          <div key={item.label} className="rounded-lg bg-secondary/60 px-3 py-2">
                            <p className="text-muted-foreground mb-0.5">{item.label}</p>
                            <p className={`font-semibold ${item.label === "Status" ? "text-primary" : "text-foreground"} font-mono`}>
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Share ID Action Row */}
                  {enrollmentState === "ACTIVE" && me?.citizen_din && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        onClick={() => setShareModalOpen(true)}
                        className="group flex items-center justify-center gap-2.5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 shadow-lg shadow-primary/20"
                      >
                        <Share2 className="h-4 w-4" />
                        Share My ID
                      </button>
                      <button
                        onClick={() => setScanModalOpen(true)}
                        className="group flex items-center justify-center gap-2.5 rounded-xl bg-secondary border border-border px-4 py-3 text-sm font-bold text-foreground hover:border-primary/40 hover:bg-secondary/80 active:scale-[0.98] transition-all duration-150"
                      >
                        <ScanLine className="h-4 w-4 text-primary" />
                        Scan QR Code
                      </button>
                      <button
                        onClick={handleGenerateQR}
                        disabled={qrLoading}
                        className="group flex items-center justify-center gap-2.5 rounded-xl bg-secondary border border-border px-4 py-3 text-sm font-bold text-foreground hover:border-primary/40 hover:bg-secondary/80 active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
                      >
                        {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCodeIcon className="h-4 w-4 text-primary" />}
                        {qrPayload ? "Refresh QR" : "Generate QR"}
                      </button>
                    </div>
                  )}

                  {/* Recent Activity */}
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" /> Recent Activity
                      </h2>
                      {logsLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                    </div>
                    <div className="space-y-3">
                      {!logsLoading && logs.length === 0 && (
                        <p className="text-xs text-muted-foreground py-4 text-center">No recent activity found.</p>
                      )}
                      {logs.slice(0, 4).map((item, i) => (
                        <div key={item.id} className="flex items-center justify-between rounded-lg bg-secondary/40 px-4 py-3 hover:bg-secondary/60 transition-colors cursor-default">
                          <div className="flex items-center gap-3">
                            <div className={`h-2 w-2 rounded-full shrink-0 ${item.outcome === 'SUCCESS' ? 'bg-primary' : 'bg-destructive'}`} />
                            <div>
                              <p className="text-sm font-medium text-foreground">{formatAction(item.action)}</p>
                              <p className="text-xs text-muted-foreground">{item.actor_role === 'CITIZEN' ? 'Performed by you' : `Action by ${item.actor_role}`}</p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">{getRelativeTime(item.timestamp)}</span>
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

                </div>
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
                        <div className="flex flex-wrap gap-2">
                          {enrollmentState === "NOT_STARTED" && (
                            <Link
                              href="/registration/identity"
                              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-lg shadow-primary/20"
                            >
                              <Shield className="h-4 w-4" />
                              Complete Profile
                            </Link>
                          )}
                          <button 
                            onClick={() => setEditProfileModalOpen(true)}
                            className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors"
                          >
                            Edit Profile
                          </button>
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Profile Details */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
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

                      {/* Digital ID Metadata */}
                      {digitalID && (
                        <div className="rounded-2xl border border-border bg-card p-6">
                          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Digital ID Metadata</h3>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between py-2 border-b border-border/50">
                              <span className="text-xs text-muted-foreground">Issued</span>
                              <span className="text-xs font-bold text-foreground">
                                {new Date(digitalID.issued_at).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-border/50">
                              <span className="text-xs text-muted-foreground">Citizen Type</span>
                              <span className="text-xs font-bold text-foreground">
                                {formatCitizenType(getCitizenType(digitalID.dob || "1990-01-01", digitalID.citizen_type))}
                              </span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                              <span className="text-xs text-muted-foreground">Signature</span>
                              <span className="text-xs font-mono text-primary truncate max-w-[120px]">
                                {digitalID.signature.slice(0, 16)}...
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
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
                              {member.name.split(" ").map((n) => n[0]).join("")}
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
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-foreground">Full Activity Log</h2>
                      <div className="flex items-center gap-2">
                        {logsLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                        <span className="text-xs text-muted-foreground">{logsTotal} total events</span>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {!logsLoading && logs.length === 0 && (
                        <div className="text-center py-12 bg-secondary/20 rounded-2xl border border-dashed border-border">
                          <History className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
                          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                        </div>
                      )}
                      
                      {logs.map((item) => (
                        <div key={item.id} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/30 transition-colors">
                          <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${item.outcome === 'SUCCESS' ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                            <History className={`h-4 w-4 ${item.outcome === 'SUCCESS' ? 'text-primary' : 'text-destructive'}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-bold text-foreground">{formatAction(item.action)}</p>
                              <span className="text-[10px] font-medium text-muted-foreground">{getRelativeTime(item.timestamp)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {item.actor_role === 'CITIZEN' ? 'You initiated this action' : `This action was performed by a ${item.actor_role}`} 
                              {item.target_type !== 'CITIZEN' && ` on ${item.target_type.toLowerCase()}`}
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                              <span className={`text-[10px] font-bold uppercase tracking-tight ${item.outcome === 'SUCCESS' ? 'text-primary' : 'text-destructive'}`}>
                                Status: {item.outcome}
                              </span>
                              <span className="text-[10px] text-muted-foreground">•</span>
                              <span className="text-[10px] text-muted-foreground">{new Date(item.timestamp).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {logsTotal > 20 && (
                      <div className="mt-6 flex items-center justify-center gap-2">
                         <button className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">Previous</button>
                         <button className="px-4 py-2 text-xs font-bold text-primary bg-primary/10 rounded-lg">1</button>
                         <button className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">Next</button>
                      </div>
                    )}
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
                        <div key={notif.id} className={`p-4 rounded-xl border border-border ${notif.unread ? "bg-primary/5 border-primary/20" : "bg-secondary/20"} relative overflow-hidden transition-all hover:bg-secondary/30`}>
                          {notif.unread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className={`text-sm font-bold ${notif.unread ? "text-primary" : "text-foreground"} mb-1`}>{notif.title}</p>
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

              {activeTab === "partners" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
                      <Link2 className="h-5 w-5 text-primary" /> Verified Service Partners
                    </h2>
                    <p className="text-sm text-muted-foreground mb-8">
                      Connect your Digital ID with official partners to access seamless services without manual document verification.
                    </p>

                    {institutionsLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground">Fetching official partners...</p>
                      </div>
                    ) : activeInstitutions.length === 0 ? (
                      <div className="text-center py-20 bg-secondary/20 rounded-2xl border border-dashed border-border">
                        <Globe className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-20" />
                        <p className="text-sm text-muted-foreground">No active partners found at the moment.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeInstitutions.map((inst) => (
                          <div key={inst.id} className="group rounded-2xl border border-border bg-secondary/20 p-5 hover:border-primary/40 transition-all duration-300">
                            <div className="flex items-start justify-between mb-4">
                              <div className="h-12 w-12 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-300">
                                <Building2 className="h-6 w-6 text-primary" />
                              </div>
                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                                Verified
                              </span>
                            </div>
                            <div className="space-y-1 mb-6">
                              <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">{inst.name}</h3>
                              <p className="text-xs text-muted-foreground">Reg No: {inst.reg_number}</p>
                              <div className="flex gap-1.5 mt-2">
                                {inst.permitted_scope?.map((scope: string) => (
                                  <span key={scope} className="text-[9px] bg-card border border-border px-1.5 py-0.5 rounded-md text-muted-foreground">
                                    {scope.replace("_", " ")}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button 
                              onClick={() => alert(`Linking ${inst.name} to your Digital ID...`)}
                              className="w-full py-2.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
                            >
                              <Link2 className="h-3.5 w-3.5" /> Link Account
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
                      <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-foreground mb-1">Privacy Guarantee</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Linking an account does not share your data immediately. It only establishes a secure connection so you can choose what to share when you use their services.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "settings" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      {/* Share ID Modal */}
      <ShareIDModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        qrPayload={qrPayload}
        qrLoading={qrLoading}
        onGenerateQR={handleGenerateQR}
        din={me?.citizen_din ?? null}
        name={me?.name ?? ""}
      />

      {/* Scan ID Modal */}
      <ScanIDModal
        open={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        open={editProfileModalOpen}
        onClose={() => setEditProfileModalOpen(false)}
        currentData={{
          name: me?.name ?? "",
          phone: (me as any)?.phone ?? "",
          language: (me as any)?.language ?? "en"
        }}
        onSuccess={(newData) => {
          // You might want to refresh 'me' data or manually update it in the tokenStore
          // Since tokenStore is updated inside the API call, we just need the UI to reflect it.
          // Re-fetching 'me' is the most reliable way.
          window.location.reload() // Simplest way to refresh all state
        }}
      />
    </div>
  )
}
