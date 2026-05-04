"use client"
import { useState, useEffect } from "react"
import {
  Baby, Skull, Search, Filter, FileText, Download,
  Loader2, UserCheck, CheckCircle2
} from "lucide-react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { birthRecordApi, deathRecordApi } from "@/lib/axios"
import { useRoleGuard } from "@/hooks/use-role-guard"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  DocumentViewer,
  BIRTH_CERTIFICATE_ENDPOINT,
  BIRTH_FULL_PACK_ENDPOINT,
  DEATH_CERTIFICATES_ENDPOINT,
  DEATH_FULL_PACK_ENDPOINT,
  type StreamingEndpoint,
} from "@/components/document-viewer"

export default function RegistrarCertificatesPage() {
  useRoleGuard(["REGISTRAR"])
  
  const [activeTab, setActiveTab] = useState<"birth" | "death">("birth")
  const [birthCerts, setBirthCerts] = useState<any[]>([])
  const [deathCerts, setDeathCerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  
  // Document viewer state
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerEndpoint, setViewerEndpoint] = useState<StreamingEndpoint | null>(null)
  const [viewerRecordId, setViewerRecordId] = useState<number | null>(null)
  const [viewerRecordName, setViewerRecordName] = useState("")
  const [token, setToken] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('zdid_access_token') || ''
    }
    return ''
  })

  useEffect(() => {
    fetchData()
    const stored = localStorage.getItem('zdid_access_token')
    if (stored) setToken(stored)
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [birthData, deathData] = await Promise.all([
        birthRecordApi.getAllApproved(),
        deathRecordApi.getAllApproved()
      ])
      setBirthCerts(birthData.records || [])
      setDeathCerts(deathData.records || [])
    } catch (err: any) {
      toast.error(err.detail || "Failed to fetch certificate registry")
    } finally {
      setLoading(false)
    }
  }

  function openViewer(endpoint: StreamingEndpoint, record: any, name: string) {
    setViewerEndpoint(endpoint)
    setViewerRecordId(record.id)
    setViewerRecordName(name)
    setViewerOpen(true)
  }

  const filterRecords = (records: any[], type: "birth" | "death") => {
    return records.filter(r => {
      const name = type === "birth" 
        ? `${r.child_given_name || ""} ${r.child_surname || ""}`.trim()
        : r.attended_name || r.deceasedName || ""
      
      const regNo = type === "birth" 
        ? r.birth_certificate?.reg_no || ""
        : r.death_certificate?.registration_no || ""
        
      const matchesSearch = 
        name.toLowerCase().includes(search.toLowerCase()) ||
        regNo.toLowerCase().includes(search.toLowerCase()) ||
        (r.id || "").toString().includes(search)
      
      const matchesStatus = statusFilter === "all" || r.status?.toLowerCase() === statusFilter
      return matchesSearch && matchesStatus
    })
  }

  const filteredBirths = filterRecords(birthCerts, "birth")
  const filteredDeaths = filterRecords(deathCerts, "death")

  const stats = [
    { label: "Total Issued", value: (birthCerts.length + deathCerts.length).toString(), icon: FileText, color: "text-primary", bg: "bg-primary/10" },
    { label: "Birth Certs", value: birthCerts.length.toString(), icon: Baby, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Death Certs", value: deathCerts.length.toString(), icon: Skull, color: "text-red-500", bg: "bg-red-500/10" },
    { label: "Issued Today", value: [...birthCerts, ...deathCerts].filter(r => isToday(r.reviewed_at)).length.toString(), icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  ]

  function isToday(dateString: string) {
    if (!dateString) return false
    return new Date(dateString).toDateString() === new Date().toDateString()
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Certificate Registry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View, search, and reissue all approved birth and death certificates
          </p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          <UserCheck className="h-3 w-3 mr-1" /> Registrar Archive
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.bg)}>
                  <Icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, registration number, or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-card border-border">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs & Tables */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "birth" | "death")} className="space-y-4">
        <TabsList className="bg-muted/30">
          <TabsTrigger value="birth" className="gap-2">
            <Baby className="h-4 w-4" /> Birth Certificates
            {birthCerts.length > 0 && (
              <Badge className="ml-1 bg-blue-500/20 text-blue-600 border-none text-[10px] h-4 px-1.5">
                {birthCerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="death" className="gap-2">
            <Skull className="h-4 w-4" /> Death Certificates
            {deathCerts.length > 0 && (
              <Badge className="ml-1 bg-red-500/20 text-red-600 border-none text-[10px] h-4 px-1.5">
                {deathCerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Birth Certificates Tab */}
        <TabsContent value="birth">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filteredBirths.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Baby className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p>No birth certificates found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reg No</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Child Name</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date of Birth</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">District</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Issued</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBirths.map(record => (
                      <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-primary">
                          {record.birth_certificate?.reg_no || `BR-${record.id.toString().padStart(4, '0')}`}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-600">
                              {(record.child_given_name?.[0] || "") + (record.child_surname?.[0] || "")}
                            </div>
                            <span className="font-medium text-foreground">
                              {record.child_given_name} {record.child_surname}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {record.date_of_birth ? new Date(record.date_of_birth).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{record.district || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {record.reviewed_at ? new Date(record.reviewed_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => openViewer(BIRTH_CERTIFICATE_ENDPOINT, record, `${record.child_given_name} ${record.child_surname}`)}>
                              <FileText className="h-4 w-4 mr-1" /> Certificate
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => openViewer(BIRTH_FULL_PACK_ENDPOINT, record, `${record.child_given_name} ${record.child_surname}`)}>
                              <Download className="h-4 w-4 mr-1" /> Full Pack
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Death Certificates Tab */}
        <TabsContent value="death">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
            ) : filteredDeaths.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">
                <Skull className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p>No death certificates found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reg No</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Deceased Name</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date of Death</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">District</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Issued</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeaths.map(record => (
                      <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-primary">
                          {record.death_certificate?.registration_no || `DR-${record.id.toString().padStart(4, '0')}`}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-xs font-bold text-red-600">
                              {(record.attended_name?.[0] || "U")}
                            </div>
                            <span className="font-medium text-foreground">{record.attended_name || "Unknown"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {record.death_date ? new Date(record.death_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{record.district || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">
                          {record.reviewed_at ? new Date(record.reviewed_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => openViewer(DEATH_CERTIFICATES_ENDPOINT, record, record.attended_name || "Unknown")}>
                              <FileText className="h-4 w-4 mr-1" /> Certificates
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                              onClick={() => openViewer(DEATH_FULL_PACK_ENDPOINT, record, record.attended_name || "Unknown")}>
                              <Download className="h-4 w-4 mr-1" /> Full Pack
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Full-Screen Document Viewer */}
      {viewerOpen && viewerEndpoint && viewerRecordId && (
        <DocumentViewer
          onClose={() => {
            setViewerOpen(false)
            setViewerEndpoint(null)
            setViewerRecordId(null)
          }}
          endpoint={viewerEndpoint}
          recordId={viewerRecordId}
          recordName={viewerRecordName || undefined}
          token={token}
          status={(birthCerts?.find((r: any) => r.id === viewerRecordId) || deathCerts?.find((r: any) => r.id === viewerRecordId))?.status || "APPROVED"}
        />
      )}
    </div>
  )
}