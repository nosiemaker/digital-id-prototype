"use client"

import Link from "next/link"
import { Users, CheckCircle2, Clock, TrendingUp, AlertCircle, ArrowUpRight, Eye } from "lucide-react"

const stats = [
  { label: "Total Citizens", value: "4,218,342", change: "+2.4%", icon: Users, color: "text-primary", bg: "bg-primary/10" },
  { label: "Verified IDs", value: "3,891,007", change: "+1.8%", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
  { label: "Pending Registrations", value: "12,483", change: "+8.1%", icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  { label: "Rejected Applications", value: "1,204", change: "-3.2%", icon: AlertCircle, color: "text-red-400", bg: "bg-red-400/10" },
]

const recentUsers = [
  { id: "ZM-2024-001-8872", name: "Mwamba Kalinda", province: "Lusaka", date: "23 Mar 2024", status: "Verified" },
  { id: "ZM-2024-002-1134", name: "Chileshe Banda", province: "Copperbelt", date: "22 Mar 2024", status: "Verified" },
  { id: "ZM-2024-003-5520", name: "Mutale Phiri", province: "Eastern", date: "21 Mar 2024", status: "Pending" },
  { id: "ZM-2024-004-8801", name: "Namwaka Tembo", province: "Southern", date: "20 Mar 2024", status: "Verified" },
  { id: "ZM-2024-005-2203", name: "Bwalya Mwansa", province: "Northern", date: "19 Mar 2024", status: "Pending" },
  { id: "ZM-2024-006-6641", name: "Chanda Lungu", province: "Western", date: "18 Mar 2024", status: "Rejected" },
  { id: "ZM-2024-007-3312", name: "Kabwe Sikazwe", province: "Luapula", date: "17 Mar 2024", status: "Verified" },
]

const statusColors: Record<string, string> = {
  Verified: "bg-primary/15 text-primary",
  Pending: "bg-yellow-400/15 text-yellow-400",
  Rejected: "bg-red-400/15 text-red-400",
}

const monthlyData = [65, 72, 68, 80, 88, 91, 85, 95, 102, 98, 110, 115]
const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
const maxVal = Math.max(...monthlyData)

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm h-16 flex items-center justify-between px-4 sm:px-6">
        <div>
          <h1 className="text-base font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-xs text-muted-foreground">Monday, 23 March 2024</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary rounded-full px-3 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            System Operational
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            const isPositive = stat.change.startsWith("+")
            return (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-5 hover:border-primary/20 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <span className={`flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-primary" : "text-red-400"}`}>
                    <TrendingUp className="h-3 w-3" />
                    {stat.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Recent registrations table */}
          <div className="xl:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Recent Registrations</h2>
              <Link href="/admin/citizens" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Citizen</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Province</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {recentUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                            {user.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-xs">{user.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{user.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground hidden sm:table-cell">{user.province}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell">{user.date}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[user.status]}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/admin/citizens/${user.id.split("-").pop()}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                          <Eye className="h-3.5 w-3.5" /> View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mini chart + breakdown */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Monthly Registrations</h2>
              <p className="text-xs text-muted-foreground mb-4">Thousands of new IDs (last 12 months)</p>
              <div className="flex items-end gap-1 h-24">
                {monthlyData.map((val, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-sm bg-primary/40 hover:bg-primary transition-colors"
                      style={{ height: `${(val / maxVal) * 100}%`, minHeight: "4px" }}
                    />
                    <span className="text-[9px] text-muted-foreground hidden sm:block">{months[i]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Status Breakdown</h2>
              <div className="space-y-3">
                {[
                  { label: "Verified", count: "3,891,007", pct: 92, color: "bg-primary" },
                  { label: "Pending", count: "12,483", pct: 6, color: "bg-yellow-400" },
                  { label: "Rejected", count: "1,204", pct: 2, color: "bg-red-400" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium text-foreground">{item.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary">
                      <div className={`h-1.5 rounded-full ${item.color}`} style={{ width: `${item.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
