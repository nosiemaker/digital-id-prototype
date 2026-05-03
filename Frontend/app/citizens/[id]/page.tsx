"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  User,
  Phone,
  MapPin,
  Calendar,
  Fingerprint,
  Camera,
  FileText,
  AlertTriangle,
  Loader2,
  Mail,
  KeyRound,
  Languages,
  Users,
  Baby,
  Hash,
  CreditCard,
  Building2,
  Stethoscope,
  Eye,
  Download,
  Check,
  X,
  RefreshCw,
  Clock3,
  UserCheck,
  FileCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { enrollmentApi, citizenApi, type EnrollmentRequestResponse, type CitizenResponse, type FamilyTreeResponse } from "@/lib/axios"
import { useRoleGuard } from "@/hooks/use-role-guard"

// ── Types extending the base API types with full field coverage ─────────────

interface FullCitizenResponse extends CitizenResponse {
  gender?: "MALE" | "FEMALE"
  residential_address?: string
  district?: {
    id: number
    name: string
    code: string
    province: {
      id: number
      name: string
      code: string
    }
  }
  citizen_type?: "CHILD_UNDER_16" | "CHILD_ABOVE_16" | "ADULT" | "SENIOR"
  activation_nonce?: string
  challenge_expires_at?: string
  created_at: string
  updated_at: string
}

interface FullEnrollmentResponse extends EnrollmentRequestResponse {
  citizen: FullCitizenResponse
  ro?: {
    id: number
    employee_id: string
    citizen: {
      full_name: string
    }
  } | null
  activation_challenge?: string | null
  activation_challenge_expires_at?: string | null
}

// ── Status configuration ─────────────────────────────────────────────────────

const statusConfig: Record<string, { 
  icon: React.ElementType
  color: string
  bg: string
  badge: string
  label: string
}> = {
  APPROVED: { 
    icon: CheckCircle2, 
    color: "text-emerald-400", 
    bg: "bg-emerald-400/10", 
    badge: "bg-emerald-400/15 text-emerald-400 border-emerald-400/20",
    label: "Approved & Active"
  },
  PENDING:  { 
    icon: Clock, 
    color: "text-amber-400", 
    bg: "bg-amber-400/10", 
    badge: "bg-amber-400/15 text-amber-400 border-amber-400/20",
    label: "Pending Review"
  },
  REJECTED: { 
    icon: XCircle, 
    color: "text-red-400", 
    bg: "bg-red-400/10", 
    badge: "bg-red-400/15 text-red-400 border-red-400/20",
    label: "Rejected"
  },
}

const citizenTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  CHILD_UNDER_16: { label: "Child (Under 16)", icon: Baby, color: "text-sky-400" },
  CHILD_ABOVE_16: { label: "Child (16–17)", icon: Baby, color: "text-sky-400" },
  ADULT: { label: "Adult (18–59)", icon: User, color: "text-primary" },
  SENIOR: { label: "Senior (60+)", icon: User, color: "text-violet-400" },
}

const genderConfig: Record<string, { label: string; color: string }> = {
  MALE: { label: "Male", color: "text-blue-400" },
  FEMALE: { label: "Female", color: "text-pink-400" },
}

// ── Section Collapsible Component ────────────────────────────────────────────

