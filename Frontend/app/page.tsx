"use client"

import Link from "next/link"
import {
  Shield,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  Globe,
  Lock,
  Zap,
  Users,
  ChevronRight,
  Menu,
  X,
} from "lucide-react"
import { useState } from "react"

const features = [
  { icon: Shield, title: "Secure Identity", description: "Military-grade encryption protecting every citizen's personal data and biometric records." },
  { icon: Fingerprint, title: "Biometric Verification", description: "Advanced fingerprint and facial recognition ensuring accurate identity verification." },
  { icon: Globe, title: "Nationwide Access", description: "Access your digital ID from anywhere in Zambia or abroad with instant verification." },
  { icon: Lock, title: "Privacy First", description: "Full control over who accesses your identity data, with comprehensive audit trails." },
  { icon: Zap, title: "Instant Verification", description: "Real-time identity checks in under 2 seconds for seamless service access." },
  { icon: Users, title: "Universal Coverage", description: "Designed for every Zambian citizen with multilingual support and offline capability." },
]

const stats = [
  { value: "4.2M+", label: "Registered Citizens" },
  { value: "98.7%", label: "Verification Accuracy" },
  { value: "2.1s", label: "Avg. Verify Time" },
  { value: "110+", label: "Service Partners" },
]

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Partners", href: "/institutions" },
  { label: "Register", href: "/register" },
  { label: "Verify", href: "/verify" },
  { label: "Login", href: "/login" },
]

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-foreground">Zambia</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Digital ID</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors">Login</Link>
            <Link href="/register" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">Get Started</Link>
          </div>
          <button className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileOpen && (
          <nav className="md:hidden border-t border-border bg-card px-4 py-3 flex flex-col gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="px-4 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">{link.label}</Link>
            ))}
            <Link href="/register" onClick={() => setMobileOpen(false)} className="mt-2 w-full text-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">Get Started</Link>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-28 sm:px-6 lg:px-8">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Republic of Zambia — Official Digital Identity System
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
            Your Identity,{" "}
            <span className="text-primary">Secured &amp; Digital</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
            The Zambia Digital ID System provides every citizen with a secure, verifiable digital identity — enabling seamless access to government services, financial systems, and essential utilities.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/verify" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-border px-8 py-3.5 text-base font-semibold text-foreground hover:bg-secondary transition-colors">
              Verify ID <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* ID card mockup */}
        <div className="mt-16 mx-auto max-w-sm">
          <div className="relative rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-primary" />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded bg-primary">
                  <Shield className="h-4 w-4 text-white" />
                </div>
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">Zambia Digital ID</span>
              </div>
              <span className="text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">VERIFIED</span>
            </div>
            <div className="flex gap-4">
              <div className="h-16 w-16 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-primary">MK</span>
              </div>
              <div className="flex-1 space-y-1">
                <p className="font-semibold text-foreground text-sm">Mwamba Kalinda</p>
                <p className="text-xs text-muted-foreground">NRC: 123456/78/9</p>
                <p className="text-xs text-muted-foreground">DOB: 14 March 1990</p>
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-primary font-medium">Active &amp; Verified</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
              <span>ID: ZM-2024-001-8872</span>
              <div className="grid grid-cols-5 gap-0.5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className={`h-1.5 w-1.5 rounded-sm ${i % 3 === 0 ? "bg-primary/60" : "bg-foreground/15"}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card/50 py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl grid grid-cols-2 gap-6 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-primary">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Institutions Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-secondary/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="mx-auto max-w-7xl relative">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary mb-4 uppercase tracking-wider">
                Service Partners
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-6">Empower your business with ZDID Integration</h2>
              <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                Join over 110+ banks, fintechs, and government agencies already using the Zambia Digital ID system to verify customers instantly and securely.
              </p>
              
              <div className="space-y-6 mb-10">
                {[
                  { title: "KYC Compliance", desc: "Automate your Know Your Customer (KYC) processes with verified government data." },
                  { title: "Secure Authentication", desc: "Replace fragile passwords with multi-factor biometric authentication." },
                  { title: "Data Accuracy", desc: "Access real-time, validated identity records directly from the national registry." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="mt-1 h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground text-sm">{item.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-4">
                <Link href="/institutions" className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
                  Join as a Partner <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/institutions" className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
                  Integration Docs
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-border bg-card p-2 shadow-2xl overflow-hidden">
                <div className="bg-secondary/40 rounded-xl p-6 border border-border">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded bg-primary flex items-center justify-center">
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-bold text-xs uppercase tracking-tight">Partner API Console</span>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-red-400/50" />
                      <div className="h-2 w-2 rounded-full bg-yellow-400/50" />
                      <div className="h-2 w-2 rounded-full bg-green-400/50" />
                    </div>
                  </div>
                  
                  <div className="space-y-4 font-mono text-[10px]">
                    <div className="p-3 rounded bg-black/80 text-green-400 border border-white/10">
                      <p className="opacity-50 mb-2">// Request KYC Verification</p>
                      <p>POST /api/v1/verify-identity</p>
                      <p className="text-blue-400 mt-2">{"{"}</p>
                      <p className="ml-4">"din": "ZM-2024-001-8872",</p>
                      <p className="ml-4">"scope": ["name", "nrc", "biometrics"]</p>
                      <p className="text-blue-400">{"}"}</p>
                    </div>
                    
                    <div className="p-3 rounded bg-black/80 text-blue-300 border border-white/10">
                      <p className="opacity-50 mb-2">// API Response</p>
                      <p className="text-green-400">HTTP 200 OK</p>
                      <p className="mt-2">{"{"}</p>
                      <p className="ml-4">"status": "VERIFIED",</p>
                      <p className="ml-4">"match_score": 0.998,</p>
                      <p className="ml-4">"timestamp": "2024-03-23T14:30:00Z"</p>
                      <p>{"}"}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating badges */}
              <div className="absolute -bottom-6 -left-6 rounded-xl bg-card border border-border p-4 shadow-xl animate-bounce duration-[3000ms]">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-400/10 flex items-center justify-center text-green-400">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Identity Confirmed</p>
                    <p className="text-[10px] text-muted-foreground">High confidence match</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground text-balance">Built for Every Zambian</h2>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto leading-relaxed">A comprehensive digital identity infrastructure that powers secure, efficient interactions across all sectors.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="rounded-xl border border-border bg-card p-6 hover:border-primary/40 transition-all group">
                  <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 bg-card/50 border-t border-border">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-foreground text-balance">Ready to register your Digital ID?</h2>
          <p className="mt-4 text-muted-foreground">The process takes less than 10 minutes. Have your NRC and contact details ready.</p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
              Register Now <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-border px-8 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors">
              Admin Login
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 sm:px-6 text-center text-xs text-muted-foreground">
        <p>© 2024 Republic of Zambia — Ministry of Home Affairs &amp; Internal Security. All rights reserved.</p>
        <p className="mt-1">Zambia Digital Identity Programme (ZDIP) | zidp.gov.zm</p>
      </footer>
    </div>
  )
}
