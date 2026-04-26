"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { z } from "zod"
import {
    Shield,
    Eye,
    EyeOff,
    Loader2,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Mail,
    Lock,
} from "lucide-react"
import { authApi } from "@/lib/axios"

// ── Validation Schema ─────────────────────────────────────────────────────────
const signUpSchema = z
    .object({
        email: z.string().email("Enter a valid email address"),
        password: z
            .string()
            .min(8, "Password must be at least 8 characters")
            .regex(/[A-Z]/, "Must contain an uppercase letter")
            .regex(/[0-9]/, "Must contain a number"),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords do not match",
        path: ["confirmPassword"],
    })

type SignUpForm = z.infer<typeof signUpSchema>
type FieldErrors = Partial<Record<keyof SignUpForm, string>>

// ── Password strength helper ──────────────────────────────────────────────────
function passwordStrength(pw: string): { score: number; label: string; color: string } {
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[A-Z]/.test(pw)) score++
    if (/[0-9]/.test(pw)) score++
    if (/[^A-Za-z0-9]/.test(pw)) score++

    if (score <= 1) return { score, label: "Weak",   color: "bg-red-500"   }
    if (score <= 3) return { score, label: "Fair",   color: "bg-amber-500" }
    if (score === 4) return { score, label: "Good",  color: "bg-blue-500"  }
    return              { score, label: "Strong", color: "bg-primary"   }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SignUpPage() {
    const router = useRouter()

    const [form, setForm] = useState<SignUpForm>({
        email:           "",
        password:        "",
        confirmPassword: "",
    })
    const [errors,      setErrors]      = useState<FieldErrors>({})
    const [apiError,    setApiError]    = useState<string | null>(null)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm,  setShowConfirm]  = useState(false)
    const [isLoading,   setIsLoading]   = useState(false)

    const strength = passwordStrength(form.password)

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
        if (errors[name as keyof SignUpForm]) {
            setErrors(prev => ({ ...prev, [name]: undefined }))
        }
        setApiError(null)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        const result = signUpSchema.safeParse(form)
        if (!result.success) {
            const fieldErrors: FieldErrors = {}
            result.error.errors.forEach(err => {
                const field = err.path[0] as keyof SignUpForm
                if (!fieldErrors[field]) fieldErrors[field] = err.message
            })
            setErrors(fieldErrors)
            return
        }

        setIsLoading(true)
        setApiError(null)

        try {
            // Name is intentionally omitted — it will be collected and stored
            // from the legal name on the NRC during identity submission (/register/identity).
            await authApi.createAccount({
                email:    form.email,
                password: form.password,
            })

            sessionStorage.setItem("zdid_pending_email", form.email)
            router.push("/verification")
        } catch (err: any) {
            setApiError(err?.detail ?? "Something went wrong. Please try again.")
        } finally {
            setIsLoading(false)
        }
    }

    const isFormValid = signUpSchema.safeParse(form).success

    return (
        <div className="min-h-screen bg-background flex">

            {/* Left panel – branding */}
            <div className="hidden lg:flex w-[420px] shrink-0 flex-col justify-between bg-card border-r border-border p-10">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                        <Shield className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="leading-tight">
                        <p className="text-sm font-bold text-foreground">Zambia Digital ID</p>
                        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                            Republic of Zambia
                        </p>
                    </div>
                </div>

                <div>
                    <div className="mb-8 space-y-4">
                        {[
                            "One identity, verified across all government services",
                            "Secure biometric enrollment with NRC",
                            "Instant verification via QR — no paperwork",
                        ].map((text, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <p className="text-sm text-muted-foreground leading-snug">{text}</p>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground border-t border-border pt-6">
                        Protected under the Zambia Data Protection Act, 2021.
                    </p>
                </div>
            </div>

            {/* Right panel – form */}
            <div className="flex flex-1 items-center justify-center px-6 py-12">
                <div className="w-full max-w-md">

                    {/* Mobile logo */}
                    <div className="flex lg:hidden items-center gap-2.5 mb-8">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                            <Shield className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <span className="text-sm font-bold text-foreground">Zambia Digital ID</span>
                    </div>

                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-foreground mb-1">Create your account</h1>
                        <p className="text-sm text-muted-foreground">
                            Already have an account?{" "}
                            <Link href="/login" className="text-primary font-medium hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>

                    {apiError && (
                        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-500">{apiError}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1.5">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    name="email"
                                    type="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="you@example.com"
                                    className={`w-full pl-9 pr-3 py-2.5 rounded-lg border text-sm bg-secondary/40 text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary ${
                                        errors.email ? "border-red-500/60" : "border-border"
                                    }`}
                                />
                            </div>
                            {errors.email && (
                                <p className="text-xs text-red-500 mt-1">{errors.email}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder="Min. 8 characters"
                                    className={`w-full pl-9 pr-10 py-2.5 rounded-lg border text-sm bg-secondary/40 text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary ${
                                        errors.password ? "border-red-500/60" : "border-border"
                                    }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>

                            {/* Strength meter */}
                            {form.password && (
                                <div className="mt-2 space-y-1">
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div
                                                key={i}
                                                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                                    i <= strength.score ? strength.color : "bg-secondary"
                                                }`}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Strength:{" "}
                                        <span className={
                                            strength.score <= 1 ? "text-red-500" :
                                            strength.score <= 3 ? "text-amber-500" :
                                            "text-primary"
                                        }>
                                            {strength.label}
                                        </span>
                                    </p>
                                </div>
                            )}

                            {errors.password && (
                                <p className="text-xs text-red-500 mt-1">{errors.password}</p>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1.5">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    name="confirmPassword"
                                    type={showConfirm ? "text" : "password"}
                                    value={form.confirmPassword}
                                    onChange={handleChange}
                                    placeholder="Repeat your password"
                                    className={`w-full pl-9 pr-10 py-2.5 rounded-lg border text-sm bg-secondary/40 text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary ${
                                        errors.confirmPassword ? "border-red-500/60" : "border-border"
                                    }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {errors.confirmPassword && (
                                <p className="text-xs text-red-500 mt-1">{errors.confirmPassword}</p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || !isFormValid}
                            className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity"
                        >
                            {isLoading ? (
                                <><Loader2 className="h-4 w-4 animate-spin" /> Creating account…</>
                            ) : (
                                <>Create Account <ArrowRight className="h-4 w-4" /></>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-xs text-muted-foreground">
                        By signing up you agree to the{" "}
                        <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link>
                        {" "}and{" "}
                        <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                    </p>
                </div>
            </div>
        </div>
    )
}