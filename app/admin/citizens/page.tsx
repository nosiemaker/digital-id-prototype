"use client"

import Link from "next/link"
import { useState } from "react"
import { Search, Filter, Eye, ChevronLeft, ChevronRight, Users } from "lucide-react"

const ALL_CITIZENS = [
  { id: "8872", idFull: "ZM-2024-001-8872", name: "Mwamba Kalinda", nrc: "123456/78/9", province: "Lusaka", email: "mwamba@email.com", date: "23 Mar 2024", status: "Verified" },
  { id: "1134", idFull: "ZM-2024-002-1134", name: "Chileshe Banda", nrc: "234567/89/1", province: "Copperbelt", email: "chileshe@email.com", date: "22 Mar 2024", status: "Verified" },
  { id: "5520", idFull: "ZM-2024-003-5520", name: "Mutale Phiri", nrc: "345678/90/2", province: "Eastern", email: "mutale@email.com", date: "21 Mar 2024", status: "Pending" },
  { id: "8801", idFull: "ZM-2024-004-8801", name: "Namwaka Tembo", nrc: "456789/01/3", province: "Southern", email: "namwaka@email.com", date: "20 Mar 2024", status: "Verified" },
  { id: "2203", idFull: "ZM-2024-005-2203", name: "Bwalya Mwansa", nrc: "567890/12/4", province: "Northern", email: "bwalya@email.com", date: "19 Mar 2024", status: "Pending" },
  { id: "6641", idFull: "ZM-2024-006-6641", name: "Chanda Lungu", nrc: "678901/23/5", province: "Western", email: "chanda@email.com", date: "18 Mar 2024", status: "Rejected" },
  { id: "3312", idFull: "ZM-2024-007-3312", name: "Kabwe Sikazwe", nrc: "789012/34/6", province: "Luapula", email: "kabwe@email.com", date: "17 Mar 2024", status: "Verified" },
  { id: "7744", idFull: "ZM-2024-008-7744", name: "Monde Mulenga", nrc: "890123/45/7", province: "Lusaka", email: "monde@email.com", date: "16 Mar 2024", status: "Verified" },
  { id: "4456", idFull: "ZM-2024-009-4456", name: "Ngosa Chipimo", nrc: "901234/56/8", province: "Central", email: "ngosa@email.com", date: "15 Mar 2024", status: "Pending" },
  { id: "9901", idFull: "ZM-2024-010-9901", name: "Luyando Zulu", nrc: "012345/67/9", province: "North-Western", email: "luyando@email.com", date: "14 Mar 2024", status: "Verified" },
  { id: "2211", idFull: "ZM-2024-011-2211", name: "Chikumbi Nsofu", nrc: "112233/44/5", province: "Muchinga", email: "chikumbi@email.com", date: "13 Mar 2024", status: "Verified" },
  { id: "8834", idFull: "ZM-2024-012-8834", name: "Pempho Daka", nrc: "223344/55/6", province: "Copperbelt", email: "pempho@email.com", date: "12 Mar 2024", status: "Rejected" },
]

const statusColors: Record<string, string> = {
  Verified: "bg-primary/15 text-primary",
  Pending: "bg-yellow-400/15 text-yellow-400",
  Rejected: "bg-red-400/15 text-red-400",
}

const PER_PAGE = 8

export default function CitizensPage() {
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("All")
  const [page, setPage] = useState(1)

  const filtered = ALL_CITIZENS.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.idFull.toLowerCase().includes(search.toLowerCase()) || c.nrc.includes(search)
    const matchStatus = filterStatus === "All" || c.status === filterStatus
    return matchSearch && matchStatus
  })

  const total = filtered.length
  const pages = Math.ceil(total / PER_PAGE)
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

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
              placeholder="Search by name, ID, or NRC..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full rounded-lg border border-border bg-input pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            {["All", "Verified", "Pending", "Rejected"].map((s) => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); setPage(1) }}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${filterStatus === s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Citizen</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden sm:table-cell">NRC</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden md:table-cell">Province</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Registered</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Users className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-sm text-muted-foreground">No citizens found</p>
                      </div>
                    </td>
                  </tr>
                ) : paged.map((citizen) => (
                  <tr key={citizen.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                          {citizen.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-xs">{citizen.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{citizen.idFull}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground font-mono hidden sm:table-cell">{citizen.nrc}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground hidden md:table-cell">{citizen.province}</td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground hidden lg:table-cell">{citizen.date}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[citizen.status]}`}>
                        {citizen.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/admin/citizens/${citizen.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
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
        </div>
      </div>
    </div>
  )
}
