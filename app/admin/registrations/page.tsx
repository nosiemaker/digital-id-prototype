"use client"

import Link from "next/link"
import { useState } from "react"
import { Eye, Clock, CheckCircle2, XCircle, Search } from "lucide-react"

const REGISTRATIONS = [
  { id: "REG-20240323-001", name: "Monde Musonda", province: "Lusaka", submitted: "23 Mar 2024, 09:14", type: "New Registration", status: "Pending" },
  { id: "REG-20240323-002", name: "Kawanga Sata", province: "Copperbelt", submitted: "23 Mar 2024, 08:52", type: "Renewal", status: "Pending" },
  { id: "REG-20240322-015", name: "Thandiwe Phiri", province: "Eastern", submitted: "22 Mar 2024, 16:30", type: "New Registration", status: "Verified" },
  { id: "REG-20240322-014", name: "Elias Tembo", province: "Southern", submitted: "22 Mar 2024, 15:10", type: "Correction", status: "Pending" },
  { id: "REG-20240322-013", name: "Mwila Kapata", province: "Northern", submitted: "22 Mar 2024, 14:02", type: "New Registration", status: "Rejected" },
  { id: "REG-20240321-010", name: "Yvonne Banda", province: "Western", submitted: "21 Mar 2024, 11:23", type: "New Registration", status: "Verified" },
  { id: "REG-20240321-009", name: "Patrick Mwale", province: "Central", submitted: "21 Mar 2024, 10:58", type: "Renewal", status: "Verified" },
  { id: "REG-20240320-007", name: "Charity Zulu", province: "Luapula", submitted: "20 Mar 2024, 09:00", type: "New Registration", status: "Pending" },
]

const statusColors: Record<string, string> = {
  Verified: "bg-primary/15 text-primary",
  Pending: "bg-yellow-400/15 text-yellow-400",
  Rejected: "bg-red-400/15 text-red-400",
}
const StatusIcon: Record<string, React.ElementType> = {
  Verified: CheckCircle2,
  Pending: Clock,
  Rejected: XCircle,
}

export default function RegistrationsPage() {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")

  const filtered = REGISTRATIONS.filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === "All" || r.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm h-16 flex items-center justify-between px-4 sm:px-6">
        <div>
          <h1 className="text-base font-bold text-foreground">Registrations</h1>
          <p className="text-xs text-muted-foreground">Review and process incoming applications</p>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending Review", value: "12,483", icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10" },
            { label: "Approved Today", value: "1,247", icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
            { label: "Rejected Today", value: "38", icon: XCircle, color: "text-red-400", bg: "bg-red-400/10" },
          ].map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg} shrink-0`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">{card.value}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input type="text" placeholder="Search registrations..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-border bg-input pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" />
          </div>
          <div className="flex gap-2">
            {["All", "Pending", "Verified", "Rejected"].map((s) => (
              <button key={s} onClick={() => setFilter(s)} className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${filter === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>{s}</button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Application</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Type</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Province</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Submitted</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((reg) => {
                  const Icon = StatusIcon[reg.status]
                  return (
                    <tr key={reg.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                            {reg.name.split(" ").map((n) => n[0]).join("")}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-xs">{reg.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{reg.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground hidden sm:table-cell">{reg.type}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell">{reg.province}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">{reg.submitted}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[reg.status]}`}>
                          <Icon className="h-3 w-3" /> {reg.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href="/admin/citizens" className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                          <Eye className="h-3.5 w-3.5" /> Review
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
