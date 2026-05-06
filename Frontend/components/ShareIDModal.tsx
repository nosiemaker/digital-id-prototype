"use client"

/**
 * ShareIDModal
 *
 * A premium modal for sharing your Digital ID with two methods:
 *  1. QR Code — shows a signed QR payload that any verifier can scan
 *  2. NFC     — writes the signed payload to an NFC tag via Web NFC API
 *              (requires Chrome on Android or a compatible browser)
 */

import { useState, useEffect, useRef } from "react"
import {
  X,
  QrCode,
  Wifi,
  Shield,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react"
import QRCode from "qrcode"

interface ShareIDModalProps {
  open: boolean
  onClose: () => void
  qrPayload: any | null
  qrLoading: boolean
  onGenerateQR: () => void
  din: string | null
  name: string
}

type ShareTab = "qr" | "nfc"
type NFCState = "idle" | "scanning" | "ready" | "writing" | "success" | "error" | "unsupported"

export function ShareIDModal({
  open,
  onClose,
  qrPayload,
  qrLoading,
  onGenerateQR,
  din,
  name,
}: ShareIDModalProps) {
  const [activeTab, setActiveTab] = useState<ShareTab>("qr")
  const [nfcState, setNfcState] = useState<NFCState>("idle")
  const [nfcError, setNfcError] = useState<string | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const nfcAbortRef = useRef<AbortController | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Generate QR code image when payload is available
  useEffect(() => {
    if (!qrPayload) {
      setQrDataUrl(null)
      return
    }
    const data = typeof qrPayload === "string" ? qrPayload : JSON.stringify(qrPayload)
    QRCode.toDataURL(data, {
      width: 280,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "H",
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [qrPayload])

  // Auto-generate QR if not yet available when modal opens
  useEffect(() => {
    if (open && !qrPayload && !qrLoading) {
      onGenerateQR()
    }
  }, [open]) // eslint-disable-line

  // Clean up NFC listener when modal closes or tab changes
  useEffect(() => {
    if (!open || activeTab !== "nfc") {
      nfcAbortRef.current?.abort()
      setNfcState("idle")
      setNfcError(null)
    }
  }, [open, activeTab])

  if (!open) return null

  /* -------- NFC -------- */
  async function startNFC() {
    if (!("NDEFReader" in window)) {
      setNfcState("unsupported")
      return
    }
    setNfcState("writing")
    setNfcError(null)
    nfcAbortRef.current = new AbortController()
    try {
      const ndef = new (window as any).NDEFReader()
      const payload = qrPayload
        ? (typeof qrPayload === "string" ? qrPayload : JSON.stringify(qrPayload))
        : `zdid://${din}`

      await ndef.write(
        {
          records: [
            { recordType: "text", data: payload },
            { recordType: "url", data: `https://verify.zdid.gov.zm?din=${din}` },
          ],
        },
        { signal: nfcAbortRef.current.signal }
      )
      setNfcState("success")
    } catch (err: any) {
      if (err?.name === "AbortError") return
      setNfcState("error")
      if (err?.message?.includes("permission") || err?.message?.includes("denied") || err?.message?.includes("NotAllowedError")) {
        setNfcError("NFC access denied. Please enable NFC on your device (Settings > NFC) and grant NFC permission to this app if prompted.")
      } else {
        setNfcError(err?.message || "NFC write failed. Make sure NFC is enabled on your device and hold it near the tag.")
      }
    }
  }

  function cancelNFC() {
    nfcAbortRef.current?.abort()
    setNfcState("idle")
  }

  async function copyDIN() {
    if (!din) return
    await navigator.clipboard.writeText(din)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const tabs: { id: ShareTab; label: string; icon: React.ElementType }[] = [
    { id: "qr", label: "QR Code", icon: QrCode },
    { id: "nfc", label: "NFC Share", icon: Wifi },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Share Your Digital ID</h2>
                <p className="text-xs text-muted-foreground">{name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* DIN pill */}
          {din && (
            <div className="mx-6 mb-4 flex items-center justify-between gap-2 rounded-xl bg-secondary/50 border border-border px-4 py-2.5">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Digital ID Number</p>
                <p className="text-sm font-mono font-bold text-foreground">{din}</p>
              </div>
              <button
                onClick={copyDIN}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}

          {/* Tab switcher */}
          <div className="mx-6 mb-5 flex gap-1 rounded-xl bg-secondary/40 p-1 border border-border">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* --- QR Tab --- */}
          {activeTab === "qr" && (
            <div className="px-6 pb-6 space-y-4">
              <div className="flex flex-col items-center">
                {qrLoading ? (
                  <div className="flex flex-col items-center justify-center h-[220px] gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Generating signed QR code…</p>
                  </div>
                ) : qrDataUrl ? (
                  <div className="relative">
                    {/* QR frame */}
                    <div className="p-3 bg-white rounded-2xl shadow-lg border border-border/30">
                      <img src={qrDataUrl} alt="Digital ID QR Code" className="w-[220px] h-[220px] rounded-lg" />
                    </div>
                    {/* Zambia shield watermark */}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-primary text-primary-foreground rounded-full px-3 py-1 text-[10px] font-bold shadow-lg">
                      <Shield className="h-3 w-3" />
                      ZDID Verified
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[220px] gap-3">
                    <QrCode className="h-12 w-12 text-muted-foreground opacity-20" />
                    <p className="text-xs text-muted-foreground text-center">
                      No QR code yet.<br />Click below to generate one.
                    </p>
                  </div>
                )}
              </div>

              {/* Regenerate */}
              <button
                onClick={onGenerateQR}
                disabled={qrLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary border border-primary/20 py-2.5 text-sm font-bold hover:bg-primary/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${qrLoading ? "animate-spin" : ""}`} />
                {qrPayload ? "Regenerate QR" : "Generate QR Code"}
              </button>

              <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/10 px-4 py-3">
                <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  This QR code is cryptographically signed and expires shortly. Ask the verifier to scan it using their official ZDID scanner app.
                </p>
              </div>
            </div>
          )}

          {/* --- NFC Tab --- */}
          {activeTab === "nfc" && (
            <div className="px-6 pb-6 space-y-4">
              {/* NFC animation area */}
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <div className={`relative flex h-28 w-28 items-center justify-center rounded-full ${
                  nfcState === "writing" ? "bg-primary/10" :
                  nfcState === "success" ? "bg-green-500/10" :
                  nfcState === "error" ? "bg-destructive/10" : "bg-secondary/50"
                } border-2 ${
                  nfcState === "writing" ? "border-primary" :
                  nfcState === "success" ? "border-green-500" :
                  nfcState === "error" ? "border-destructive" : "border-border"
                } transition-all duration-500`}>
                  {/* Ripple animation when writing */}
                  {nfcState === "writing" && (
                    <>
                      <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                      <span className="absolute inset-4 rounded-full bg-primary/10 animate-ping" style={{ animationDelay: "0.2s" }} />
                    </>
                  )}
                  {nfcState === "success" ? (
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                  ) : nfcState === "error" || nfcState === "unsupported" ? (
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                  ) : (
                    <Wifi className={`h-12 w-12 ${nfcState === "writing" ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                  )}
                </div>

                {/* Status text */}
                <div className="text-center">
                  {nfcState === "idle" && (
                    <>
                      <p className="text-sm font-bold text-foreground">NFC ID Share</p>
                      <p className="text-xs text-muted-foreground mt-1">Tap your phone against another device to share your Digital ID instantly.</p>
                    </>
                  )}
                  {nfcState === "writing" && (
                    <>
                      <p className="text-sm font-bold text-primary">Hold Near Device…</p>
                      <p className="text-xs text-muted-foreground mt-1">Keep your device close to the NFC reader or another phone.</p>
                    </>
                  )}
                  {nfcState === "success" && (
                    <>
                      <p className="text-sm font-bold text-green-500">ID Shared Successfully!</p>
                      <p className="text-xs text-muted-foreground mt-1">Your Digital ID has been transferred via NFC.</p>
                    </>
                  )}
                  {nfcState === "error" && (
                    <>
                      <p className="text-sm font-bold text-destructive">NFC Error</p>
                      <p className="text-xs text-muted-foreground mt-1">{nfcError}</p>
                    </>
                  )}
                  {nfcState === "unsupported" && (
                    <>
                      <p className="text-sm font-bold text-amber-400">NFC Not Available</p>
                      <p className="text-xs text-muted-foreground mt-1">Your browser or device doesn't support Web NFC. Use Chrome on an Android device with NFC enabled.</p>
                    </>
                  )}
                </div>
              </div>

              {/* Action button */}
              {nfcState === "idle" || nfcState === "error" || nfcState === "success" ? (
                <button
                  onClick={startNFC}
                  disabled={!din}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Wifi className="h-4 w-4" />
                  {nfcState === "success" ? "Share Again" : "Start NFC Share"}
                </button>
              ) : nfcState === "writing" ? (
                <button
                  onClick={cancelNFC}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary text-foreground border border-border py-3 text-sm font-bold hover:bg-secondary/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              ) : null}

              {nfcState === "unsupported" && (
                <button
                  onClick={() => setActiveTab("qr")}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary border border-primary/20 py-2.5 text-sm font-bold hover:bg-primary/20 transition-colors"
                >
                  <QrCode className="h-4 w-4" />
                  Use QR Code Instead
                </button>
              )}

              <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/10 px-4 py-3">
                <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  NFC sharing uses the Web NFC API (Chrome on Android). Your ID data is cryptographically signed and cannot be forged.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
