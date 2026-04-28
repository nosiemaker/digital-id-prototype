"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Shield, Eye, EyeOff, Lock, Mail, AlertCircle } from "lucide-react"
import { authApi, APIError, tokenStore } from "@/lib/axios"

// Role → destination route mapping.
const ROLE_ROUTES: Record<string, string> = {
  REGISTRATION_OFFICER: "/admin/registrations",
  SUPERVISOR: "/admin",
  REGISTRAR: "/admin",
  HEALTH_WORKER: "/admin",
  CITIZEN: "/wallet",
  THIRD_PARTY: "/institutions/dashboard",
}

const DEFAULT_ROUTE = "/wallet"

export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    const token = tokenStore.getAccess()
    if (token) {
      //router.push("/wallet")
    }
  }, [router])

  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ email: "", password: "" })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const user = await authApi.login({
        email: form.email,
        password: form.password,
      })

      // authApi.login already persisted the tokens via tokenStore.set —
      // navigate to the role-appropriate dashboard.
      localStorage.setItem("user_name", user.name); 
      localStorage.setItem("user_role", user.role);
      const destination = ROLE_ROUTES[user.role] ?? DEFAULT_ROUTE
      router.push(destination)
    } catch (err) {
      const apiErr = err as APIError
      // 401 → wrong credentials, 403 → account suspended
      if (apiErr.status === 401) {
        setError("Incorrect email or password.")
      } else if (apiErr.status === 403) {
        setError("Your account is inactive or suspended. Contact your administrator.")
      } else {
        setError(apiErr.detail ?? "Something went wrong. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Zambia Digital ID</p>
              <p className="text-xs text-muted-foreground">Admin Portal Access</p>
            </div>
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
          <h1 className="text-xl font-bold text-foreground mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Sign in to access the administration portal.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="admin@zidp.gov.zm"
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value })
                    setError(null)
                  }}
                  className="w-full rounded-lg border border-border bg-input pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value })
                    setError(null)
                  }}
                  className="w-full rounded-lg border border-border bg-input pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                Remember me
              </label>
              <button type="button" className="text-primary hover:underline">
                Forgot password?
              </button>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 000 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              Are you a citizen?{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">
                Register your Digital ID
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              Institutional partner?{" "}
              <Link href="/institutions" className="text-primary hover:underline font-medium">
                Sign in as a Third Party
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © 2026 Republic of Zambia · Ministry of Home Affairs
        </p>
      </div>
    </div>
  )
}