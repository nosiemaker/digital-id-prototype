"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Search, Filter, Eye, ChevronLeft, ChevronRight, Users, Loader2 } from "lucide-react"
import { citizenApi, type CitizenSummary, type CitizenStatus } from "@/lib/axios"

const statusColors: Record<string, string> = {
  ACTIVE:    "bg-primary/15 text-primary",
  PENDING:   "bg-yellow-400/15 text-yellow-400",
  REJECTED:  "bg-red-400/15 text-red-400",
  SUSPENDED: "bg-orange-400/15 text-orange-400",
  DECEASED:  "bg-gray-400/15 text-gray-400",
}

const PER_PAGE = 8

export default function CitizensPage() {
  const [citizens, setCitizens] = useState<CitizenSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<CitizenStatus | "All">("All")
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    citizenApi.list({
      ...(filterStatus !== "All" ? { status: filterStatus } : {}),
      ...(search ? { search } : {}),
    })
      .then((data) => {
        setCitizens(data)
        setPage(1)
      })
      .catch((err) => setError(err.detail ?? "Failed to load citizens"))
      .finally(() => setLoading(false))
  }, [filterStatus, search])

  const total = citizens.length
  const pages = Math.ceil(total / PER_PAGE) || 1
  const paged = citizens.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-sm h-16 flex items-center justify-between px-4 sm:px-6">
        <div>
          <h1 className="text-base font-bold text-foreground">Citizens</h1>
          <p className="text-xs text-muted-foreground">{total.toLocaleString()} total records</p>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or DIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-input pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {(["All", "ACTIVE", "PENDING", "REJECTED"] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); setPage(1) }}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
              >
                {s === "All" ? "All" : s[0] + s.slice(1).toLowerCase()}
              </button>
            ))}
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
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40">
                      <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Citizen</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">NRC</th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paged.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-12 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <Users className="h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">No citizens found</p>
                          </div>
                        </td>
                      </tr>
                    ) : paged.map((citizen) => (
                      <tr key={citizen.din} className="hover:bg-secondary/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                              {citizen.full_name.split(" ").map((n) => n[0]).join("")}
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-xs">{citizen.full_name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{citizen.din}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-muted-foreground font-mono">{citizen.nrc}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[citizen.status] ?? statusColors.PENDING}`}>
                            {citizen.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-xs text-muted-foreground font-mono">{citizen.din}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <p className="text-xs text-muted-foreground">Showing {Math.min((page - 1) * PER_PAGE + 1, total)}–{Math.min(page * PER_PAGE, total)} of {total}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: pages }).map((_, i) => (
                    <button key={i} onClick={() => setPage(i + 1)} className={`h-7 w-7 rounded-md text-xs font-medium transition-colors ${page === i + 1 ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>
                      {i + 1}
                    </button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}