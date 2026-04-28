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
import { useState, useEffect, useCallback } from "react"
import { tokenStore, digitalIdApi, qrApi, authApi, citizenApi, type DigitalIDPayload as ApiDigitalIDPayload, type QRPayload as ApiQRPayload, type ServerPublicKeyResponse, type CitizenResponse } from "@/lib/axios"
import { QRCodeCanvas as QRCode } from "qrcode.react"
import {
  Shield,
  CheckCircle2,
  Download,
  Share2,
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
  Globe,
  Moon,
  Smartphone,
  Loader2,
  UserCircle,
  Lock,
  Copy,
  RefreshCw,
  Link2,
  Search,
  Crown,
} from "lucide-react"
import { useMe } from "@/hooks/useMe"
import { EnrollmentBanner } from "@/components/enrollment/enrollmentBanner"


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

/* ------------------------------------------------------------------ */
// Digital ID Card Component (ported from HTML)
/* ------------------------------------------------------------------ */

function DigitalIDCard({
  me,
  digitalID,
  qrPayload,
  loading,
  onFlip,
  flipped,
  onGenerateQR,
  qrLoading,
}: {
  me: any
  digitalID: ApiDigitalIDPayload | null
  qrPayload: QRPayload | null
  loading: boolean
  onFlip: () => void
  flipped: boolean
  onGenerateQR: () => void
  qrLoading: boolean
}) {
  const qrData = qrPayload ? JSON.stringify({
    din: qrPayload.din,
    name: qrPayload.name,
    nonce: qrPayload.nonce,
    exp: qrPayload.exp,
    sig: qrPayload.sig,
  }) : ""

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

  const initials = me?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "EC"
  const displayName = me?.name || digitalID?.full_name
  const din = me?.citizen_din || digitalID?.din 
  const status = digitalID?.status
  const province = digitalID?.province
  const gender = digitalID?.gender
  const faceImageUrl = digitalID?.face_image_url
  const dob = digitalID?.dob || ""
  const citizenType = getCitizenType(dob, digitalID?.citizen_type)
  const formattedCitizenType = formatCitizenType(citizenType)

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-[#141414] border border-[#1e3830] rounded-xl p-3">
          <div className="text-[9px] text-[#4a6a5a] uppercase tracking-widest mb-1">Status</div>
          <div className="text-sm font-semibold text-[#00c98d] flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00c98d] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00c98d]"></span>
            </span>
            Active
          </div>
        </div>
        <div className="bg-[#141414] border border-[#1e3830] rounded-xl p-3">
          <div className="text-[9px] text-[#4a6a5a] uppercase tracking-widest mb-1">Verifications</div>
          <div className="text-sm font-semibold text-[#e0e0e0]">14</div>
        </div>
        <div className="bg-[#141414] border border-[#1e3830] rounded-xl p-3">
          <div className="text-[9px] text-[#4a6a5a] uppercase tracking-widest mb-1">Citizen Type</div>
          <div className="text-sm font-semibold text-[#00c98d]">{formattedCitizenType}</div>
        </div>
      </div>

      {/* Flip Hint */}
      <div className="text-center mb-2">
        <span className="text-[9px] text-[#3a5a4a] uppercase tracking-widest">Tap card to flip</span>
      </div>

      {/* Vault Housing */}
      <div className="relative w-full bg-[#1a1a1a] rounded-[22px] border-[1.5px] border-[#2a2a2a] p-2.5">
        {/* Top emboss */}
        <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-[120px] h-[3px] rounded-b-md bg-[#2e5a46]" />
        
        {/* Crest row */}
        <div className="flex items-center justify-center gap-2 mb-2 mt-1">
          <div className="h-px flex-1 bg-[#1e3828] rounded-full" />
          <div className="w-9 h-9 rounded-full border-2 border-[#2e5a46] bg-[#0d1f18] flex items-center justify-center text-lg shadow-[0_0_0_1px_#1a3a2a]">
            <Crown className="h-4 w-4 text-[#2e6a4e]" />
          </div>
          <span className="text-[9px] text-[#2e6a4e] uppercase tracking-[0.12em] font-semibold">Republic of Zambia</span>
          <div className="h-px flex-1 bg-[#1e3828] rounded-full" />
        </div>

        {/* Card container with sheen */}
        <div className="relative rounded-2xl overflow-hidden">
          {/* Oil-slick sheen bands */}
          <div className="absolute inset-0 pointer-events-none z-10 rounded-2xl overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#2e6a4e] opacity-50 rounded-t-2xl" />
            <div className="absolute top-0.5 left-0 right-0 h-px bg-[#60a5fa] opacity-[0.12]" />
            <div className="absolute top-[3px] left-0 right-0 h-px bg-[#a78bfa] opacity-[0.10]" />
            <div className="absolute top-1 left-0 right-0 h-px bg-[#f59e0b] opacity-[0.08]" />
          </div>

          {/* Flip wrapper */}
          <div
            className="w-full cursor-pointer"
            style={{ perspective: "1400px" }}
            onClick={onFlip}
          >
            <div
              className="relative w-full"
              style={{
                paddingBottom: "59%",
                transformStyle: "preserve-3d",
                transition: "transform 0.8s cubic-bezier(0.4, 0.2, 0.2, 1)",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
              }}
            >
              {/* FRONT */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  background: "#071310",
                  border: "1px solid #1a4030",
                }}
              >
                {/* Brushed titanium lines */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                  {[18, 34, 52, 70, 86].map((top) => (
                    <div
                      key={top}
                      className="absolute w-full h-px bg-white opacity-[0.018]"
                      style={{ top: `${top}%` }}
                    />
                  ))}
                </div>

                {/* Chitenge corner motif */}
                <div className="absolute bottom-0 right-0 w-20 h-20 overflow-hidden rounded-br-2xl opacity-[0.06] pointer-events-none">
                  <svg viewBox="0 0 80 80" className="w-full h-full">
                    <path d="M80 0 L0 80" stroke="#00c98d" strokeWidth="1" fill="none" />
                    <path d="M80 20 L20 80" stroke="#00c98d" strokeWidth="0.7" fill="none" />
                    <path d="M80 40 L40 80" stroke="#00c98d" strokeWidth="0.5" fill="none" />
                    <circle cx="70" cy="70" r="18" fill="none" stroke="#00c98d" strokeWidth="0.8" />
                    <circle cx="70" cy="70" r="10" fill="none" stroke="#00c98d" strokeWidth="0.5" />
                  </svg>
                </div>

                {/* Front content */}
                <div className="absolute inset-0 p-5 flex flex-col justify-between">
                  {/* Top */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-[30px] h-[30px] rounded-full bg-[#003a2e] border border-[#005a44] flex items-center justify-center">
                        <Crown className="h-5 w-5 text-[#00c98d]" />
                      </div>
                      <div>
                        <div className="text-[7px] text-[#00c98d] uppercase tracking-[0.14em] font-semibold">Republic of Zambia</div>
                        <div className="text-[6px] text-[#2a5a46] uppercase tracking-[0.08em]">National Digital Identity Authority</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[rgba(0,201,141,0.1)] border border-[rgba(0,201,141,0.25)] rounded-full px-2 py-1">
                      <span className="relative flex h-[5px] w-[5px]">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00c98d] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-[5px] w-[5px] bg-[#00c98d]"></span>
                      </span>
                      <span className="text-[8px] text-[#00c98d] font-bold uppercase tracking-wider">Active · Verified</span>
                    </div>
                  </div>

                  {/* Middle */}
                  <div className="flex items-center gap-3.5">
                    {/* Profile */}
                    <div className="relative w-[66px] h-[66px] shrink-0">
                      <div
                        className="absolute -inset-[3px] rounded-full border-2 border-[#00c98d]"
                        style={{ animation: "ringpulse 2.5s ease-in-out infinite" }}
                      />
                      <div className="absolute inset-[3px] rounded-full bg-[#0d2a1e] border border-[#005a44] overflow-hidden flex items-center justify-center">
                        {faceImageUrl ? (
                          <img 
                            src={faceImageUrl} 
                            alt={displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xl font-bold text-[#00c98d] tracking-tight">
                            {initials}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[15px] font-bold text-[#f0f0f0] uppercase tracking-wide leading-tight">
                        {displayName}
                      </div>
                      <div className="text-[9px] text-[#3a6a52] mt-0.5 tracking-wide">
                        {formattedCitizenType} · {status === "ACTIVE" ? "Registered" : status} · {province}
                      </div>
                      <div className="text-[7px] text-[#3a6a52] uppercase tracking-[0.12em] mt-2">Digital ID Number (DIN)</div>
                      <div className="text-xs font-semibold text-[#00c98d] font-mono tracking-wide mt-px">{din}</div>
                    </div>
                  </div>

                  {/* Bottom */}
                  <div className="flex justify-between items-end">
                    <div className="flex gap-3.5">
                      <div>
                        <div className="text-[6px] text-[#2e5a42] uppercase tracking-[0.12em]">Date of Birth</div>
                        <div className="text-[9px] text-[#8ab8a0] font-medium mt-px">
                          {digitalID?.dob ? new Date(digitalID.dob).toLocaleDateString("en-GB") : "—— ·· ····"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[6px] text-[#2e5a42] uppercase tracking-[0.12em]">Gender</div>
                        <div className="text-[9px] text-[#8ab8a0] font-medium mt-px">{gender}</div>
                      </div>
                      <div>
                        <div className="text-[6px] text-[#2e5a42] uppercase tracking-[0.12em]">Province</div>
                        <div className="text-[9px] text-[#8ab8a0] font-medium mt-px">{digitalID?.province}</div>
                      </div>
                    </div>
                    {/* Chip */}
                    <div className="w-[26px] h-5 rounded border border-[#1e4a36] bg-[#0a1e14] grid grid-cols-2 gap-0.5 p-[3px]">
                      <div className="bg-[#1e4a36] rounded-[1px]" />
                      <div className="bg-[#1e4a36] rounded-[1px]" />
                      <div className="bg-[#1e4a36] rounded-[1px]" />
                      <div className="bg-[#1e4a36] rounded-[1px]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* BACK */}
              <div
                className="absolute inset-0 rounded-2xl overflow-hidden"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  background: "#060e0b",
                  border: "1px solid #162a20",
                }}
              >
                <div className="absolute inset-0 p-3.5 flex flex-col gap-2">
                  {/* Header */}
                  <div className="flex justify-between items-center">
                    <span className="text-[7px] text-[#1e4030] uppercase tracking-[0.12em]">ZM-GOV-DID · Secure Document</span>
                    <span className="text-[7px] text-[#1e4030] tracking-wide">v2.4.1</span>
                  </div>

                  {/* Magstripe */}
                  <div className="w-full h-8 bg-[#0a0a0a] rounded relative overflow-hidden">
                    <div className="absolute left-[20%] top-0 bottom-0 w-[30%] bg-[#111] opacity-50" />
                  </div>

                  {/* QR + Info */}
                  <div className="flex gap-3.5 items-start">
                    <div>
                      <div className="text-[7px] text-[#2e5a42] uppercase tracking-[0.1em] mb-1">Scan to verify identity</div>
                      {qrPayload ? (
                        <QRCode
                          value={qrData}
                          size={88}
                          level="H"
                          includeMargin={true}
                          bgColor="#ffffff"
                          fgColor="#111111"
                          className="rounded-lg border border-[#1a4030]"
                        />
                      ) : (
                        <div className="w-[88px] h-[88px] bg-white rounded-lg border border-[#1a4030] flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-[#00c98d]" />
                        </div>
                      )}
                      {qrPayload && (
                        <div className="text-[6px] text-[#2e5a42] mt-1 font-mono truncate w-[88px]">
                          Exp: {new Date(qrPayload.exp * 1000).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <div>
                        <div className="text-[7px] text-[#2e5a42] uppercase tracking-[0.1em]">Issued by</div>
                        <div className="text-[11px] text-[#8ab8a0] font-medium mt-px">Dept. of National Registration</div>
                      </div>
                      <div>
                        <div className="text-[7px] text-[#2e5a42] uppercase tracking-[0.1em]">Issue date</div>
                        <div className="text-[11px] text-[#8ab8a0] font-medium mt-px">
                          {digitalID?.issued_at
                            ? new Date(digitalID.issued_at).toLocaleDateString("en-GB", { month: "2-digit", year: "numeric" }).replace("/", " / ")
                            : "04 / 2023"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[7px] text-[#2e5a42] uppercase tracking-[0.1em]">Expiration</div>
                        <div className="text-[11px] text-[#00c98d] font-medium mt-px">{formattedCitizenType}</div>
                      </div>
                      <div className="w-[42px] h-[42px] rounded-full border border-[rgba(0,201,141,0.25)] bg-[rgba(0,77,64,0.25)] flex items-center justify-center">
                        <Crown className="h-5 w-5 text-[#00c98d]" />
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-[#162a20] pt-1.5 flex justify-between items-center mt-auto">
                    <span className="text-[7px] text-[#1e4030] uppercase tracking-[0.1em]">Cryptographically sealed · ECDSA P-256</span>
                    <span className="text-[7px] text-[#1e4030] uppercase tracking-[0.1em]">Tamper-evident · ZM-NDIA</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2 mt-4">
        <button className="bg-[#141414] border border-[#1e3828] rounded-xl py-3 px-1.5 text-center hover:bg-[#1a2e22] transition-colors">
          <div className="mb-1 flex justify-center"><Link2 className="h-4 w-4 text-[#6a8a7a]" /></div>
          <div className="text-[9px] text-[#6a8a7a]">Share ID</div>
        </button>
        <button
          onClick={() => navigator.clipboard?.writeText(din)}
          className="bg-[#141414] border border-[#1e3828] rounded-xl py-3 px-1.5 text-center hover:bg-[#1a2e22] transition-colors"
        >
          <div className="mb-1 flex justify-center"><Copy className="h-4 w-4 text-[#6a8a7a]" /></div>
          <div className="text-[9px] text-[#6a8a7a]">Copy DIN</div>
        </button>
        <button className="bg-[#141414] border border-[#1e3828] rounded-xl py-3 px-1.5 text-center hover:bg-[#1a2e22] transition-colors">
          <div className="mb-1 flex justify-center"><Download className="h-4 w-4 text-[#6a8a7a]" /></div>
          <div className="text-[9px] text-[#6a8a7a]">Download</div>
        </button>
        <button
          onClick={onGenerateQR}
          disabled={qrLoading}
          className="bg-[#141414] border border-[#1e3828] rounded-xl py-3 px-1.5 text-center hover:bg-[#1a2e22] transition-colors disabled:opacity-50"
        >
          <div className="mb-1 flex justify-center">
            {qrLoading ? <RefreshCw className="h-4 w-4 text-[#6a8a7a] animate-spin" /> : <QrCodeIcon className="h-4 w-4 text-[#6a8a7a]" />}
          </div>
          <div className="text-[9px] text-[#6a8a7a]">{qrPayload ? "Refresh QR" : "Generate QR"}</div>
        </button>
      </div>

      {/* Keyframes injection */}
      <style jsx>{`
        @keyframes ringpulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

/* ------------------------------------------------------------------ */
// Main Page
/* ------------------------------------------------------------------ */

export default function WalletPage() {
  const router = useRouter()
  const { me, enrollmentState, loading: meLoading, error: meError } = useMe()
  const [activeTab, setActiveTab] = useState("wallet")
  const [shareModalOpen, setShareModalOpen] = useState(false)
  
  // Backend integration state
  const [digitalID, setDigitalID] = useState<ApiDigitalIDPayload | null>(null)
  const [digitalIDLoading, setDigitalIDLoading] = useState(false)
  const [digitalIDError, setDigitalIDError] = useState<string | null>(null)
  
  const [qrPayload, setQrPayload] = useState<QRPayload | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  
  const [cardFlipped, setCardFlipped] = useState(false)
  const [serverPublicKey, setServerPublicKey] = useState<ServerPublicKey | null>(null)

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
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-[26px] h-[26px] rounded-full bg-[#004D40] border border-[#00c98d] flex items-center justify-center text-[13px]">
                            <Crown className="h-4 w-4 text-[#00c98d]" />
                          </div>
                          <span className="text-[13px] font-semibold text-[#e8e8e8] tracking-wide flex-1">My Digital ID Wallet</span>
                          <div className="relative">
                            <div className="bg-[#181818] border border-[#252525] rounded-full px-3.5 py-1.5 text-[11px] text-[#555] pl-7">
                              Search records...
                            </div>
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border-[1.5px] border-[#444] rounded-full" />
                            <div className="absolute left-[18px] top-[56%] w-[3px] h-[1.5px] bg-[#444] rotate-45" />
                          </div>
                          <button className="w-8 h-8 bg-[#181818] border border-[#252525] rounded-lg flex items-center justify-center text-sm relative">
                            <Bell className="h-4 w-4 text-[#444]" />
                            <span className="absolute top-1.5 right-1.5 w-[5px] h-[5px] bg-[#00c98d] rounded-full border border-[#111]" />
                          </button>
                        </div>

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

                        {/* Server Key Info (dev/debug visibility) */}
                        {serverPublicKey && (
                          <div className="mt-4 rounded-lg border border-[#1e3828] bg-[#141414] px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Lock className="h-3 w-3 text-[#2e6a4e]" />
                              <span className="text-[9px] text-[#3a5a4a] uppercase tracking-wider">
                                {serverPublicKey.algorithm} · Cached
                              </span>
                            </div>
                            <span className="text-[9px] text-[#2e6a4e] font-mono truncate max-w-[200px]">
                              {serverPublicKey.public_key_pem.slice(0, 40)}...
                            </span>
                          </div>
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
                        <button className="rounded-lg bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors">
                          Edit Profile
                        </button>
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
