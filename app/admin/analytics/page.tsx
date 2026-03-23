"use client"

import { TrendingUp, Users, CheckCircle2, Globe, BarChart2 } from "lucide-react"

const monthlyData = [
  { month: "Apr", registrations: 65, verified: 58 },
  { month: "May", registrations: 72, verified: 65 },
  { month: "Jun", registrations: 68, verified: 61 },
  { month: "Jul", registrations: 80, verified: 74 },
  { month: "Aug", registrations: 88, verified: 82 },
  { month: "Sep", registrations: 91, verified: 85 },
  { month: "Oct", registrations: 85, verified: 78 },
  { month: "Nov", registrations: 95, verified: 88 },
  { month: "Dec", registrations: 102, verified: 96 },
  { month: "Jan", registrations: 98, verified: 91 },
  { month: "Feb", registrations: 110, verified: 104 },
  { month: "Mar", registrations: 115, verified: 108 },
]

const provinces = [
  { name: "Lusaka", count: 1_203_455, pct: 28 },
  { name: "Copperbelt", count: 987_210, pct: 23 },
  { name: "Eastern", count: 634_890, pct: 15 },
  { name: "Southern", count: 512_340, pct: 12 },
  { name: "Northern", count: 401_200, pct: 10 },
  { name: "Western", count: 253_450, pct: 6 },
  { name: "Central", count: 198_000, pct: 5 },
]

const maxRegistrations = Math.max(...monthlyData.map((d) => d.registrations))

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm h-16 flex items-center justify-between px-4 sm:px-6">
        <div>
          <h1 className="text-base font-bold text-foreground">Analytics</h1>
          <p className="text-xs text-muted-foreground">National Digital ID Programme — Performance Overview</p>
        </div>
        <span className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">Last updated: 23 Mar 2024</span>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[
            { label: "Total Registered", value: "4,218,342", sub: "+12.4% vs last year", icon: Users, color: "text-primary", bg: "bg-primary/10" },
            { label: "Verification Rate", value: "98.7%", sub: "+0.3% this month", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
            { label: "Coverage", value: "62.3%", sub: "of eligible citizens", icon: Globe, color: "text-blue-400", bg: "bg-blue-400/10" },
            { label: "Avg Daily Regs", value: "3,710", sub: "Over last 30 days", icon: TrendingUp, color: "text-purple-400", bg: "bg-purple-400/10" },
          ].map((kpi) => {
            const Icon = kpi.icon
            return (
              <div key={kpi.label} className="rounded-xl border border-border bg-card p-5">
                <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${kpi.bg}`}>
                  <Icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                <p className="text-xs font-medium text-foreground mt-0.5">{kpi.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Bar chart */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Monthly Registration Activity</h2>
                <p className="text-xs text-muted-foreground">Apr 2023 – Mar 2024 (thousands)</p>
              </div>
              <BarChart2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex items-end gap-2 h-40">
              {monthlyData.map((d) => (
                <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex flex-col gap-0.5" style={{ height: "130px", justifyContent: "flex-end" }}>
                    <div className="w-full rounded-t-sm bg-primary/30 hover:bg-primary/50 transition-colors" style={{ height: `${(d.verified / maxRegistrations) * 130}px` }} />
                    <div className="w-full rounded-t-sm bg-primary hover:bg-primary/90 transition-colors" style={{ height: `${((d.registrations - d.verified) / maxRegistrations) * 130}px` }} />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{d.month}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Pending</div>
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/30" />Verified</div>
            </div>
          </div>

          {/* Province breakdown */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1">Registration by Province</h2>
            <p className="text-xs text-muted-foreground mb-5">Distribution of Digital IDs across all provinces</p>
            <div className="space-y-4">
              {provinces.map((p) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="text-muted-foreground">{p.count.toLocaleString()} · {p.pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
                    <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Age and gender breakdown */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Gender Distribution</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-3 rounded-full overflow-hidden flex">
                <div className="bg-primary h-full transition-all" style={{ width: "53%" }} />
                <div className="bg-blue-400 h-full transition-all" style={{ width: "47%" }} />
              </div>
            </div>
            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-primary shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">53%</p>
                  <p className="text-xs text-muted-foreground">Female</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-400 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground">47%</p>
                  <p className="text-xs text-muted-foreground">Male</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Age Group Distribution</h2>
            <div className="space-y-3">
              {[
                { label: "18–25", pct: 22 },
                { label: "26–35", pct: 34 },
                { label: "36–50", pct: 28 },
                { label: "51–65", pct: 11 },
                { label: "65+", pct: 5 },
              ].map((ag) => (
                <div key={ag.label} className="flex items-center gap-3 text-xs">
                  <span className="w-10 text-muted-foreground shrink-0">{ag.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-2 rounded-full bg-primary/70" style={{ width: `${ag.pct * 3}%` }} />
                  </div>
                  <span className="text-muted-foreground w-8 text-right">{ag.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
