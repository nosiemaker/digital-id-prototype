"use client"

import Link from "next/link"
import { useState } from "react"
import { Shield, Search, CheckCircle2, XCircle, ScanLine, ArrowLeft, User, Calendar, MapPin, Fingerprint } from "lucide-react"
import { Logo } from "@/components/Logo"

type VerifyState = "idle" | "loading" | "success" | "error"

const MOCK_VALID_IDS = ["ZM-2024-001-8872", "123456/78/9", "ZM-2024-002-1134"]

export default function VerifyPage() {
  const [idInput, setIdInput] = useState("")
  const [state, setState] = useState<VerifyState>("idle")

  function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (!idInput.trim()) return
    setState("loading")
    setTimeout(() => {
      setState(MOCK_VALID_IDS.some((id) => id.toLowerCase() === idInput.toLowerCase().trim()) ? "success" : "error")
    }, 1800)
  }

  function reset() {
    setIdInput("")
    setState("idle")
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <Logo variant="full" width={36} height={36} />
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/" className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
            <Link href="/register" className="px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">Register</Link>
            <Link href="/login" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 ml-1">Login</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <ScanLine className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground text-balance">Verify a Digital ID</h1>
          <p className="mt-3 text-muted-foreground leading-relaxed max-w-md mx-auto">
            Enter a citizen's Digital ID number or NRC to instantly verify their identity status in real time.
          </p>
        </div>

        {/* Search form */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl mb-6">
          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Digital ID or NRC Number</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  placeholder="e.g. ZM-2024-001-8872 or 123456/78/9"
                  className="w-full rounded-lg border border-border bg-input pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={state === "loading" || !idInput.trim()}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {state === "loading" ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 000 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                    </svg>
                    Verifying...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" /> Verify Identity
                  </>
                )}
              </button>
              {state !== "idle" && (
                <button type="button" onClick={reset} className="rounded-lg border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
                  Reset
                </button>
              )}
            </div>
          </form>

          {/* Demo hint */}
          <div className="mt-4 rounded-lg bg-secondary/50 border border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Demo hint:</span> Try{" "}
              <button className="text-primary font-mono hover:underline" onClick={() => setIdInput("ZM-2024-001-8872")}>ZM-2024-001-8872</button>{" "}
              for a valid result, or any other text for invalid.
            </p>
          </div>
        </div>

        {/* Result: Success */}
        {state === "success" && (
          <div className="rounded-2xl border border-primary/40 bg-card p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary rounded-t-2xl" style={{ position: "relative" }} />
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 border border-primary/30">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-foreground">Identity Verified</p>
                <p className="text-xs text-primary">This is a valid, active Zambia Digital ID</p>
              </div>
              <span className="ml-auto text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">VALID</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                { icon: User, label: "Full Name", value: "Mwamba Kalinda" },
                { icon: Calendar, label: "Date of Birth", value: "14 March 1990" },
                { icon: MapPin, label: "Province", value: "Lusaka Province" },
                { icon: Fingerprint, label: "Biometrics", value: "Verified" },
                { icon: Shield, label: "Digital ID", value: "ZM-2024-001-8872" },
                { icon: CheckCircle2, label: "Status", value: "Active & Verified" },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-3 rounded-lg bg-secondary/50 px-4 py-3">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className={`text-sm font-semibold ${item.label === "Status" ? "text-primary" : "text-foreground"}`}>{item.value}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Result: Error */}
        {state === "error" && (
          <div className="rounded-2xl border border-destructive/40 bg-card p-6 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 border border-destructive/30">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="font-bold text-foreground">Verification Failed</p>
                <p className="text-xs text-destructive">No matching Digital ID found in the system</p>
              </div>
              <span className="ml-auto text-xs font-semibold bg-destructive/10 text-destructive px-3 py-1 rounded-full border border-destructive/20">INVALID</span>
            </div>
            <p className="text-sm text-muted-foreground">The ID number <span className="font-mono text-foreground font-medium">{idInput}</span> could not be found. Please check the number and try again, or contact the issuing authority.</p>
            <div className="mt-4 flex gap-3">
              <button onClick={reset} className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">Try Again</button>
              <Link href="/register" className="flex-1 text-center rounded-lg border border-border py-2.5 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">Register New ID</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
