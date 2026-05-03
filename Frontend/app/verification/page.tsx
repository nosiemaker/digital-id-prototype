"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useRef, useEffect, useCallback } from "react"
import {
    Shield,
    Loader2,
    ArrowRight,
    AlertCircle,
    CheckCircle2,
    RefreshCw,
    Mail,
} from "lucide-react"
import { authApi } from "@/lib/axios"

const OTP_LENGTH = 6

export default function VerifyOTPPage() {
    const router = useRouter()

    const [email, setEmail] = useState<string>("")
    const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""))
    const [isVerifying, setIsVerifying] = useState(false)
    const [isResending, setIsResending] = useState(false)
    const [apiError, setApiError] = useState<string | null>(null)
    const [successMsg, setSuccessMsg] = useState<string | null>(null)
    const [resendCooldown, setResendCooldown] = useState(0)

    const inputRefs = useRef<(HTMLInputElement | null)[]>([])

    useEffect(() => {
        const stored = sessionStorage.getItem("zdid_pending_email") ?? ""
        setEmail(stored)
        // Focus first digit on mount
        inputRefs.current[0]?.focus()
    }, [])

    // Countdown timer for resend
    useEffect(() => {
        if (resendCooldown <= 0) return
        const t = setTimeout(() => setResendCooldown((c) => c - 1), 1_000)
        return () => clearTimeout(t)
    }, [resendCooldown])

    const otp = digits.join("")

    // ── Digit input handlers ──────────────────────────────────────────────────

    function handleDigitChange(index: number, value: string) {
        const clean = value.replace(/\D/g, "").slice(0, 1)
        const next = [...digits]
        next[index] = clean
        setDigits(next)
        setApiError(null)

        if (clean && index < OTP_LENGTH - 1) {
            inputRefs.current[index + 1]?.focus()
        }
    }

    function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Backspace") {
            if (digits[index]) {
                const next = [...digits]
                next[index] = ""
                setDigits(next)
            } else if (index > 0) {
                inputRefs.current[index - 1]?.focus()
            }
        }
        if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus()
        if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
    }

    function handlePaste(e: React.ClipboardEvent) {
        e.preventDefault()
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH)
        if (!pasted) return
        const next = Array(OTP_LENGTH).fill("")
        pasted.split("").forEach((ch, i) => { next[i] = ch })
        setDigits(next)
        // Focus the last filled cell
        const lastIdx = Math.min(pasted.length, OTP_LENGTH - 1)
        inputRefs.current[lastIdx]?.focus()
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleVerify = useCallback(async () => {
        if (otp.length < OTP_LENGTH) return
        setIsVerifying(true)
        setApiError(null)

        try {
            await authApi.verifyOtp({ email, otp })
            setSuccessMsg("Email verified! Redirecting to sign in…")
            setTimeout(() => router.push("/login"), 1_500)
        } catch (err: any) {
            setApiError(err?.detail ?? "Invalid or expired code. Please try again.")
        } finally {
            setIsVerifying(false)
        }
    }, [otp, email, router])

    // Auto-submit when all digits filled
    useEffect(() => {
        if (otp.length === OTP_LENGTH && !digits.includes("")) {
            handleVerify()
        }
    }, [otp, digits, handleVerify])

    // ── Resend ────────────────────────────────────────────────────────────────

    async function handleResend() {
        if (resendCooldown > 0 || !email) return
        setIsResending(true)
        setApiError(null)
        setSuccessMsg(null)

        try {
            await authApi.resendOtp({ email })
            setSuccessMsg("A new code has been sent to your inbox.")
            setDigits(Array(OTP_LENGTH).fill(""))
            inputRefs.current[0]?.focus()
            setResendCooldown(60)
        } catch (err: any) {
            setApiError(err?.detail ?? "Could not resend. Please try again.")
        } finally {
            setIsResending(false)
        }
    }

    const isComplete = otp.length === OTP_LENGTH && !digits.includes("")

    return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center gap-2.5 mb-10">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
                        <Shield className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="leading-tight">
                        <p className="text-sm font-bold text-foreground">Zambia Digital ID</p>
                        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                            Republic of Zambia
                        </p>
                    </div>
                </div>

                {/* Card */}
                <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
                    {/* Header */}
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-5">
                        <Mail className="h-7 w-7 text-primary" />
                    </div>

                    <h1 className="text-xl font-bold text-foreground mb-1">Check your inbox</h1>
                    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                        We sent a 6-digit verification code to{" "}
                        <span className="font-medium text-foreground font-mono">{email || "your email"}</span>.
                        Enter it below to activate your account.
                    </p>

                    {/* Alerts */}
                    {apiError && (
                        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-500">{apiError}</p>
                        </div>
                    )}
                    {successMsg && (
                        <div className="mb-5 flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3">
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <p className="text-sm text-primary">{successMsg}</p>
                        </div>
                    )}

                    {/* OTP inputs */}
                    <div className="flex gap-2.5 justify-between mb-6" onPaste={handlePaste}>
                        {digits.map((digit, i) => (
                            <input
                                key={i}
                                ref={(el) => { inputRefs.current[i] = el }}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleDigitChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                className={`w-11 h-11 md:w-12 md:h-12 text-center text-sm font-medium rounded-lg border bg-secondary/40 text-foreground outline-none transition-all duration-150
                  ${digit ? "border-primary bg-primary/5" : "border-border"}
                  focus:border-primary focus:ring-2 focus:ring-primary/20
                  ${apiError ? "border-red-500/60" : ""}`}
                            />
                        ))}
                    </div>

                    {/* Verify button */}
                    <button
                        onClick={handleVerify}
                        disabled={!isComplete || isVerifying}
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity mb-4"
                    >
                        {isVerifying ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                            </>
                        ) : (
                            <>
                                Verify Email <ArrowRight className="h-4 w-4" />
                            </>
                        )}
                    </button>

                    {/* Resend */}
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-2">Didn't receive the code?</p>
                        <button
                            onClick={handleResend}
                            disabled={isResending || resendCooldown > 0}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed transition-opacity"
                        >
                            {isResending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            {resendCooldown > 0
                                ? `Resend in ${resendCooldown}s`
                                : isResending
                                    ? "Sending…"
                                    : "Resend code"}
                        </button>
                    </div>
                </div>

                {/* Back to sign up */}
                <p className="mt-6 text-center text-xs text-muted-foreground">
                    Wrong email?{" "}
                    <Link href="/signup" className="text-primary font-medium hover:underline">
                        Start over
                    </Link>
                </p>
            </div>
        </div>
    )
}