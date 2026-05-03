"use client"

import Link from "next/link"
import { useState } from "react"
import { thirdPartyApi, APIError } from "@/lib/axios"
import {
  Shield,
  ArrowRight,
  CheckCircle2,
  Building2,
  Mail,
  Smartphone,
  Globe,
  FileText,
  Lock,
  Zap,
  ArrowUpRight,
  AlertCircle,
  Clock,
  Briefcase,
} from "lucide-react"
import { Logo } from "@/components/Logo"

export default function InstitutionsPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "",
    reg_number: "",
    type: "Financial Institution",
    email: "",
    password: "",
    phone: "",
    address: "",
    purpose: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      await thirdPartyApi.register({
        name: form.name,
        reg_number: form.reg_number,
        email: form.email,
        password: form.password,
        phone: form.phone,
        type: form.type,
        purpose: form.purpose,
      })
      setLoading(false)
      setSubmitted(true)
    } catch (err) {
      const apiErr = err as APIError
      setError(apiErr.detail || "Failed to submit application. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Simple Header */}
      <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="hover:opacity-90 transition-opacity">
            <Logo variant="full" width={36} height={36} />
          </Link>
          <Link href="/institutions/dashboard" className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
            Institution Dashboard <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          
          {/* Left Column: Explanation */}
          <div className="space-y-12">
            <div>
              <h1 className="text-4xl font-bold text-foreground tracking-tight mb-6">
                Become a <span className="text-primary">Trusted Service Partner</span>
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed">
                Integrate your services with the Zambia Digital Identity System (ZDID) to offer your customers a seamless, secure, and instant verification experience.
              </p>
            </div>

            <div className="space-y-8">
              <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> The Enrollment Process
              </h3>
              
              <div className="relative space-y-8 pl-8 border-l-2 border-primary/20">
                {[
                  {
                    step: "1",
                    title: "Application",
                    desc: "Submit your institution's details and the specific data scope your services require.",
                    icon: FileText
                  },
                  {
                    step: "2",
                    title: "Verification & Review",
                    desc: "Our registrars will verify your legal status and assess your data security compliance.",
                    icon: Shield
                  },
                  {
                    step: "3",
                    title: "API Credential Issuance",
                    desc: "Once approved, you'll receive unique API keys and access to our secure integration sandbox.",
                    icon: Lock
                  },
                  {
                    step: "4",
                    title: "Go Live",
                    desc: "Deploy your integration and start verifying Zambian citizens in real-time.",
                    icon: Zap
                  }
                ].map((item, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[41px] top-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground border-4 border-background">
                      {item.step}
                    </div>
                    <div className="flex gap-4">
                      <div className="mt-1 h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground">{item.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-secondary/30 border border-border p-6">
              <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" /> Technical Requirements
              </h4>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc pl-5">
                <li>Secure server-to-server communication (HTTPS/TLS 1.3)</li>
                <li>Valid institutional digital certificate</li>
                <li>Support for OAuth 2.0 / OpenID Connect</li>
                <li>Compliance with Data Protection Act No. 4 of 2021</li>
              </ul>
            </div>
          </div>

          {/* Right Column: Registration Form */}
          <div className="sticky top-24">
            {!submitted ? (
              <div className="rounded-2xl border border-border bg-card p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                <h2 className="text-2xl font-bold text-foreground mb-2">Partner Application</h2>
                <p className="text-sm text-muted-foreground mb-8">Submit this form to begin the institutional enrollment process.</p>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Institution Name</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. Zanaco Bank"
                        className="w-full rounded-lg border border-border bg-input pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors"
                        value={form.name}
                        onChange={(e) => setForm({...form, name: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Business Registration Number (PACRA)</label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input 
                        type="text" 
                        required 
                        placeholder="e.g. 120230045678"
                        className="w-full rounded-lg border border-border bg-input pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors"
                        value={form.reg_number}
                        onChange={(e) => setForm({...form, reg_number: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input 
                          type="email" 
                          required 
                          placeholder="partners@zanaco.co.zm"
                          className="w-full rounded-lg border border-border bg-input pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors"
                          value={form.email}
                          onChange={(e) => setForm({...form, email: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Login Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input 
                          type="password" 
                          required 
                          minLength={8}
                          placeholder="••••••••"
                          className="w-full rounded-lg border border-border bg-input pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors"
                          value={form.password}
                          onChange={(e) => setForm({...form, password: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Phone Number</label>
                    <div className="relative">
                      <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input 
                        type="tel" 
                        required 
                        placeholder="+260..."
                        className="w-full rounded-lg border border-border bg-input pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors"
                        value={form.phone}
                        onChange={(e) => setForm({...form, phone: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Institution Type</label>
                    <select 
                      className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors appearance-none"
                      value={form.type}
                      onChange={(e) => setForm({...form, type: e.target.value})}
                    >
                      <option>Financial Institution</option>
                      <option>Government Agency</option>
                      <option>Health Service Provider</option>
                      <option>Telecommunications</option>
                      <option>Private Fintech</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Purpose of Access</label>
                    <textarea 
                      required 
                      rows={3}
                      placeholder="Briefly describe how you plan to use Digital ID verification..."
                      className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm focus:border-primary focus:outline-none transition-colors resize-none"
                      value={form.purpose}
                      onChange={(e) => setForm({...form, purpose: e.target.value})}
                    />
                  </div>

                  <div className="flex items-start gap-2 pt-2">
                    <input type="checkbox" required id="terms" className="mt-1 h-3.5 w-3.5 rounded border-border accent-primary" />
                    <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed">
                      I certify that I am an authorized representative of this institution and agree to the ZDID Data Usage Terms and Privacy Policy.
                    </label>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-xs text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {error}
                    </div>
                  )}

                  <button 
                    disabled={loading}
                    type="submit" 
                    className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? "Processing..." : "Submit Application"}
                    {!loading && <ArrowRight className="h-4 w-4" />}
                  </button>
                </form>
              </div>
            ) : (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-foreground">Application Submitted</h2>
                  <p className="text-muted-foreground">Thank you for your interest in partnering with ZDID.</p>
                </div>
                <div className="p-4 rounded-xl bg-card border border-border text-sm text-left">
                  <p className="font-bold text-foreground mb-1">What happens next?</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    A ZDID Registrar will review your application within 3-5 business days. You will receive an email at <span className="text-primary font-medium">{form.email}</span> once the initial review is complete.
                  </p>
                </div>
                <button 
                  onClick={() => setSubmitted(false)}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Submit another application
                </button>
              </div>
            )}

            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              {[
                { label: "Partner IDs", value: "110+" },
                { label: "Daily API Calls", value: "85k" },
                { label: "Uptime", value: "99.9%" },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-xl border border-border bg-card/50">
                  <p className="text-sm font-bold text-primary">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-12 bg-card/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-muted-foreground">© 2026 Republic of Zambia · ZDID Institutional Programme</p>
          <div className="mt-4 flex justify-center gap-6 text-xs text-muted-foreground">
            <Link href="#" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-primary transition-colors">Integration Terms</Link>
            <Link href="#" className="hover:text-primary transition-colors">Developer Portal</Link>
            <Link href="#" className="hover:text-primary transition-colors">Contact Support</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
