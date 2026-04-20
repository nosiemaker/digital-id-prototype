"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
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
} from "lucide-react"

const CITIZENS: Record<string, {
  id: string; name: string; nrc: string; dob: string; gender: string; province: string;
  email: string; phone: string; address: string; registered: string; status: string;
}> = {
  "8872": { id: "ZM-2024-001-8872", name: "Mwamba Kalinda", nrc: "123456/78/9", dob: "14 March 1990", gender: "Male", province: "Lusaka", email: "mwamba@email.com", phone: "+260 97 123 4567", address: "Plot 45, Cairo Road, Lusaka", registered: "23 Mar 2024", status: "Verified" },
  "1134": { id: "ZM-2024-002-1134", name: "Chileshe Banda", nrc: "234567/89/1", dob: "20 July 1985", gender: "Female", province: "Copperbelt", email: "chileshe@email.com", phone: "+260 96 234 5678", address: "15 Independence Ave, Ndola", registered: "22 Mar 2024", status: "Verified" },
  "5520": { id: "ZM-2024-003-5520", name: "Mutale Phiri", nrc: "345678/90/2", dob: "3 Jan 1998", gender: "Male", province: "Eastern", email: "mutale@email.com", phone: "+260 95 345 6789", address: "Plot 7, Chipata Road, Chipata", registered: "21 Mar 2024", status: "Pending" },
  "8801": { id: "ZM-2024-004-8801", name: "Namwaka Tembo", nrc: "456789/01/3", dob: "9 May 1993", gender: "Female", province: "Southern", email: "namwaka@email.com", phone: "+260 97 456 7890", address: "22 Livingstone Road, Livingstone", registered: "20 Mar 2024", status: "Verified" },
  "2203": { id: "ZM-2024-005-2203", name: "Bwalya Mwansa", nrc: "567890/12/4", dob: "1 Nov 2000", gender: "Male", province: "Northern", email: "bwalya@email.com", phone: "+260 96 567 8901", address: "Plot 3, Kasama Road, Kasama", registered: "19 Mar 2024", status: "Pending" },
  "6641": { id: "ZM-2024-006-6641", name: "Chanda Lungu", nrc: "678901/23/5", dob: "15 Feb 1975", gender: "Female", province: "Western", email: "chanda@email.com", phone: "+260 95 678 9012", address: "Plot 18, Mongu Road, Mongu", registered: "18 Mar 2024", status: "Rejected" },
}

const DEFAULT_CITIZEN = CITIZENS["8872"]

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; badge: string }> = {
  Verified: { icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10", badge: "bg-primary/15 text-primary border-primary/20" },
  Pending: { icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10", badge: "bg-yellow-400/15 text-yellow-400 border-yellow-400/20" },
  Rejected: { icon: XCircle, color: "text-red-400", bg: "bg-red-400/10", badge: "bg-red-400/15 text-red-400 border-red-400/20" },
}

export default function CitizenProfilePage() {
  const params = useParams()
  const router = useRouter()
  const citizenId = params.id as string
  const citizen = CITIZENS[citizenId] ?? DEFAULT_CITIZEN

  const [status, setStatus] = useState(citizen.status)
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null)
  const [actionDone, setActionDone] = useState(false)

  const cfg = statusConfig[status]
  const StatusIcon = cfg.icon

  function executeAction(action: "approve" | "reject") {
    setStatus(action === "approve" ? "Verified" : "Rejected")
    setConfirmAction(null)
    setActionDone(true)
  }

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm h-16 flex items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground">{citizen.name}</h1>
            <p className="text-xs text-muted-foreground font-mono">{citizen.id}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.badge}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {status}
        </span>
      </div>

      <div className="p-4 sm:p-6 space-y-5 max-w-4xl">
        {/* Success banner */}
        {actionDone && (
          <div className={`rounded-xl border p-4 flex items-center gap-3 ${status === "Verified" ? "border-primary/30 bg-primary/10" : "border-red-400/30 bg-red-400/10"}`}>
            {status === "Verified" ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> : <XCircle className="h-5 w-5 text-red-400 shrink-0" />}
            <p className="text-sm font-medium text-foreground">Application {status === "Verified" ? "approved" : "rejected"} successfully.</p>
            <button onClick={() => setActionDone(false)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Profile card */}
          <div className="lg:col-span-1 rounded-xl border border-border bg-card p-5 text-center">
            <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
              {citizen.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <h2 className="font-bold text-foreground text-base">{citizen.name}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{citizen.id}</p>
            <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cfg.badge}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {status}
            </div>
            <div className="mt-4 pt-4 border-t border-border space-y-2 text-left text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>Registered {citizen.registered}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="text-primary font-medium">Biometrics On File</span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="h-3.5 w-3.5" /> Personal Information
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {[
                  { label: "Full Name", value: citizen.name },
                  { label: "NRC Number", value: citizen.nrc },
                  { label: "Date of Birth", value: citizen.dob },
                  { label: "Gender", value: citizen.gender },
                  { label: "Province", value: citizen.province },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                    <p className="font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> Contact Details
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
                {[
                  { label: "Email Address", value: citizen.email, icon: FileText },
                  { label: "Phone Number", value: citizen.phone, icon: Phone },
                  { label: "Province / Region", value: citizen.province, icon: MapPin },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
                    <p className="font-medium text-foreground">{item.value}</p>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground mb-0.5">Residential Address</p>
                  <p className="font-medium text-foreground">{citizen.address}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                <Fingerprint className="h-3.5 w-3.5" /> Biometric Data
              </h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-3 rounded-lg bg-secondary/50 px-4 py-3 flex-1">
                  <Camera className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Face Scan</p>
                    <p className="text-sm font-medium text-primary">Captured</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-secondary/50 px-4 py-3 flex-1">
                  <Fingerprint className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fingerprint</p>
                    <p className="text-sm font-medium text-primary">Captured</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {status === "Pending" && (
          <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-5">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground text-sm">Pending Review</p>
                <p className="text-xs text-muted-foreground mt-0.5">This application requires your review. Approve to issue the Digital ID or reject with a reason.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction("approve")} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
              <button onClick={() => setConfirmAction("reject")} className="flex-1 rounded-lg bg-destructive/80 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>
          </div>
        )}

        {status !== "Pending" && (
          <div className="flex gap-3">
            <Link href="/admin/citizens" className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" /> Back to Citizens
            </Link>
            {status === "Verified" && (
              <button onClick={() => setConfirmAction("reject")} className="rounded-lg border border-destructive/40 px-5 py-2.5 text-sm font-medium text-red-400 hover:bg-destructive/10 transition-colors flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Revoke ID
              </button>
            )}
            {status === "Rejected" && (
              <button onClick={() => setConfirmAction("approve")} className="rounded-lg border border-primary/40 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Re-approve
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4" onClick={() => setConfirmAction(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${confirmAction === "approve" ? "bg-primary/15" : "bg-red-400/15"}`}>
              {confirmAction === "approve" ? <CheckCircle2 className="h-6 w-6 text-primary" /> : <XCircle className="h-6 w-6 text-red-400" />}
            </div>
            <h3 className="font-bold text-foreground text-center mb-1">{confirmAction === "approve" ? "Approve Application" : "Reject Application"}</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              {confirmAction === "approve"
                ? `This will issue a Digital ID to ${citizen.name}.`
                : `This will reject ${citizen.name}'s application.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmAction(null)} className="flex-1 rounded-lg border border-border py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => executeAction(confirmAction)} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity ${confirmAction === "approve" ? "bg-primary" : "bg-destructive"}`}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
