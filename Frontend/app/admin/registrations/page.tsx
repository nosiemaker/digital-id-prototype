"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Eye, Clock, CheckCircle2, XCircle, Search, Loader2, Plus } from "lucide-react"
import { enrollmentApi, type EnrollmentRequestResponse } from "@/lib/axios"
import { AddCitizenModal } from "@/components/AddCitizenModel"

const statusColors: Record<string, string> = {
  APPROVED: "bg-primary/15 text-primary",
  PENDING:  "bg-yellow-400/15 text-yellow-400",
  REJECTED: "bg-red-400/15 text-red-400",
}

const StatusIcon: Record<string, React.ElementType> = {
  APPROVED: CheckCircle2,
  PENDING:  Clock,
  REJECTED: XCircle,
}

export default function RegistrationsPage() {
  const [requests, setRequests] = useState<EnrollmentRequestResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("All")

  useEffect(() => {
    setLoading(true)
    enrollmentApi.getPendingRequests()
      .then(setRequests)
      .catch((err) => setError(err.detail ?? "Failed to load pending requests"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = requests.filter((r) => {
    const name = r?.citizen?.full_name?.toLowerCase()
    const matchSearch = name?.includes(search.toLowerCase()) || r?.id.toString().includes(search)
    const matchFilter = filter === "All" || r.status === filter
    return matchSearch && matchFilter
  })

  const pendingCount  = requests.filter((r) => r.status === "PENDING").length
  const approvedCount = requests.filter((r) => r.status === "APPROVED").length
  const rejectedCount = requests.filter((r) => r.status === "REJECTED").length

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
            { label: "Pending Review", value: pendingCount.toLocaleString(), icon: Clock, color: "text-yellow-400", bg: "bg-yellow-400/10" },
            { label: "Approved", value: approvedCount.toLocaleString(), icon: CheckCircle2, color: "text-primary", bg: "bg-primary/10" },
            { label: "Rejected", value: rejectedCount.toLocaleString(), icon: XCircle, color: "text-red-400", bg: "bg-red-400/10" },
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
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search registrations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-input pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Filter Buttons */}
            <div className="flex gap-2 mr-auto lg:mr-0">
              {["All", "PENDING", "APPROVED", "REJECTED"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${filter === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                >
                  {s === "All" ? "All" : s[0] + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <button
              onClick={() => setAddModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4" />
              <span>Add Citizen</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="px-5 py-12 text-center text-sm text-red-400">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Application</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Province</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Submitted</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">No registrations found</td>
                    </tr>
                  ) : filtered.map((req) => {
                    const citizen = req.citizen
                    const Icon = StatusIcon[req.status] ?? Clock
                    const province = citizen?.district?.province?.name ?? "-"
                    return (
                      <tr key={req.id} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 text-xs font-bold text-muted-foreground">
                              {citizen?.full_name 
                                ? citizen.full_name.split(" ").map((n) => n[0]).join("").toUpperCase() 
                                : "???"
                              }
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-xs">{citizen?.full_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">REQ-{req.id.toString().padStart(5, "0")}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell">{province}</td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">
                          {new Date(req.submitted_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[req.status] ?? statusColors.PENDING}`}>
                            <Icon className="h-3 w-3" /> {req.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/citizens/${req.id}`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                          >
                            <Eye className="h-3.5 w-3.5" /> Review
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          </div>
          </div>

          <AddCitizenModal
            open={addModalOpen}
            onClose={() => setAddModalOpen(false)}
            onCitizenAdded={() => {
              // Refresh the pending list automatically
              enrollmentApi.getPendingRequests()
                .then(setRequests)
                .catch(console.error)
            }}
          />
    </div>
  )
}