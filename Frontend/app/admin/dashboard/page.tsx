"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, CheckCircle2, Clock, TrendingUp, AlertCircle, ArrowUpRight, Eye, UserCog, Loader2 } from "lucide-react"
import { axiosInstance } from "@/lib/http"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface DashboardData {
  kpi: {
    total_citizens: string
    verified_ids: string
    pending_registrations: string
    rejected_applications: string
  }
  staff_breakdown: {
    total: number
    ro_count: number
    hw_count: number
    registrar_count: number
    ro_pct: number
    hw_pct: number
  }
  recent_registrations: Array<{
    id: number
    name: string
    date: string
    status: string
    nrc: string
  }>
  trends: number[]
}

const statusColors: Record<string, string> = {
  APPROVED: "bg-primary/15 text-primary",
  PENDING: "bg-yellow-400/15 text-yellow-400",
  REJECTED: "bg-red-400/15 text-red-400",
  ACTIVE: "bg-primary/15 text-primary",
  Verified: "bg-primary/15 text-primary",
}

const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    setLoading(true)
    try {
      const res = await axiosInstance.get("/reports/admin-stats")
      setData(res.data)
    } catch (err: any) {
      console.error(err)
      toast.error("Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Loading system statistics...</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  const stats = [
    { label: "Total Citizens", value: data.kpi.total_citizens, change: "+2.4%", icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Verified IDs", value: data.kpi.verified_ids, change: "+1.8%", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Total Staff", value: data.staff_breakdown.total.toString(), change: "+4.2%", icon: UserCog, color: "text-purple-400", bg: "bg-purple-400/10" },
    { label: "Pending Reviews", value: data.kpi.pending_registrations, change: "+8.1%", icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10" },
  ]

  const maxVal = Math.max(...data.trends)

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm h-16 flex items-center justify-between px-4 sm:px-6">
        <div>
          <h1 className="text-base font-bold text-foreground">Dashboard Overview</h1>
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
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
              <Link href="/admin/registrations" className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Citizen</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">NRC</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.recent_registrations.map((req) => (
                    <tr key={req.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                            {req.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-xs">{req.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">REQ#{req.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground hidden sm:table-cell font-mono">{req.nrc}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell">{req.date}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider", statusColors[req.status] || "bg-secondary text-muted-foreground")}>
                          {req.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/citizens/${req.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                          <Eye className="h-3.5 w-3.5" /> Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {data.recent_registrations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground text-xs">
                        No recent registration requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mini chart + breakdown */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold text-foreground mb-1">Monthly Registrations</h2>
              <p className="text-xs text-muted-foreground mb-4">Total enrollment volume (last 12 months)</p>
              <div className="flex items-end gap-1 h-24">
                {data.trends.map((val, i) => (
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
              <h2 className="text-sm font-semibold text-foreground mb-4">Staff Breakdown</h2>
              <div className="space-y-4">
                {[
                  { label: "Registration Officers", count: data.staff_breakdown.ro_count, pct: data.staff_breakdown.ro_pct, color: "bg-purple-400" },
                  { label: "Health Workers", count: data.staff_breakdown.hw_count, pct: data.staff_breakdown.hw_pct, color: "bg-blue-400" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium text-foreground">{item.count} ({item.pct}%)</span>
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
