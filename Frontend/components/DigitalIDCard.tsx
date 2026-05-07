"use client"
import { QRCodeCanvas as QRCode } from "qrcode.react"
import { Loader2 } from "lucide-react"
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

const ZambiaOfficialSeal = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`rounded-full overflow-hidden border flex items-center justify-center bg-white ${className}`} style={{ ...style, borderColor: style?.borderColor }}>
    {/* ZAMREN Logo */}
    <img
      src="/assets/zamren_logo.png"
      alt="ZAMREN Logo"
      className="w-full h-full object-contain p-0.5"
    />
  </div>
)

const CoatOfArmsWatermark = () => (
  <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none z-0 select-none">
    {/* Image 0: The Coat of Arms */}
    <img
      src="/assets/coat_of_arm.png"
      alt="Zambia Coat of Arms Watermark"
      className="w-[80%] h-[80%] grayscale"
    />
  </div>
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
    if (navigator.vibrate) navigator.vibrate(15)
  }
  const handleCopyDIN = () => {
    if (navigator.clipboard?.writeText && din) {
      navigator.clipboard.writeText(din)
      if (navigator.vibrate) navigator.vibrate(10)
    }
  }
  const handleShareID = () => {
    alert("Generating secure verification link...")
    if (navigator.vibrate) navigator.vibrate(15)
  }

  // ─── Earthy-Utilitarian Palette ──────────────────────────────────────────
  // UPDATED: Deep Slate Olive, Light Khaki, Olive Drab
  const c = {
    bg: "#161D19",         // Deep Slate Olive
    cardBg: "#0F1110",     // Darker background for contrast
    border: "#2E4739",     // Forest Green
    accent: "#4B5320",     // Olive Drab (Official Color)
    label: "#D4C9B0",      // Light Khaki
    text: "#E2E8E4",       // Soft White
    muted: "#6B7A6F"       // Muted Earth
  }

  // ─── Loading Skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full max-w-xl mx-auto space-y-4 animate-pulse px-4 sm:px-0">
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map(i => (
            <div key={i} className="bg-[#1a1c1a] border border-[#2a302a] rounded-xl h-16" />
          ))}
        </div>
        <div className="bg-[#141614] border border-[#2E4739] rounded-[22px] aspect-[85.6/53.98] w-full p-5 flex flex-col gap-4">
          <div className="h-4 w-32 bg-[#1e2220] rounded" />
          <div className="flex gap-4 items-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#1e2220] shrink-0" />
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
    <div className="w-full max-w-xl mx-auto space-y-4 px-4 sm:px-0">
      <div className="text-center">
        <span className="text-[11px] uppercase tracking-widest font-bold animate-pulse" style={{ color: c.accent }}>Tap card to flip</span>
      </div>

      {/* Vault Housing */}
      <div className="relative w-full rounded-[22px] p-2.5" style={{ background: `linear-gradient(145deg, ${c.cardBg}, #0a0c0b)` }}>
        <div className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-[140px] h-[3px] rounded-b-md" style={{ background: `linear-gradient(90deg, transparent, ${c.border}, transparent)` }} />

        <div className="flex items-center justify-center gap-2 mb-3 mt-1">
          <div className="h-px flex-1 rounded-full" style={{ backgroundColor: "#1e2a22" }} />

          {/* UPDATED: Official Seal instead of generic icon */}
          <div className="w-10 h-10 rounded-full border-2 shadow-[0_0_12px_rgba(75,83,32,0.2)] overflow-hidden flex items-center justify-center" style={{ borderColor: c.accent, background: "#0d1410" }}>
            <ZambiaOfficialSeal className="w-full h-full" style={{ borderColor: c.accent }} />
          </div>

          <span className="text-[11px] uppercase tracking-[0.12em] font-semibold" style={{ color: c.accent }}>Republic of Zambia</span>
          <div className="h-px flex-1 rounded-full" style={{ backgroundColor: "#1e2a22" }} />
        </div>

        {/* Card Body — fixed aspect on desktop, min-height adaptive on mobile */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: "85.6 / 53.98", background: c.bg }}>
          <div className="absolute top-0 left-0 right-0 h-0.5 opacity-40 rounded-t-2xl" style={{ background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)` }} />

          <div className="w-full h-full cursor-pointer select-none active:scale-[0.98] transition-transform duration-100" style={{ perspective: "1400px" }} onClick={handleFlip}>
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

                {/* Chitenge Watermark */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                  <svg width="100%" height="100%">
                    <pattern id="card-chitenge" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M0 20 L10 0 L20 20 L10 40 Z" fill="none" stroke={c.accent} strokeWidth="0.5" />
                      <circle cx="10" cy="20" r="3" fill="none" stroke={c.accent} strokeWidth="0.3" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#card-chitenge)" />
                  </svg>
                </div>
                <CoatOfArmsWatermark />

                <div className="h-full flex flex-col justify-between p-3 sm:p-4 relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center border overflow-hidden shadow-sm" style={{ background: "#0d1410", borderColor: c.border }}>
                        <ZambiaOfficialSeal className="w-full h-full" />
                      </div>
                      <div>
                        <div className="text-[10px] sm:text-[11px] uppercase tracking-[0.14em] font-bold" style={{ color: c.accent }}>Republic of Zambia</div>
                        <div className="text-[8px] sm:text-[9px] uppercase tracking-[0.08em]" style={{ color: c.muted }}>National Digital Identity Authority</div>
                      </div>
                    </div>
                  </div>

                  {/* Photo & NFC Row */}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-3">
                      <div className="relative w-[56px] h-[56px] sm:w-[68px] sm:h-[68px] shrink-0">
                        <div className="absolute -inset-[2px] rounded-full border-2 animate-pulse" style={{ borderColor: c.accent, animationDuration: "3s" }} />
                        <div className="absolute inset-[2px] rounded-full overflow-hidden flex items-center justify-center" style={{ background: "#0d1410", border: `1px solid ${c.border}` }}>
                          {faceImageUrl ? (
                            <img src={faceImageUrl} alt={displayName} className="w-full h-full object-cover" loading="eager" decoding="async" />
                          ) : (
                            <span className="text-lg sm:text-2xl font-bold tracking-tight" style={{ color: c.accent }}>{initials}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-[0.1em]" style={{ color: c.label }}>Status</div>
                      <div className="text-[11px] font-bold text-primary flex items-center justify-end gap-1">
                        <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
                        {status}
                      </div>

                      {/* NFC Icon below status using the provided image */}
                      <div className="flex items-center justify-end mt-2 opacity-80">
                        <img
                          src="/assets/nfc_icon.png"
                          alt="NFC"
                          className="h-10 w-auto grayscale invert brightness-200"
                          style={{ opacity: 0.9 }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Name and DIN */}
                  <div className="mt-1 sm:mt-2">
                    <div className="text-sm sm:text-sm font-bold uppercase tracking-wide text-foreground truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
                      {displayName}
                    </div>

                    <div className="flex items-center justify-between mt-0.5 sm:mt-1">
                      <div>
                        <div className="text-[8px] sm:text-[9px] uppercase tracking-[0.12em] mb-0.5"
                          style={{ color: c.label }}>
                          Digital ID Number (DIN)
                        </div>
                        <div
                          className="text-sm sm:text-xl font-bold tracking-wider font-mono"
                          style={{ color: c.accent, textShadow: "0 1px 1px rgba(0,0,0,0.8)" }}>
                          {din}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-end mt-auto">
                    <div className="flex gap-3 sm:gap-6">
                      <div className="flex items-baseline gap-1.5">
                        <div className="text-[8px] sm:text-[9px] uppercase tracking-[0.12em] shrink-0" style={{ color: c.label }}>Issue Date</div>
                        <div className="text-[9px] sm:text-[11px] font-medium truncate" style={{ color: c.text }}>{digitalID?.issued_at ? new Date(digitalID.issued_at).toLocaleDateString("en-GB") : "—"}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BACK FACE */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-inner" style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", background: "#0a0c0b", border: `1px solid ${c.border}` }}>
                <div className="h-full flex flex-col p-3 sm:p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-1.5">
                      <ZambiaOfficialSeal className="h-4 w-4" />
                      <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color: c.muted }}>ZM-GOV-DID · Secure Payload</span>
                    </div>
                    <span className="text-[9px] tracking-wide" style={{ color: c.muted }}>v2.4.1</span>
                  </div>

                  <div className="flex gap-3 items-start flex-1">
                    <div className="shrink-0 flex flex-col items-center">
                      <div className="text-[9px] uppercase tracking-[0.1em] mb-1.5" style={{ color: c.muted }}>Scan to verify</div>
                      {qrPayload ? (
                        <div className="p-1 bg-white rounded-lg border shadow-lg" style={{ borderColor: c.border }}>
                          <QRCode value={qrData} size={75} level="H" includeMargin={false} bgColor="#ffffff" fgColor="#0F1110" />
                        </div>
                      ) : (
                        <div className="w-[75px] h-[75px] bg-[#E2E8E4] rounded-lg border flex items-center justify-center" style={{ borderColor: c.border }}>
                          <Loader2 className="h-5 w-5 animate-spin" style={{ color: c.accent }} />
                        </div>
                      )}
                      {qrPayload && (
                        <div className="text-[8px] font-mono mt-1 opacity-50" style={{ color: c.muted }}>
                          TTL: {Math.floor((qrPayload.exp - Date.now() / 1000))}s
                        </div>
                      )}
                    </div>

                    <div className="flex-1 grid grid-cols-1 gap-2">
                      <div className="space-y-2">
                        <div>
                          <div className="text-[9px] uppercase tracking-[0.12em]" style={{ color: c.label }}>Full Legal Name</div>
                          <div className="text-xs font-semibold text-foreground truncate">{displayName}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[9px] uppercase tracking-[0.12em]" style={{ color: c.label }}>NRC Number</div>
                            <div className="text-[11px] font-medium text-foreground">{digitalID?.nrc || "—"}</div>
                          </div>
                          <div>
                            <div className="text-[9px] uppercase tracking-[0.12em]" style={{ color: c.label }}>Gender</div>
                            <div className="text-[11px] font-medium text-foreground">{gender}</div>
                          </div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase tracking-[0.12em]" style={{ color: c.label }}>Place of Issue</div>
                          <div className="text-[11px] font-medium text-foreground">{province} Province, ZM</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-2 mt-auto flex flex-col gap-1.5" style={{ borderColor: `${c.border}30` }}>
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[8px] uppercase tracking-[0.1em] mb-0.5" style={{ color: c.muted }}>Secure Signature Hash</div>
                        <div className="text-[8px] font-mono truncate max-w-[140px] sm:max-w-[200px]" style={{ color: c.accent }}>
                          {digitalID?.signature}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] uppercase tracking-[0.1em]" style={{ color: c.muted }}>Tamper-evident</span>
                        <div className="h-2 w-2 rounded-full bg-primary/20 animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}