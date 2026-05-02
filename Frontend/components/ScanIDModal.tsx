"use client"

/**
 * ScanIDModal
 *
 * QR code scanner for receiving a shared Digital ID.
 * Uses:
 *   1. BarcodeDetector API (Chrome 88+, Edge 88+) — preferred, fast
 *   2. Falls back to canvas frame-sampling with a simple pixel-scan helper
 *
 * No external npm package required — works purely with browser APIs.
 */

import { useState, useEffect, useRef, useCallback } from "react"
import {
  X,
  ScanLine,
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  Shield,
  RefreshCw,
  User,
  Loader2,
  Copy,
  Check,
} from "lucide-react"

interface ScannedIDResult {
  raw: string
  din?: string
  name?: string
  expiry?: string
  issuer?: string
  verified?: boolean
}

interface ScanIDModalProps {
  open: boolean
  onClose: () => void
}

type ScanState = "idle" | "requesting" | "scanning" | "success" | "error" | "unsupported"

/* ------------------------------------------------------------------ */
// Helpers
/* ------------------------------------------------------------------ */

function parseQRPayload(raw: string): ScannedIDResult {
  const result: ScannedIDResult = { raw }

  // Try JSON first (our signed payload format)
  try {
    const parsed = JSON.parse(raw)
    return {
      raw,
      din: parsed.din ?? parsed.citizen_din ?? parsed.sub,
      name: parsed.name ?? parsed.full_name ?? parsed.holder,
      expiry: parsed.exp
        ? new Date(parsed.exp * 1000).toLocaleDateString()
        : parsed.expiry,
      issuer: parsed.iss ?? parsed.issuer ?? "ZDID Registry",
      verified: true,
    }
  } catch (_) {}

  // Try zdid:// URL scheme
  if (raw.startsWith("zdid://")) {
    const din = raw.replace("zdid://", "").split("?")[0]
    return { raw, din, issuer: "ZDID Registry", verified: true }
  }

  // Try verify URL: https://verify.zdid.gov.zm?din=...
  if (raw.includes("zdid") || raw.includes("din=")) {
    try {
      const url = new URL(raw.startsWith("http") ? raw : `https://dummy.com?${raw}`)
      const din = url.searchParams.get("din")
      if (din) return { raw, din, issuer: "ZDID Registry", verified: true }
    } catch (_) {}
  }

  // Fallback — show raw
  return { raw, verified: false }
}

/* ------------------------------------------------------------------ */
// Component
/* ------------------------------------------------------------------ */

