"use client"
import { QRCodeCanvas as QRCode } from "qrcode.react"
import { Loader2, QrCode as QrCodeIcon, Copy, RefreshCw, Share2, FileText } from "lucide-react"
import type { DigitalIDPayload as ApiDigitalIDPayload, QRPayload as ApiQRPayload } from "@/lib/axios"

interface DigitalIDCardProps {
  me: { name?: string; citizen_din?: string | null } | null
  digitalID: ApiDigitalIDPayload | null
  qrPayload: ApiQRPayload | null
  loading: boolean
  onFlip: () => void
  flipped: boolean
  onGenerateQR: () => void
  qrLoading: boolean
}

// ─── Utility Helpers ────────────────────────────────────────────────────────
// NOTE: As requested, moving getCitizenType to the backend is highly recommended 
// for a Single Source of Truth. Kept here for frontend fallback.
const calculateAge = (dob: string): number => {
  const birthDate = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--
  return age
}

const getCitizenType = (dob: string, citizenType?: string): string => {
  if (citizenType) return citizenType
  const age = calculateAge(dob)
  if (age < 16) return "CHILD_UNDER_16"
  if (age < 18) return "CHILD_ABOVE_16"
  if (age < 65) return "ADULT"
  return "SENIOR"
}

const formatCitizenType = (type: string): string => {
  switch (type) {
    case "CHILD_UNDER_16": return "Child (Under 16)"
    case "CHILD_ABOVE_16": return "Youth (16-17)"
    case "ADULT": return "Adult"
    case "SENIOR": return "Senior Citizen"
    default: return type
  }
}

// ─── Inline SVG Assets ──────────────────────────────────────────────────────
const ZambianEagleIcon = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 64 64" fill="none" className={className} style={style} aria-label="Zambian Coat of Arms / Fish Eagle">
    <path d="M32 8C24 8 16 14 14 22C12 30 18 38 26 40C20 44 14 46 12 50C10 54 16 58 24 56C28 55 32 52 32 48C32 52 36 55 40 56C48 58 54 54 52 50C50 46 44 44 38 40C46 38 52 30 50 22C48 14 40 8 32 8Z" fill="currentColor" opacity="0.9"/>
    <path d="M28 20L24 28L32 24L40 28L36 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="32" cy="32" r="4" fill="#C3B091"/>
  </svg>
)

const GuillochePattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" aria-hidden="true">
    <defs>
      <pattern id="guilloche" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
        <circle cx="60" cy="60" r="40" fill="none" stroke="#C3B091" strokeWidth="0.5"/>
        <circle cx="60" cy="60" r="30" fill="none" stroke="#C3B091" strokeWidth="0.5"/>
        <path d="M10 60 Q 60 10 110 60 T 60 110" fill="none" stroke="#C3B091" strokeWidth="0.5"/>
        <path d="M110 60 Q 60 110 10 60 T 60 10" fill="none" stroke="#C3B091" strokeWidth="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#guilloche)"/>
  </svg>
)

