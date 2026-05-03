"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import {
  Shield,
  LayoutDashboard,
  Users,
  Key,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowUpRight,
  Eye,
  Copy,
  Zap,
  Globe,
  Lock,
  Smartphone,
  Loader2,
  Link2
} from "lucide-react"
import { useRoleGuard } from "@/hooks/use-role-guard"
import { useMe } from "@/hooks/useMe"
import { kycApi } from "@/lib/api/kyc"
import type { InstitutionLinkedCitizenResponse } from "@/utils/types"

const sidebarLinks = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "verifications", label: "Identity Checks", icon: Users },
  { id: "linked-accounts", label: "Linked Accounts", icon: Link2 },
  { id: "api", label: "API & Keys", icon: Key },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
]

const recentVerifications = [
  { id: "KYC-8872-A", citizen: "Mwamba Kalinda", din: "ZM-2024-001-8872", type: "Full KYC", date: "2 hours ago", status: "Success" },
  { id: "KYC-1134-B", citizen: "Chileshe Banda", din: "ZM-2024-002-1134", type: "Age Verify", date: "5 hours ago", status: "Success" },
  { id: "KYC-5520-C", citizen: "Mutale Phiri", din: "ZM-2024-003-5520", type: "Address Verify", date: "Yesterday", status: "Failed" },
  { id: "KYC-8801-D", citizen: "Namwaka Tembo", din: "ZM-2024-004-8801", type: "Full KYC", date: "2 days ago", status: "Success" },
  { id: "KYC-2203-E", citizen: "Bwalya Mwansa", din: "ZM-2024-005-2203", type: "Biometric", date: "3 days ago", status: "Success" },
]

const dataPermissions = [
  { field: "Full Name", permitted: true },
  { field: "NRC Number", permitted: true },
  { field: "Date of Birth", permitted: true },
  { field: "Place of Birth", permitted: false },
  { field: "Biometric Match Score", permitted: true },
  { field: "Residential Address", permitted: true },
  { field: "Family Connections", permitted: false },
]