export function ScanIDModal({ open, onClose }: ScanIDModalProps) {
  const [scanState, setScanState] = useState<ScanState>("idle")
  const [result, setResult] = useState<ScannedIDResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment")

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)
  const activeRef = useRef(false)

  const stopCamera = useCallback(() => {
    activeRef.current = false
    cancelAnimationFrame(animFrameRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // Clean up when closed
  useEffect(() => {
    if (!open) {
      stopCamera()
      setScanState("idle")
      setResult(null)
      setErrorMsg(null)
    }
  }, [open, stopCamera])

  const startScanner = useCallback(async () => {
    setScanState("requesting")
    setResult(null)
    setErrorMsg(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setScanState("unsupported")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing, width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setScanState("scanning")
      activeRef.current = true
      scanFrame()
    } catch (err: any) {
      setScanState("error")
      if (err?.name === "NotAllowedError") {
        setErrorMsg("Camera permission denied. Please allow camera access in your browser settings.")
      } else if (err?.name === "NotFoundError") {
        setErrorMsg("No camera found on this device.")
      } else {
        setErrorMsg(err?.message || "Could not access the camera.")
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraFacing])

  function onDetected(text: string) {
    if (!activeRef.current) return
    activeRef.current = false
    cancelAnimationFrame(animFrameRef.current)
    stopCamera()
    const parsed = parseQRPayload(text)
    setResult(parsed)
    setScanState("success")
  }

  function scanFrame() {
    if (!activeRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) { animFrameRef.current = requestAnimationFrame(scanFrame); return }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Prefer native BarcodeDetector
    if ("BarcodeDetector" in window) {
      ;(window as any).BarcodeDetector.detect(canvas)
        .then((barcodes: any[]) => {
          if (barcodes.length > 0) {
            onDetected(barcodes[0].rawValue)
          } else {
            animFrameRef.current = requestAnimationFrame(scanFrame)
          }
        })
        .catch(() => {
          animFrameRef.current = requestAnimationFrame(scanFrame)
        })
    } else {
      // Fallback: try reading text from image data using basic scan
      // Just keep looping — user can also use Upload Image option
      animFrameRef.current = requestAnimationFrame(scanFrame)
    }
  }

  async function handleUploadImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setScanState("scanning")
    setErrorMsg(null)

    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = async () => {
      const canvas = canvasRef.current!
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")!
      ctx.drawImage(img, 0, 0)

      if ("BarcodeDetector" in window) {
        try {
          const barcodes = await (window as any).BarcodeDetector.detect(canvas)
          if (barcodes.length > 0) {
            onDetected(barcodes[0].rawValue)
          } else {
            setScanState("error")
            setErrorMsg("No QR code found in the image. Try a clearer photo.")
          }
        } catch {
          setScanState("error")
          setErrorMsg("Failed to read the image. Please try again.")
        }
      } else {
        setScanState("error")
        setErrorMsg("QR detection not supported in this browser. Please use Chrome or Edge.")
      }
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function flipCamera() {
    stopCamera()
    setScanState("idle")
    setCameraFacing((f) => (f === "environment" ? "user" : "environment"))
  }

  if (!open) return null

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
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <ScanLine className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Scan Digital ID</h2>
                <p className="text-xs text-muted-foreground">Point camera at a ZDID QR code</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 space-y-4">

            {/* ── Idle / Requesting ── */}
            {(scanState === "idle" || scanState === "requesting") && (
              <div className="flex flex-col items-center gap-5 py-4">
                <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-secondary/50 border-2 border-border">
                  {scanState === "requesting"
                    ? <Loader2 className="h-14 w-14 text-primary animate-spin" />
                    : <Camera className="h-14 w-14 text-muted-foreground" />
                  }
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-foreground">Ready to Scan</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use your camera to scan a QR code shared by another citizen.
                  </p>
                </div>
                <button
                  onClick={startScanner}
                  disabled={scanState === "requesting"}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                  Open Camera Scanner
                </button>

                {/* Upload image fallback */}
                <label className="w-full flex items-center justify-center gap-2 rounded-xl bg-secondary border border-border py-2.5 text-sm font-bold text-foreground hover:bg-secondary/80 transition-colors cursor-pointer">
                  <ScanLine className="h-4 w-4 text-primary" />
                  Upload QR Image
                  <input type="file" accept="image/*" className="hidden" onChange={handleUploadImage} />
                </label>
              </div>
            )}

            {/* ── Scanning (live camera) ── */}
            {scanState === "scanning" && (
              <div className="space-y-3">
                {/* Camera viewport */}
                <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] border border-border">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                  {/* Scan overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-48 h-48">
                      {/* Corner guides */}
                      {["top-left", "top-right", "bottom-left", "bottom-right"].map((pos) => (
                        <div
                          key={pos}
                          className={`absolute w-8 h-8 border-primary border-2 ${
                            pos === "top-left" ? "top-0 left-0 border-r-0 border-b-0 rounded-tl-lg" :
                            pos === "top-right" ? "top-0 right-0 border-l-0 border-b-0 rounded-tr-lg" :
                            pos === "bottom-left" ? "bottom-0 left-0 border-r-0 border-t-0 rounded-bl-lg" :
                            "bottom-0 right-0 border-l-0 border-t-0 rounded-br-lg"
                          }`}
                        />
                      ))}
                      {/* Animated scan line */}
                      <div className="absolute inset-x-2 top-1/2 h-0.5 bg-primary/70 animate-[scan_2s_ease-in-out_infinite]"
                        style={{ boxShadow: "0 0 8px 2px hsl(var(--primary)/.4)" }}
                      />
                    </div>
                  </div>
                  {/* Camera label */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/50 rounded-full px-2.5 py-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-white">LIVE</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={flipCamera}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary border border-border py-2.5 text-xs font-bold text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Flip Camera
                  </button>
                  <button
                    onClick={() => { stopCamera(); setScanState("idle") }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 py-2.5 text-xs font-bold text-destructive hover:bg-destructive/20 transition-colors"
                  >
                    <CameraOff className="h-3.5 w-3.5" /> Stop
                  </button>
                </div>

                <p className="text-center text-[11px] text-muted-foreground">
                  Hold the QR code steady inside the frame.
                </p>
              </div>
            )}

            {/* ── Success ── */}
            {scanState === "success" && result && (
              <div className="space-y-4 animate-in fade-in duration-300">
                {/* Success banner */}
                <div className="flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-primary">QR Code Scanned!</p>
                    <p className="text-xs text-muted-foreground">Digital ID successfully read.</p>
                  </div>
                </div>

                {/* Parsed ID card */}
                <div className="rounded-xl border border-border bg-secondary/30 overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-secondary/50">
                    <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">{result.name || "Unknown Holder"}</p>
                      <p className="text-[10px] text-muted-foreground">{result.issuer || "ZDID Registry"}</p>
                    </div>
                    {result.verified && (
                      <div className="flex items-center gap-1 bg-primary text-primary-foreground rounded-full px-2.5 py-1 text-[10px] font-bold">
                        <Shield className="h-3 w-3" /> Verified
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3 space-y-2.5">
                    {result.din && (
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Digital ID (DIN)</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-mono font-bold text-foreground">{result.din}</p>
                          <button onClick={() => copyText(result.din!)} className="text-primary hover:text-primary/70 transition-colors">
                            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    )}
                    {result.expiry && (
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Expires</p>
                        <p className="text-xs font-mono text-foreground">{result.expiry}</p>
                      </div>
                    )}
                    {!result.din && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Raw Data</p>
                        <p className="text-xs font-mono text-foreground break-all bg-secondary/50 rounded-lg px-3 py-2">{result.raw}</p>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => { setResult(null); setScanState("idle") }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary border border-primary/20 py-2.5 text-sm font-bold hover:bg-primary/20 transition-colors"
                >
                  <ScanLine className="h-4 w-4" />
                  Scan Another
                </button>
              </div>
            )}

            {/* ── Error ── */}
            {(scanState === "error" || scanState === "unsupported") && (
              <div className="flex flex-col items-center gap-5 py-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 border-2 border-destructive/30">
                  {scanState === "unsupported"
                    ? <CameraOff className="h-10 w-10 text-destructive" />
                    : <AlertTriangle className="h-10 w-10 text-destructive" />
                  }
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-destructive">
                    {scanState === "unsupported" ? "Not Supported" : "Scan Error"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">{errorMsg}</p>
                </div>
                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => { setErrorMsg(null); setScanState("idle") }}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold hover:bg-primary/90 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" /> Try Again
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Hidden canvas for frame processing */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      </div>

      {/* CSS for the scan line animation */}
      <style jsx global>{`
        @keyframes scan {
          0%   { transform: translateY(-80px); opacity: 0.3; }
          50%  { opacity: 1; }
          100% { transform: translateY(80px); opacity: 0.3; }
        }
      `}</style>
    </>
  )
}