// ─── Component ──────────────────────────────────────────────────────────────
export default function DigitalIDCard({
  me, digitalID, qrPayload, loading, onFlip, flipped, onGenerateQR, qrLoading
}: DigitalIDCardProps) {
  
  const qrData = qrPayload ? JSON.stringify({
    din: qrPayload.din, name: qrPayload.name, nonce: qrPayload.nonce, exp: qrPayload.exp, sig: qrPayload.sig
  }) : ""

  const initials = me?.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "EC"
  const displayName = me?.name || digitalID?.full_name || "Unknown Citizen"
  const din = me?.citizen_din || digitalID?.din || "--------"
  const status = digitalID?.status || "ACTIVE"
  const province = digitalID?.province || "Lusaka"
  const gender = digitalID?.gender || "—"
  const faceImageUrl = digitalID?.face_image_url
  const dob = digitalID?.dob || ""
  const citizenType = getCitizenType(dob, digitalID?.citizen_type)
  const formattedCitizenType = formatCitizenType(citizenType)

  const handleFlip = () => {
    onFlip()
    if (navigator.vibrate) navigator.vibrate(15) // Tactile feedback
  }

  const handleCopyDIN = () => {
    if (navigator.clipboard?.writeText && din) {
      navigator.clipboard.writeText(din)
      if (navigator.vibrate) navigator.vibrate(10)
    }
  }

  const handleShareID = () => {
    // TODO: Connect to backend to generate secure PDF/temp link
    alert("Generating secure verification link...")
    if (navigator.vibrate) navigator.vibrate(15)
  }

  // ─── Earthy Palette Constants ──────────────────────────────────────────────
  const c = {
    bg: "#0F1110",         // Deep Charcoal
    cardBg: "#141614",     // Dark Slate
    border: "#2E4739",     // Forest Green
    accent: "#4B7A5A",     // Readable Forest Green
    label: "#C3B091",      // Warm Khaki/Stone
    text: "#E2E8E4",       // Soft White
    muted: "#6B7A6F"       // Muted Earth
  }

  // ─── Loading Skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full max-w-xl mx-auto space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map(i => (
            <div key={i} className="bg-[#1a1c1a] border border-[#2a302a] rounded-xl h-16" />
          ))}
        </div>
        <div className="bg-[#141614] border border-[#2E4739] rounded-[22px] aspect-[85.6/53.98] w-full p-6 flex flex-col gap-4">
          <div className="h-4 w-32 bg-[#1e2220] rounded" />
          <div className="flex gap-4 items-center">
            <div className="w-20 h-20 rounded-full bg-[#1e2220]" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-3/4 bg-[#1e2220] rounded" />
              <div className="h-3 w-1/2 bg-[#1e2220] rounded" />
              <div className="h-3 w-2/3 bg-[#1e2220] rounded mt-4" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Stats Strip */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Status", value: status === "ACTIVE" ? "Active" : status, color: c.accent, ping: status === "ACTIVE" },
          { label: "Citizen Type", value: formattedCitizenType, color: c.accent, ping: false }
        ].map((stat, i) => (
          <div key={i} className="bg-[#111311] border border-[#2a302a] rounded-xl p-3">
            <div className="text-[11px] text-[#5a6a5a] uppercase tracking-widest mb-1">{stat.label}</div>
            <div className="text-sm font-semibold flex items-center gap-1.5" style={{ color: stat.color }}>
              {stat.ping && (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: stat.color }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: stat.color }} />
                </span>
              )}
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <span className="text-[11px] uppercase tracking-widest" style={{ color: c.muted }}>Tap card to flip</span>
      </div>

      {/* Vault Housing */}
      <div className="relative w-full rounded-[22px] p-2.5" style={{ background: `linear-gradient(145deg, ${c.cardBg}, #0a0c0b)` }}>
        <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-[140px] h-[3px] rounded-b-md" style={{ background: `linear-gradient(90deg, transparent, ${c.border}, transparent)` }} />
        
        <div className="flex items-center justify-center gap-2 mb-3 mt-1">
          <div className="h-px flex-1 rounded-full" style={{ backgroundColor: "#1e2a22" }} />
          <div className="w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-[0_0_12px_rgba(46,71,57,0.3)]" style={{ borderColor: c.border, background: "#0d1410" }}>
            <ZambianEagleIcon className="h-5 w-5" style={{ color: c.accent }} />
          </div>
          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold" style={{ color: c.accent }}>Republic of Zambia</span>
          <div className="h-px flex-1 rounded-full" style={{ backgroundColor: "#1e2a22" }} />
        </div>

        {/* Card Body */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: "85.6 / 53.98", background: c.bg }}>
          <GuillochePattern />
          <div className="absolute top-0 left-0 right-0 h-0.5 opacity-40 rounded-t-2xl" style={{ background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)` }} />

          <div className="w-full h-full cursor-pointer" style={{ perspective: "1400px" }} onClick={handleFlip}>
            <div
              className="relative w-full h-full"
              style={{
                transformStyle: "preserve-3d",
                transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)"
              }}
            >
              
              {/* FRONT FACE */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden" style={{ backfaceVisibility: "hidden", background: c.bg, border: `1px solid ${c.border}` }}>
                <div className="h-full flex flex-col justify-between p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center border" style={{ background: "#0d1410", borderColor: c.border }}>
                        <ZambianEagleIcon className="h-4 w-4" style={{ color: c.accent }} />
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold" style={{ color: c.accent }}>Republic of Zambia</div>
                        <div className="text-[9px] uppercase tracking-[0.08em]" style={{ color: c.muted }}>National Digital Identity Authority</div>
                      </div>
                    </div>
                  </div>

                  {/* Main Info */}
                  <div className="flex items-center gap-3.5 mt-1">
                    <div className="relative w-[70px] h-[70px] shrink-0">
                      <div className="absolute -inset-[2px] rounded-full border-2 animate-pulse" style={{ borderColor: c.accent, animationDuration: "3s" }} />
                      <div className="absolute inset-[2px] rounded-full overflow-hidden flex items-center justify-center" style={{ background: "#0d1410", border: `1px solid ${c.border}` }}>
                        {faceImageUrl ? (
                          <img 
                            src={faceImageUrl} 
                            alt={displayName} 
                            className="w-full h-full object-cover" 
                            loading="eager" 
                            decoding="async"
                          />
                        ) : (
                          <span className="text-2xl font-bold tracking-tight" style={{ color: c.accent }}>{initials}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-2xl font-bold uppercase tracking-wide leading-tight" style={{ color: c.text }}>{displayName}</div>
                      <div className="text-[11px] mt-0.5 tracking-wide" style={{ color: c.muted }}>
                        {formattedCitizenType} · {province}
                      </div>
                    </div>
                  </div>

                  {/* Hero DIN & Meta */}
                  <div className="mt-2">
                    <div className="text-[10px] uppercase tracking-[0.12em] mb-1" style={{ color: c.muted }}>Digital ID Number (DIN)</div>
                    <div className="text-xl font-semibold tracking-wider font-mono" style={{ color: c.accent }}>{din}</div>
                  </div>

                  <div className="flex justify-between items-end mt-auto">
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Date of Birth", val: dob ? new Date(dob).toLocaleDateString("en-GB") : "—" },
                        { label: "Gender", val: gender },
                        { label: "Issue Date", val: digitalID?.issued_at ? new Date(digitalID.issued_at).toLocaleDateString("en-GB") : "—" }
                      ].map((field, i) => (
                        <div key={i}>
                          <div className="text-[10px] uppercase tracking-[0.12em]" style={{ color: c.muted }}>{field.label}</div>
                          <div className="text-[11px] font-medium mt-px" style={{ color: c.text }}>{field.val}</div>
                        </div>
                      ))}
                    </div>
                    {/* Security Micro-strip */}
                    <div className="w-8 h-4 rounded border flex gap-0.5 p-1" style={{ borderColor: `${c.border}50`, background: "#0a0c0b" }}>
                      {[0,1,2,3].map(i => <div key={i} className="w-1.5 h-2 rounded-[1px]" style={{ background: c.border }} />)}
                    </div>
                  </div>
                </div>
              </div>

              {/* BACK FACE */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#0a0c0b", border: `1px solid ${c.border}` }}>
                <div className="h-full flex flex-col p-4 gap-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: c.muted }}>ZM-GOV-DID · Secure Document</span>
                    <span className="text-[10px] tracking-wide" style={{ color: c.muted }}>v2.4.1</span>
                  </div>
                  
                  <div className="flex gap-4 items-start flex-1">
                    <div className="shrink-0">
                      <div className="text-[11px] uppercase tracking-[0.1em] mb-2" style={{ color: c.muted }}>Scan to verify identity</div>
                      {qrPayload ? (
                        <QRCode value={qrData} size={100} level="H" includeMargin={true} bgColor="#ffffff" fgColor="#0F1110" className="rounded-lg border-2" style={{ borderColor: c.border }} />
                      ) : (
                        <div className="w-[100px] h-[100px] bg-[#E2E8E4] rounded-lg border flex items-center justify-center" style={{ borderColor: c.border }}>
                          <Loader2 className="h-6 w-6 animate-spin" style={{ color: c.accent }} />
                        </div>
                      )}
                      {qrPayload && (
                        <div className="text-[9px] font-mono truncate w-[100px] mt-1" style={{ color: c.muted }}>
                          Exp: {new Date(qrPayload.exp * 1000).toLocaleTimeString()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-2 justify-center">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.1em]" style={{ color: c.muted }}>Issued by</div>
                        <div className="text-sm font-medium mt-px" style={{ color: c.text }}>Dept. of National Registration</div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-2 flex justify-between items-center mt-auto" style={{ borderColor: `${c.border}30` }}>
                    <span className="text-[9px] uppercase tracking-[0.1em]" style={{ color: c.muted }}>Tamper-evident</span>
                    <ZambianEagleIcon className="h-4 w-4" style={{ color: c.accent }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { icon: <Share2 className="h-4 w-4" />, label: "Share ID", onClick: handleShareID },
          { icon: <Copy className="h-4 w-4" />, label: "Copy DIN", onClick: handleCopyDIN },
          { icon: <FileText className="h-4 w-4" />, label: "Export PDF", onClick: () => alert("PDF Generation triggered") },
          { 
            icon: qrLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <QrCodeIcon className="h-4 w-4" />, 
            label: qrPayload ? "Refresh QR" : "Generate QR", 
            onClick: onGenerateQR, 
            disabled: qrLoading 
          }
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.onClick}
            disabled={btn.disabled}
            className="bg-[#141614] border rounded-xl py-3 px-1.5 text-center transition-all active:scale-95 disabled:opacity-40"
            style={{ borderColor: `${c.border}60` }}
          >
            <div className="mb-1.5 flex justify-center" style={{ color: c.muted }}>{btn.icon}</div>
            <div className="text-[10px]" style={{ color: c.muted }}>{btn.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}