export default function InstitutionDashboard() {
  // Only allow THIRD_PARTY role
  useRoleGuard(["THIRD_PARTY"])
  const { me, loading } = useMe()
  
  const [activeTab, setActiveTab] = useState("overview")
  const [copied, setCopied] = useState(false)
  const [linkedCitizens, setLinkedCitizens] = useState<InstitutionLinkedCitizenResponse[]>([])
  const [loadingCitizens, setLoadingCitizens] = useState(false)
  useEffect(() => {
    if (activeTab === "linked-accounts") {
      const fetchLinked = async () => {
        setLoadingCitizens(true)
        try {
          const res = await kycApi.getInstitutionLinkedCitizens()
          setLinkedCitizens(res)
        } catch (error) {
          console.error("Failed to fetch linked citizens", error)
        } finally {
          setLoadingCitizens(false)
        }
      }
      fetchLinked()
    }
  }, [activeTab])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const institutionName = me?.name || "Institution"

  return (
    <div className="min-h-screen bg-background font-sans flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card shrink-0 sticky top-0 h-screen">
        <div className="flex h-16 items-center gap-2.5 px-5 border-b border-border">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-bold text-foreground">Partner Portal</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">{institutionName}</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {sidebarLinks.map((link) => {
            const Icon = link.icon
            const isActive = activeTab === link.id
            return (
              <button
                key={link.id}
                onClick={() => setActiveTab(link.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{link.label}</span>
              </button>
            )
          })}
        </nav>
        <div className="border-t border-border p-4">
          <Link href="/institutions" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            <LogOut className="h-4 w-4" /><span>Exit Portal</span>
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold text-foreground capitalize">{activeTab}</h1>
            <span className="h-4 w-[1px] bg-border hidden sm:block" />
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              API Environment: Production
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input 
                placeholder="Search DIN or Request ID..." 
                className="w-64 rounded-lg bg-secondary/50 border-none pl-9 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        <div className="p-6 space-y-6 max-w-7xl mx-auto">
          {activeTab === "overview" && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: "Total Checks", value: "12,482", change: "+12%", icon: Users },
                  { label: "Success Rate", value: "99.4%", change: "+0.2%", icon: CheckCircle2 },
                  { label: "Avg. Latency", value: "420ms", change: "-50ms", icon: Zap },
                  { label: "API Credits", value: "85,200", change: "Renewal in 8d", icon: BarChart3 },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <stat.icon className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                        {stat.change}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Recent Identity Checks */}
                <div className="xl:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                    <h2 className="text-sm font-bold text-foreground">Recent Identity Checks</h2>
                    <button onClick={() => setActiveTab("verifications")} className="text-xs text-primary font-semibold hover:underline flex items-center gap-1">
                      View full log <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/40 border-b border-border text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        <tr>
                          <th className="px-5 py-3 text-left">Citizen / DIN</th>
                          <th className="px-5 py-3 text-left">Check Type</th>
                          <th className="px-5 py-3 text-left">Timestamp</th>
                          <th className="px-5 py-3 text-left">Status</th>
                          <th className="px-5 py-3 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {recentVerifications.map((check) => (
                          <tr key={check.id} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-5 py-3.5">
                              <div>
                                <p className="font-bold text-xs text-foreground">{check.citizen}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{check.din}</p>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-muted-foreground">{check.type}</td>
                            <td className="px-5 py-3.5 text-xs text-muted-foreground">{check.date}</td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${check.status === "Success" ? "bg-primary/10 text-primary" : "bg-red-400/10 text-red-400"}`}>
                                {check.status === "Success" ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                                {check.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Data Access Permissions Panel */}
                <div className="rounded-xl border border-border bg-card p-5 h-fit">
                  <h2 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" /> Data Access Scope
                  </h2>
                  <p className="text-[10px] text-muted-foreground mb-6">Currently permitted fields for your institution.</p>
                  
                  <div className="space-y-3">
                    {dataPermissions.map((permission) => (
                      <div key={permission.field} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                        <span className="text-xs font-medium text-foreground">{permission.field}</span>
                        {permission.permitted ? (
                          <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        ) : (
                          <Lock className="h-3 w-3 text-muted-foreground opacity-40" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Need more data?</p>
                    <p className="text-[10px] text-muted-foreground mb-3">Upgrade your institutional agreement to access more citizen fields.</p>
                    <button className="w-full py-1.5 rounded bg-primary text-[10px] font-bold text-primary-foreground hover:opacity-90">
                      Request Scope Upgrade
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === "api" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-bold text-foreground mb-4">API Credentials</h2>
                <p className="text-sm text-muted-foreground mb-8">Manage your institutional API keys. Keep these secrets secure.</p>
                
                <div className="space-y-6">
                  {/* API Key Item */}
                  <div className="p-4 rounded-xl border border-border bg-secondary/20">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">Production Key</span>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded uppercase">Active</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Created 3 months ago</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded bg-black/80 px-3 py-2 text-xs font-mono text-green-400 border border-white/5 truncate">
                        zdid_live_7721_4992_xk92_1102_9921_bc22
                      </div>
                      <button 
                        onClick={() => copyToClipboard("zdid_live_7721_4992_xk92_1102_9921_bc22")}
                        className="p-2 rounded bg-secondary hover:bg-secondary-foreground/10 transition-colors"
                      >
                        {copied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-secondary/20 opacity-6 grayscale">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">Test Sandbox Key</span>
                        <span className="text-[10px] font-bold text-muted-foreground bg-muted/20 px-2 py-0.5 rounded uppercase">Revoked</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Revoked 2 weeks ago</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded bg-black/80 px-3 py-2 text-xs font-mono text-muted-foreground border border-white/5 truncate">
                        zdid_test_0012_8823_kk01_2219_7734_aa11
                      </div>
                      <button disabled className="p-2 rounded bg-secondary opacity-50 cursor-not-allowed">
                        <Copy className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>

                <button className="mt-8 flex items-center gap-2 py-2.5 px-4 rounded-lg bg-primary text-sm font-bold text-primary-foreground hover:opacity-90">
                  <Key className="h-4 w-4" /> Generate New API Key
                </button>
              </div>

              {/* Documentation Shortcut */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-border bg-card p-6 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-400/10 flex items-center justify-center shrink-0">
                    <Globe className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">Webhooks</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4 leading-relaxed">Configure endpoints to receive real-time updates when citizens approve your data requests.</p>
                    <button className="text-xs font-bold text-primary hover:underline">Configure Webhooks →</button>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-6 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-orange-400/10 flex items-center justify-center shrink-0">
                    <Smartphone className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-sm">OAuth Configuration</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4 leading-relaxed">Set up Redirect URIs and Client IDs for the "Login with ZDID" integration.</p>
                    <button className="text-xs font-bold text-primary hover:underline">Edit Auth Config →</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "linked-accounts" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-secondary/10">
                  <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <Link2 className="h-5 w-5 text-primary" /> Linked Citizen Accounts
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      These citizens have securely linked their Digital ID to your institution. You have persistent access to the fields defined in your Data Access Scope.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
                      {linkedCitizens.length} Active Links
                    </span>
                  </div>
                </div>
                
                {loadingCitizens ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Loading linked accounts...</p>
                  </div>
                ) : linkedCitizens.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center">
                      <Users className="h-8 w-8 text-muted-foreground opacity-30" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">No Linked Accounts</h3>
                      <p className="text-xs text-muted-foreground mt-1">No citizens have linked their accounts to your institution yet.</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/40 border-b border-border text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        <tr>
                          <th className="px-6 py-4 text-left">Citizen Details</th>
                          <th className="px-6 py-4 text-left">DIN / NRC</th>
                          <th className="px-6 py-4 text-left">Linked On</th>
                          <th className="px-6 py-4 text-left">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {linkedCitizens.map((citizen) => (
                          <tr key={citizen.link_id} className="hover:bg-secondary/20 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                  {citizen.citizen_name.charAt(0)}
                                </div>
                                <span className="font-bold text-sm text-foreground">{citizen.citizen_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-xs font-mono text-foreground">{citizen.citizen_din}</p>
                                <p className="text-[10px] text-muted-foreground">NRC: {citizen.citizen_nrc}</p>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-xs text-muted-foreground">
                              {new Date(citizen.linked_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${citizen.is_active ? "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20" : "bg-red-400/10 text-red-400 border border-red-400/20"}`}>
                                {citizen.is_active ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertCircle className="h-2.5 w-2.5" />}
                                {citizen.is_active ? "Active" : "Revoked"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button className="text-xs font-bold text-primary hover:underline" disabled={!citizen.is_active}>
                                View Profile Data
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {(activeTab === "verifications" || activeTab === "analytics" || activeTab === "settings") && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
                <Shield className="h-10 w-10 text-muted-foreground opacity-20" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground capitalize">{activeTab} module</h3>
                <p className="text-sm text-muted-foreground max-w-xs">This module is currently being optimized for institutional performance. Check back shortly.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