function SectionCard({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = true 
}: { 
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-secondary/30 transition-colors"
      >
        <h3 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
          <Icon className="h-3.5 w-3.5" /> {title}
        </h3>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

// ── Detail Row Component ─────────────────────────────────────────────────────

function DetailRow({ label, value, mono = false, children }: { 
  label: string
  value?: React.ReactNode
  mono?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      {children ? (
        children
      ) : (
        <p className={`text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>
          {value ?? "—"}
        </p>
      )}
    </div>
  )
}

// ── Document Preview Card ────────────────────────────────────────────────────

function DocumentPreview({ 
  label, 
  url, 
  icon: Icon 
}: { 
  label: string
  url?: string | null
  icon: React.ElementType
}) {
  const [showPreview, setShowPreview] = useState(false)

  if (!url) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-4 border border-dashed border-border">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground/60">Not uploaded</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-3 border border-border">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground font-mono truncate">{url.split('/').pop()}</p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            title="Toggle preview"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
            title="Open in new tab"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      {showPreview && (
        <div className="rounded-lg border border-border overflow-hidden bg-black/5">
          <img 
            src={url} 
            alt={label}
            className="w-full h-48 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
      )}
    </div>
  )
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function RegistrationReviewPage() {
  useRoleGuard(["REGISTRATION_OFFICER"])

  const params = useParams()
  const router = useRouter()
  const requestId = parseInt(params.id as string, 10)

  const [enrollment, setEnrollment] = useState<FullEnrollmentResponse | null>(null)
  const [familyTree, setFamilyTree] = useState<FamilyTreeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [actionDone, setActionDone] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "documents" | "biometrics" | "family" | "audit">("overview")

  useEffect(() => {
    if (Number.isNaN(requestId)) {
      setError("Invalid request ID")
      setLoading(false)
      return
    }

    setLoading(true)
    enrollmentApi.getPendingRequest(requestId)
      .then((data) => {
        setEnrollment(data as FullEnrollmentResponse)
        // If citizen has a DIN (approved), fetch family tree too
        if (data.citizen.din) {
          citizenApi.getFamilyTree(data.citizen.din)
            .then(setFamilyTree)
            .catch(() => {/* family tree optional */})
        }
      })
      .catch((err) => setError(err.detail ?? "Failed to load request"))
      .finally(() => setLoading(false))
  }, [requestId])

  const citizen = enrollment?.citizen
  const cfg = statusConfig[enrollment?.status ?? "PENDING"]
  const StatusIcon = cfg.icon
  const citizenType = citizen?.citizen_type ? citizenTypeConfig[citizen.citizen_type] : null
  const CitizenTypeIcon = citizenType?.icon ?? User

  async function executeAction(action: "approve" | "reject") {
    if (!enrollment) return
    setActionLoading(true)
    setError(null)

    try {
      if (action === "approve") {
        const updated = await enrollmentApi.approve(enrollment.id)
        setEnrollment(updated as FullEnrollmentResponse)
      } else {
        if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
          setError("Rejection reason must be at least 10 characters")
          setActionLoading(false)
          return
        }
        const updated = await enrollmentApi.reject(enrollment.id, { rejection_reason: rejectionReason.trim() })
        setEnrollment(updated as FullEnrollmentResponse)
      }
      setActionDone(true)
      setConfirmAction(null)
      setRejectionReason("")
    } catch (err: any) {
      setError(err.detail ?? "Action failed. Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  // ── Loading State ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading enrollment details...</p>
        </div>
      </div>
    )
  }

  // ── Error State ────────────────────────────────────────────────────────────
  if (error && !enrollment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 bg-background">
        <div className="h-16 w-16 rounded-full bg-red-400/10 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Failed to Load</h2>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
        <button 
          onClick={() => router.back()} 
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium hover:bg-secondary transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Go Back
        </button>
      </div>
    )
  }

  if (!enrollment || !citizen) return null

  const age = citizen.dob 
    ? Math.floor((new Date().getTime() - new Date(citizen.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null

  return (
    <div className="min-h-screen bg-background">
      {/* ═══════════════════════════════════════════════════════════════════════
          TOP NAVIGATION BAR
         ═══════════════════════════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="h-16 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.back()} 
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="hidden sm:block h-6 w-px bg-border" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-foreground">{citizen.full_name}</h1>
                {citizen.din && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-mono text-muted-foreground border border-border">
                    <Hash className="h-3 w-3" />
                    {citizen.din}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                REQ-{enrollment.id.toString().padStart(5, "0")}
                {enrollment.ro && (
                  <span className="ml-2 text-muted-foreground/60">
                    • Reviewed by {enrollment.ro.citizen.full_name}
                  </span>
                )}
              </p>
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${cfg.badge}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {cfg.label}
          </span>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 px-4 sm:px-6 border-t border-border">
          {([
            { id: "overview", label: "Overview", icon: User },
            { id: "documents", label: "Documents", icon: FileText },
            { id: "biometrics", label: "Biometrics", icon: Fingerprint },
            { id: "family", label: "Family", icon: Users },
            { id: "audit", label: "Audit Log", icon: Clock3 },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
        {/* ═══════════════════════════════════════════════════════════════════════
            ALERT BANNERS
           ═══════════════════════════════════════════════════════════════════════ */}
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 flex items-center gap-3 animate-in slide-in-from-top-2">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
            <p className="text-sm font-medium text-foreground">{error}</p>
            <button 
              onClick={() => setError(null)} 
              className="ml-auto text-xs text-muted-foreground hover:text-foreground font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {actionDone && (
          <div className={`rounded-xl border p-4 flex items-center gap-3 animate-in slide-in-from-top-2 ${
            enrollment.status === "APPROVED" 
              ? "border-emerald-400/30 bg-emerald-400/10" 
              : "border-red-400/30 bg-red-400/10"
          }`}>
            {enrollment.status === "APPROVED" 
              ? <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" /> 
              : <XCircle className="h-5 w-5 text-red-400 shrink-0" />
            }
            <p className="text-sm font-medium text-foreground">
              Application {enrollment.status === "APPROVED" ? "approved" : "rejected"} successfully.
              {enrollment.status === "APPROVED" && citizen.din && (
                <span className="ml-1 font-mono text-emerald-400">DIN: {citizen.din}</span>
              )}
            </p>
            <button 
              onClick={() => setActionDone(false)} 
              className="ml-auto text-xs text-muted-foreground hover:text-foreground font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            OVERVIEW TAB
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left Column — Identity Card & Quick Stats */}
            <div className="lg:col-span-4 space-y-5">
              {/* Identity Card */}
              <div className="rounded-xl border border-border bg-card p-6 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-primary/10 to-transparent" />

                <div className="relative">
                  <div className="mx-auto mb-4 h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/20 flex items-center justify-center text-3xl font-bold text-primary shadow-lg">
                    {citizen.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                  </div>

                  <h2 className="font-bold text-foreground text-lg">{citizen.full_name}</h2>

                  <div className="mt-2 flex items-center justify-center gap-2">
                    {citizenType && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-secondary border border-border ${citizenType.color}`}>
                        <CitizenTypeIcon className="h-3 w-3" />
                        {citizenType.label}
                      </span>
                    )}
                    {citizen.gender && (
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium bg-secondary border border-border ${genderConfig[citizen.gender]?.color ?? "text-muted-foreground"}`}>
                        {citizen.gender}
                      </span>
                    )}
                  </div>

                  <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.badge}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {cfg.label}
                  </div>

                  {citizen.din && (
                    <div className="mt-4 p-3 rounded-lg bg-secondary/50 border border-border">
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Digital ID Number (DIN)</p>
                      <p className="text-lg font-mono font-bold text-primary mt-0.5">{citizen.din}</p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-border space-y-3 text-left">
                    <div className="flex items-center gap-2.5 text-xs">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-muted-foreground">Date of Birth</p>
                        <p className="font-medium text-foreground">
                          {new Date(citizen.dob).toLocaleDateString("en-GB", { 
                            day: "2-digit", month: "long", year: "numeric" 
                          })}
                          {age !== null && <span className="text-muted-foreground ml-1">({age} years)</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 text-xs">
                      <CreditCard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-muted-foreground">NRC Number</p>
                        <p className="font-medium text-foreground font-mono">{citizen.nrc}</p>
                      </div>
                    </div>

                    {citizen.phone && (
                      <div className="flex items-center gap-2.5 text-xs">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-muted-foreground">Phone</p>
                          <p className="font-medium text-foreground">{citizen.phone}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2.5 text-xs">
                      <Languages className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-muted-foreground">Preferred Language</p>
                        <p className="font-medium text-foreground uppercase">{citizen.language}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 text-xs">
                      <Clock3 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-muted-foreground">Enrollment Submitted</p>
                        <p className="font-medium text-foreground">
                          {new Date(enrollment.submitted_at).toLocaleString("en-GB", { 
                            day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* District Card */}
              {citizen.district && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" /> Jurisdiction
                  </h3>
                  <div className="space-y-3">
                    <DetailRow label="District" value={citizen.district.name} />
                    <DetailRow label="District Code" value={citizen.district.code} mono />
                    <DetailRow label="Province" value={citizen.district.province.name} />
                    <DetailRow label="Province Code" value={citizen.district.province.code} mono />
                  </div>
                </div>
              )}

              {/* Address Card */}
              {citizen.residential_address && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" /> Residential Address
                  </h3>
                  <p className="text-sm text-foreground leading-relaxed">{citizen.residential_address}</p>
                </div>
              )}
            </div>

            {/* Right Column — Detailed Sections */}
            <div className="lg:col-span-8 space-y-5">
              {/* Personal Information */}
              <SectionCard title="Personal Information" icon={User}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <DetailRow label="Full Legal Name" value={citizen.full_name} />
                  <DetailRow label="NRC Number" value={citizen.nrc} mono />
                  <DetailRow 
                    label="Date of Birth" 
                    value={`${new Date(citizen.dob).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })} ${age !== null ? `(${age} years)` : ""}`} 
                  />
                  <DetailRow 
                    label="Gender" 
                    value={citizen.gender ? genderConfig[citizen.gender]?.label ?? citizen.gender : "Not specified"} 
                  />
                  <DetailRow label="Phone Number" value={citizen.phone} />
                  <DetailRow label="Preferred Language" value={citizen.language.toUpperCase()} />
                  <DetailRow 
                    label="Citizen Category" 
                    value={citizenType?.label ?? citizen.citizen_type ?? "Unknown"} 
                  />
                  <DetailRow 
                    label="Account Status" 
                    value={citizen.status} 
                  />
                </div>
              </SectionCard>

              {/* Contact & Location */}
              <SectionCard title="Contact & Location" icon={MapPin}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <DetailRow label="Phone" value={citizen.phone} />
                  <DetailRow label="Email" value={(citizen as any).email ?? "—"} />
                  <DetailRow label="Residential Address" value={citizen.residential_address} />
                  <DetailRow 
                    label="District" 
                    value={citizen.district ? `${citizen.district.name} (${citizen.district.code})` : "Not assigned"} 
                  />
                  <DetailRow 
                    label="Province" 
                    value={citizen.district?.province.name ?? "Not assigned"} 
                  />
                </div>
              </SectionCard>

              {/* Cryptographic Identity */}
              <SectionCard title="Cryptographic Identity" icon={KeyRound}>
                <div className="space-y-3">
                  <DetailRow label="Public Key Algorithm">ECDSA P-256</DetailRow>
                  <DetailRow label="Public Key Fingerprint">
                    <div className="flex items-center gap-2">
                      <code className="text-[11px] font-mono bg-secondary px-2 py-1 rounded text-muted-foreground break-all">
                        {citizen.public_key 
                          ? `${citizen.public_key.slice(0, 40)}...${citizen.public_key.slice(-20)}`
                          : "No public key on file"
                        }
                      </code>
                      {citizen.public_key && (
                        <button 
                          onClick={() => navigator.clipboard.writeText(citizen.public_key)}
                          className="text-[11px] text-primary hover:underline shrink-0"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </DetailRow>
                  {citizen.activation_nonce && (
                    <DetailRow label="Activation Nonce">
                      <code className="text-[11px] font-mono bg-secondary px-2 py-1 rounded text-muted-foreground">
                        {citizen.activation_nonce.slice(0, 24)}...
                      </code>
                    </DetailRow>
                  )}
                  {citizen.challenge_expires_at && (
                    <DetailRow 
                      label="Challenge Expires" 
                      value={new Date(citizen.challenge_expires_at).toLocaleString("en-GB")} 
                    />
                  )}
                </div>
              </SectionCard>

              {/* Review Status Panel */}
              <SectionCard title="Review Status" icon={FileCheck}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <DetailRow 
                    label="Current Status" 
                    value={
                      <span className={`inline-flex items-center gap-1.5 ${cfg.color}`}>
                        <StatusIcon className="h-4 w-4" />
                        {cfg.label}
                      </span>
                    } 
                  />
                  <DetailRow 
                    label="Submitted At" 
                    value={new Date(enrollment.submitted_at).toLocaleString("en-GB")} 
                  />
                  {enrollment.reviewed_at && (
                    <DetailRow 
                      label="Reviewed At" 
                      value={new Date(enrollment.reviewed_at).toLocaleString("en-GB")} 
                    />
                  )}
                  {enrollment.ro && (
                    <DetailRow 
                      label="Reviewed By" 
                      value={`${enrollment.ro.citizen.full_name} (${enrollment.ro.employee_id})`} 
                    />
                  )}
                  {enrollment.rejection_reason && (
                    <div className="sm:col-span-2">
                      <DetailRow label="Rejection Reason">
                        <div className="rounded-lg bg-red-400/5 border border-red-400/20 p-3 mt-1">
                          <p className="text-sm text-red-400">{enrollment.rejection_reason}</p>
                        </div>
                      </DetailRow>
                    </div>
                  )}
                  {enrollment.activation_challenge && (
                    <DetailRow 
                      label="Activation Challenge" 
                      value={
                        <code className="text-[11px] font-mono bg-secondary px-2 py-1 rounded">
                          {enrollment.activation_challenge.slice(0, 20)}...
                        </code>
                      } 
                    />
                  )}
                  {enrollment.activation_challenge_expires_at && (
                    <DetailRow 
                      label="Challenge Expires" 
                      value={new Date(enrollment.activation_challenge_expires_at).toLocaleString("en-GB")} 
                    />
                  )}
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            DOCUMENTS TAB
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "documents" && (
          <div className="max-w-3xl space-y-5">
            <SectionCard title="National Registration Card (NRC)" icon={CreditCard}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DocumentPreview 
                  label="NRC Front Side" 
                  url={citizen.nrc_front_url} 
                  icon={FileText} 
                />
                <DocumentPreview 
                  label="NRC Back Side" 
                  url={citizen.nrc_back_url} 
                  icon={FileText} 
                />
              </div>
            </SectionCard>

            <SectionCard title="Biometric Capture Photo" icon={Camera}>
              <DocumentPreview 
                label="Face Capture" 
                url={citizen.face_image_url} 
                icon={Camera} 
              />
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-400/5 border border-amber-400/20 p-3">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                <p className="text-xs text-amber-400">
                  This photo was captured during in-person enrollment by a Registration Officer. 
                  Verify that the face matches the NRC photo and the applicant is present.
                </p>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            BIOMETRICS TAB
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "biometrics" && (
          <div className="max-w-3xl space-y-5">
            <SectionCard title="Biometric Verification Summary" icon={Fingerprint}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-4 border border-border">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Camera className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Face Scan</p>
                    <p className="text-sm font-medium text-primary">
                      {citizen.face_image_url ? "Captured ✓" : "Missing ✗"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-4 border border-border">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Fingerprint className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Facial Template</p>
                    <p className="text-sm font-medium text-primary">On File ✓</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-4 border border-border">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">DIN Commitment</p>
                    <p className="text-sm font-medium text-primary">Generated ✓</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-secondary/20 p-4 border border-border">
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Stethoscope className="h-3.5 w-3.5 text-primary" /> Biometric Processing Notes
                </h4>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                    512-dimensional facial embedding vector extracted via InsightFace
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                    Quantized 64-byte template stored for stable DIN derivation
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                    Deduplication check passed — no cosine similarity &gt; 0.85 detected
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                    SHA-256 commitment binds face to DIN with biometric salt
                  </li>
                </ul>
              </div>
            </SectionCard>

            <SectionCard title="Biometric Metadata" icon={Hash}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <DetailRow label="Embedding Vector" value="512 floats (server-side only)" />
                <DetailRow label="Quantized Template" value="64 bytes (512 bits)" />
                <DetailRow label="Hash Algorithm" value="SHA-256 with salt" />
                <DetailRow label="Standard" value="ISO/IEC 19794-5, ISO/IEC 30137" />
                <DetailRow label="Deduplication Threshold" value="Cosine similarity ≤ 0.85" />
                <DetailRow label="Storage" value="Encrypted at rest" />
              </div>
            </SectionCard>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            FAMILY TAB
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "family" && (
          <div className="max-w-3xl space-y-5">
            <SectionCard title="Family Relationships" icon={Users}>
              {familyTree ? (
                <div className="space-y-4">
                  {familyTree.parents.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Parents</h4>
                      <div className="space-y-2">
                        {familyTree.parents.map((parent) => (
                          <div key={parent.din} className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-3 border border-border">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {parent.full_name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{parent.full_name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{parent.din}</p>
                            </div>
                            <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{parent.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {familyTree.children.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Children</h4>
                      <div className="space-y-2">
                        {familyTree.children.map((child) => (
                          <div key={child.din} className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-3 border border-border">
                            <div className="h-8 w-8 rounded-full bg-sky-400/10 flex items-center justify-center text-xs font-bold text-sky-400">
                              {child.full_name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{child.full_name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{child.din}</p>
                            </div>
                            <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{child.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {familyTree.spouses.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Spouses</h4>
                      <div className="space-y-2">
                        {familyTree.spouses.map((spouse) => (
                          <div key={spouse.din} className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-3 border border-border">
                            <div className="h-8 w-8 rounded-full bg-pink-400/10 flex items-center justify-center text-xs font-bold text-pink-400">
                              {spouse.full_name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{spouse.full_name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{spouse.din}</p>
                            </div>
                            <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{spouse.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {familyTree.siblings.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Siblings</h4>
                      <div className="space-y-2">
                        {familyTree.siblings.map((sibling) => (
                          <div key={sibling.din} className="flex items-center gap-3 rounded-lg bg-secondary/30 px-4 py-3 border border-border">
                            <div className="h-8 w-8 rounded-full bg-violet-400/10 flex items-center justify-center text-xs font-bold text-violet-400">
                              {sibling.full_name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{sibling.full_name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{sibling.din}</p>
                            </div>
                            <span className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{sibling.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {familyTree.parents.length === 0 && familyTree.children.length === 0 && 
                   familyTree.spouses.length === 0 && familyTree.siblings.length === 0 && (
                    <div className="text-center py-8">
                      <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No family links recorded</p>
                    </div>
                  )}
                </div>
              ) : citizen.din ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading family tree...</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Family tree available after approval</p>
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            AUDIT TAB
           ═══════════════════════════════════════════════════════════════════════ */}
        {activeTab === "audit" && (
          <div className="max-w-3xl space-y-5">
            <SectionCard title="Enrollment Timeline" icon={Clock3}>
              <div className="relative pl-6 space-y-6">
                <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />

                {/* Submitted */}
                <div className="relative">
                  <div className="absolute -left-4 top-1 h-2 w-2 rounded-full bg-primary ring-4 ring-background" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Enrollment Submitted</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(enrollment.submitted_at).toLocaleString("en-GB", { 
                        day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" 
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">Citizen initiated enrollment via mobile app</p>
                  </div>
                </div>

                {/* Pending Review */}
                {enrollment.status === "PENDING" && (
                  <div className="relative">
                    <div className="absolute -left-4 top-1 h-2 w-2 rounded-full bg-amber-400 ring-4 ring-background animate-pulse" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Awaiting Review</p>
                      <p className="text-xs text-muted-foreground">Registration Officer review pending</p>
                    </div>
                  </div>
                )}

                {/* Reviewed */}
                {enrollment.reviewed_at && (
                  <div className="relative">
                    <div className={`absolute -left-4 top-1 h-2 w-2 rounded-full ring-4 ring-background ${
                      enrollment.status === "APPROVED" ? "bg-emerald-400" : "bg-red-400"
                    }`} />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {enrollment.status === "APPROVED" ? "Enrollment Approved" : "Enrollment Rejected"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(enrollment.reviewed_at).toLocaleString("en-GB", { 
                          day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" 
                        })}
                      </p>
                      {enrollment.ro && (
                        <p className="text-xs text-muted-foreground">
                          by {enrollment.ro.citizen.full_name} ({enrollment.ro.employee_id})
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* DIN Issued */}
                {citizen.din && (
                  <div className="relative">
                    <div className="absolute -left-4 top-1 h-2 w-2 rounded-full bg-emerald-400 ring-4 ring-background" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Digital ID Issued</p>
                      <p className="text-xs font-mono text-emerald-400">{citizen.din}</p>
                      <p className="text-xs text-muted-foreground">Unique DIN generated and bound to biometric</p>
                    </div>
                  </div>
                )}

                {/* Activation */}
                {enrollment.activation_challenge && (
                  <div className="relative">
                    <div className="absolute -left-4 top-1 h-2 w-2 rounded-full bg-blue-400 ring-4 ring-background" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">Activation Challenge Sent</p>
                      <p className="text-xs text-muted-foreground">
                        Expires: {enrollment.activation_challenge_expires_at 
                          ? new Date(enrollment.activation_challenge_expires_at).toLocaleString("en-GB")
                          : "Unknown"
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard title="System Metadata" icon={Hash}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <DetailRow label="Enrollment Request ID" value={enrollment.id.toString()} mono />
                <DetailRow label="Citizen Record ID" value={(citizen as any).id?.toString() ?? "—"} mono />
                <DetailRow label="Created At" value={new Date(citizen.created_at).toLocaleString("en-GB")} />
                <DetailRow label="Last Updated" value={new Date(citizen.updated_at).toLocaleString("en-GB")} />
                <DetailRow label="Citizen Status" value={citizen.status} />
                <DetailRow label="Enrollment Status" value={enrollment.status} />
              </div>
            </SectionCard>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            ACTION BAR
           ═══════════════════════════════════════════════════════════════════════ */}
        {enrollment.status === "PENDING" && (
          <div className="sticky bottom-4 rounded-xl border border-amber-400/20 bg-amber-400/5 backdrop-blur-md p-5 shadow-lg">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground text-sm">Pending Review</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review all tabs (Overview, Documents, Biometrics, Family) before making a decision. 
                  Approve to issue the Digital ID or reject with a detailed reason.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setConfirmAction("approve")}
                className="flex-1 rounded-lg bg-emerald-500 py-3 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve & Issue DIN
              </button>
              <button
                onClick={() => setConfirmAction("reject")}
                className="flex-1 rounded-lg bg-red-500/90 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <XCircle className="h-4 w-4" /> Reject Application
              </button>
            </div>
          </div>
        )}

        {enrollment.status !== "PENDING" && (
          <div className="flex flex-col sm:flex-row gap-3">
            <Link 
              href="/admin/registrations" 
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Registrations
            </Link>
            {enrollment.status === "APPROVED" && (
              <button
                onClick={() => setConfirmAction("reject")}
                className="rounded-lg border border-red-400/40 px-5 py-2.5 text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors flex items-center justify-center gap-2"
              >
                <XCircle className="h-4 w-4" /> Revoke / Reject
              </button>
            )}
            {enrollment.status === "REJECTED" && (
              <button
                onClick={() => setConfirmAction("approve")}
                className="rounded-lg border border-emerald-400/40 px-5 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-400/10 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" /> Re-approve
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          CONFIRMATION MODAL
         ═══════════════════════════════════════════════════════════════════════════ */}
      {confirmAction && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" 
          onClick={() => setConfirmAction(null)}
        >
          <div 
            className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
              confirmAction === "approve" ? "bg-emerald-400/15" : "bg-red-400/15"
            }`}>
              {confirmAction === "approve" 
                ? <CheckCircle2 className="h-7 w-7 text-emerald-400" /> 
                : <XCircle className="h-7 w-7 text-red-400" />
              }
            </div>

            <h3 className="font-bold text-foreground text-center text-lg mb-1">
              {confirmAction === "approve" ? "Approve Enrollment" : "Reject Enrollment"}
            </h3>

            <p className="text-sm text-muted-foreground text-center mb-6">
              {confirmAction === "approve"
                ? `This will generate a unique DIN and activate the digital identity for ${citizen.full_name}. This action cannot be undone.`
                : `This will permanently reject ${citizen.full_name}'s application. A detailed reason is required.`}
            </p>

            {/* Citizen summary in modal */}
            <div className="rounded-lg bg-secondary/50 border border-border p-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {citizen.full_name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{citizen.full_name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{citizen.nrc}</p>
                </div>
              </div>
            </div>

            {confirmAction === "reject" && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Rejection Reason <span className="text-red-400">*</span>
                  <span className="text-muted-foreground font-normal"> (min 10 characters)</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g., NRC photo unclear, biometric mismatch, duplicate enrollment detected..."
                  className="w-full rounded-lg border border-border bg-input p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors min-h-[100px] resize-y"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {rejectionReason.trim().length}/10 characters minimum
                </p>
              </div>
            )}

            {confirmAction === "approve" && (
              <div className="mb-4 rounded-lg bg-emerald-400/5 border border-emerald-400/20 p-3">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-400">
                    A unique DIN will be generated, the citizen status will change to ACTIVE, 
                    and an activation challenge will be issued for device binding.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmAction(null); setRejectionReason("") }}
                className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeAction(confirmAction)}
                disabled={actionLoading || (confirmAction === "reject" && rejectionReason.trim().length < 10)}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2 ${
                  confirmAction === "approve" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-500 hover:bg-red-600"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirmAction === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}