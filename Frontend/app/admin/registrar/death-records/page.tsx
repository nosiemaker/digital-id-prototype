// app/admin/registrar/death-records/page.tsx
"use client"

import { useState, useEffect } from "react"
import {
  Skull,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  UserCheck,
  Hash,
  Calendar,
  Stethoscope,
  FileText,
  Home,
  Building2,
  MapPin,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { deathRecordApi, type RecordRejection } from "@/lib/axios"
import { useRoleGuard } from "@/hooks/use-role-guard"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  DocumentViewerDialog,
  DEATH_REVIEW_ENDPOINT,
  DEATH_CERTIFICATES_ENDPOINT,
  DEATH_FULL_PACK_ENDPOINT,
} from "@/components/document-viewer"

export default function RegistrarDeathRecordsPage() {
  useRoleGuard(["REGISTRAR"])

  const [records, setRecords] = useState<any[]>([])
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending")
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [reviewRecord, setReviewRecord] = useState<any | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  // Document viewer state
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerEndpoint, setViewerEndpoint] = useState<any>(null)
  const [viewerRecordId, setViewerRecordId] = useState<number | null>(null)

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [allData, pendingData] = await Promise.all([
        deathRecordApi.getAll(),
        deathRecordApi.getPendingSubmissions()
      ])

      setRecords(allData.records || [])
      setPendingSubmissions(pendingData.pending_submissions || [])
    } catch (err: any) {
      toast.error(err.detail || "Failed to fetch death records")
    } finally {
      setLoading(false)
    }
  }

  async function handleApprove(recordId: number) {
    setActionLoading(true)
    try {
      const result = await deathRecordApi.approve(recordId)
      toast.success(`Death record approved. Death Certificate (${result.death_certificate_id}) and Burial Permit (${result.burial_permit_id}) generated.`)
      setReviewRecord(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.detail || "Approval failed")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReject(recordId: number) {
    if (!rejectionReason.trim() || rejectionReason.trim().length < 10) {
      toast.error("Rejection reason must be at least 10 characters")
      return
    }

    setActionLoading(true)
    try {
      const payload: RecordRejection = { rejection_reason: rejectionReason.trim() }
      await deathRecordApi.reject(recordId, payload)
      toast.success("Death record rejected")
      setShowRejectDialog(false)
      setRejectionReason("")
      setReviewRecord(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.detail || "Rejection failed")
    } finally {
      setActionLoading(false)
    }
  }

  // Document viewer helpers
  function openDocumentViewer(endpoint: any, record: any) {
    setViewerEndpoint(endpoint)
    setViewerRecordId(record.id)
    setViewerOpen(true)
  }

  const currentList = activeTab === "pending" ? pendingSubmissions : records

  const filteredRecords = currentList.filter((record) => {
    const name = record.attended_name || record.deceasedName || ""
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      (record.id || "").toString().toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || record.status?.toLowerCase() === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = [
    { 
      label: "Pending Review", 
      value: pendingSubmissions.length.toString(), 
      icon: Clock, 
      color: "text-yellow-500",
      bg: "bg-yellow-500/10" 
    },
    { 
      label: "Approved Today", 
      value: records.filter((r: any) => r.status === "APPROVED" && isToday(r.reviewed_at)).length.toString(), 
      icon: CheckCircle2, 
      color: "text-green-500",
      bg: "bg-green-500/10"
    },
    { 
      label: "Rejected Today", 
      value: records.filter((r: any) => r.status === "REJECTED" && isToday(r.reviewed_at)).length.toString(), 
      icon: XCircle, 
      color: "text-red-500",
      bg: "bg-red-500/10"
    },
    { 
      label: "Total Processed", 
      value: records.filter((r: any) => r.status !== "PENDING").length.toString(), 
      icon: UserCheck, 
      color: "text-primary",
      bg: "bg-primary/10"
    },
  ]

  function isToday(dateString: string) {
    if (!dateString) return false
    const date = new Date(dateString)
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Death Record Reviews</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve death registrations submitted by Health Workers
          </p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          <UserCheck className="h-3 w-3 mr-1" />
          Registrar Access
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
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

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
            activeTab === "pending" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Pending Review
          {pendingSubmissions.length > 0 && (
            <Badge className="ml-2 bg-yellow-500/20 text-yellow-600 border-none text-[10px] h-4 px-1.5">
              {pendingSubmissions.length}
            </Badge>
          )}
        </button>
        <button
          onClick={() => setActiveTab("all")}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
            activeTab === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All Records
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by deceased name, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Record ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Deceased Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date of Death</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cause (ICD-11)</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Place</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {activeTab === "pending" ? "No pending submissions to review" : "No records found"}
                  </td>
                </tr>
              ) : filteredRecords.map((record) => (
                <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary">
                    DR-{record.id?.toString().padStart(4, '0')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                        {(record.attended_name?.[0] || "U")}
                      </div>
                      <span className="font-medium text-foreground">
                        {record.attended_name || "Unknown"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {record.death_date ? new Date(record.death_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-primary">{record.cause_a_icd_code || record.cause_a?.substring(0, 20)}</code>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {record.place_of_death === "HEALTH_FACILITY" ? (
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> Facility</span>
                    ) : record.place_of_death === "HOME" ? (
                      <span className="flex items-center gap-1"><Home className="h-3 w-3" /> Home</span>
                    ) : (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Other</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium capitalize",
                        record.status === "APPROVED" && "border-green-500/30 bg-green-500/10 text-green-500",
                        record.status === "PENDING" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                        record.status === "REJECTED" && "border-red-500/30 bg-red-500/10 text-red-500"
                      )}
                    >
                      {record.status === "APPROVED" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {record.status === "PENDING" && <Clock className="h-3 w-3 mr-1" />}
                      {record.status === "REJECTED" && <XCircle className="h-3 w-3 mr-1" />}
                      {record.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => setSelectedRecord(record)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      {/* Document Actions based on status */}
                      {record.status === "PENDING" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => openDocumentViewer(DEATH_REVIEW_ENDPOINT, record)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          Review Docs
                        </Button>
                      )}

                      {record.status === "APPROVED" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => openDocumentViewer(DEATH_CERTIFICATES_ENDPOINT, record)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Certificates
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => openDocumentViewer(DEATH_FULL_PACK_ENDPOINT, record)}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            Full Pack
                          </Button>
                        </>
                      )}

                      {record.status === "PENDING" && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 px-3 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => setReviewRecord(record)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Showing {filteredRecords.length} of {currentList.length} records
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled className="h-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground">Page 1 of 1</span>
            <Button variant="outline" size="sm" disabled className="h-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* View Record Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Death Record Details</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-6 mt-4">
              {/* Identity Header */}
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground">
                  {selectedRecord.attended_name?.[0] || "U"}
                </div>
                <div>
                  <p className="font-bold text-lg text-foreground">
                    {selectedRecord.attended_name || "Unknown"}
                  </p>
                  <p className="text-sm text-muted-foreground font-mono">
                    DR-{selectedRecord.id?.toString().padStart(4, '0')}
                  </p>
                  {selectedRecord.death_certificate_id && (
                    <p className="text-sm font-mono text-green-600 mt-1">
                      <FileText className="h-3 w-3 inline mr-1" />
                      Certificate: {selectedRecord.death_certificate_id}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "ml-auto text-xs font-medium capitalize",
                    selectedRecord.status === "APPROVED" && "border-green-500/30 bg-green-500/10 text-green-500",
                    selectedRecord.status === "PENDING" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                    selectedRecord.status === "REJECTED" && "border-red-500/30 bg-red-500/10 text-red-500"
                  )}
                >
                  {selectedRecord.status}
                </Badge>
              </div>

              {/* MCCD Details */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Stethoscope className="h-3.5 w-3.5" />
                  Medical Certificate of Cause of Death
                </h4>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Medical No</p>
                    <p className="font-medium font-mono">{selectedRecord.medical_no}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Date of Death</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(selectedRecord.death_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Age Stated</p>
                    <p className="font-medium">{selectedRecord.age_stated}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Post-mortem</p>
                    <p className="font-medium">{selectedRecord.postmortem_confirmed ? "Confirmed" : "Not confirmed"}</p>
                  </div>
                </div>

                {/* Cause of Death Chain */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Cause of Death (Part I)</p>
                  <div className="space-y-1">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">(a)</span>
                      <p className="text-sm">{selectedRecord.cause_a}</p>
                    </div>
                    {selectedRecord.cause_b && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">(b)</span>
                        <p className="text-sm">{selectedRecord.cause_b}</p>
                      </div>
                    )}
                    {selectedRecord.cause_c && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">(c)</span>
                        <p className="text-sm">{selectedRecord.cause_c}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">Medical Attendant</p>
                  <p className="text-sm font-medium">{selectedRecord.medical_attendant_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedRecord.medical_attendant_qualification}</p>
                </div>
              </div>

              {/* Document Actions in Detail View */}
              <div className="rounded-lg border border-border p-4 space-y-3">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  Documents
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedRecord.status === "PENDING" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-primary text-primary hover:bg-primary/10"
                      onClick={() => {
                        setSelectedRecord(null)
                        openDocumentViewer(DEATH_REVIEW_ENDPOINT, selectedRecord)
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1.5" />
                      Review MCCD + Notice of Death
                    </Button>
                  )}
                  {selectedRecord.status === "APPROVED" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-green-500 text-green-600 hover:bg-green-50"
                        onClick={() => {
                          setSelectedRecord(null)
                          openDocumentViewer(DEATH_CERTIFICATES_ENDPOINT, selectedRecord)
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1.5" />
                        View Death Certificate + Burial Permit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-primary text-primary hover:bg-primary/10"
                        onClick={() => {
                          setSelectedRecord(null)
                          openDocumentViewer(DEATH_FULL_PACK_ENDPOINT, selectedRecord)
                        }}
                      >
                        <FileText className="h-4 w-4 mr-1.5" />
                        Download Full Pack (4 docs)
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Informant Details */}
              <div className="rounded-lg border border-border p-4 space-y-2">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Informant</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">DIN:</span>
                    <span className="ml-2 font-mono">{selectedRecord.informant_din}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Relationship:</span>
                    <span className="ml-2">{selectedRecord.informant_relationship}</span>
                  </div>
                </div>
              </div>

              {/* Status Timeline */}
              <div className="rounded-lg border border-border p-4 space-y-2">
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Timeline</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">MCCD Submitted:</span>
                    <span>{new Date(selectedRecord.created_at).toLocaleString()}</span>
                  </div>
                  {selectedRecord.notice_of_death && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Notice of Death:</span>
                      <span className="text-green-600">Attached</span>
                    </div>
                  )}
                  {selectedRecord.reviewed_at && (
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Reviewed:</span>
                      <span>{new Date(selectedRecord.reviewed_at).toLocaleString()}</span>
                    </div>
                  )}
                  {selectedRecord.rejection_reason && (
                    <div className="rounded-md bg-red-50 border border-red-200 p-2 mt-2">
                      <p className="text-xs text-red-600 font-medium">Rejection Reason:</p>
                      <p className="text-sm text-red-700">{selectedRecord.rejection_reason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Warning if Notice of Death missing */}
              {selectedRecord.status === "PENDING" && !selectedRecord.notice_of_death && (
                <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800">Notice of Death Required</p>
                    <p className="text-sm text-yellow-700">
                      This record cannot be approved until the informant attaches the Notice of Death (DNRPC form).
                    </p>
                  </div>
                </div>
              )}

              {/* Actions for pending records */}
              {selectedRecord.status === "PENDING" && selectedRecord.notice_of_death && (
                <div className="flex gap-3 pt-4 border-t border-border">
                  <Button 
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      setSelectedRecord(null)
                      setReviewRecord(selectedRecord)
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve Record
                  </Button>
                  <Button 
                    variant="outline" 
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setSelectedRecord(null)
                      setReviewRecord(selectedRecord)
                      setShowRejectDialog(true)
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Record
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review/Approve Dialog */}
      <Dialog open={!!reviewRecord && !showRejectDialog} onOpenChange={() => setReviewRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Review Death Record
            </DialogTitle>
            <DialogDescription>
              Please verify all details before approving. This will generate a Death Certificate and Burial Permit.
            </DialogDescription>
          </DialogHeader>

          {reviewRecord && (
            <div className="space-y-4 mt-4">
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                <div className="flex items-start gap-3">
                  <Skull className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">{reviewRecord.attended_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Died: {new Date(reviewRecord.death_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Cause: {reviewRecord.cause_a}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pre-approval document review link */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Pre-Approval Review:</h4>
                <p className="text-sm text-blue-700 mb-3">
                  Before approving, review the submitted MCCD and Notice of Death to verify all details are correct.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  onClick={() => {
                    setReviewRecord(null)
                    openDocumentViewer(DEATH_REVIEW_ENDPOINT, reviewRecord)
                  }}
                >
                  <Eye className="h-4 w-4 mr-1.5" />
                  Review MCCD + Notice of Death
                </Button>
              </div>

              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Actions on Approval:</h4>
                <ul className="space-y-1 text-sm text-blue-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" />
                    Generate Death Certificate
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" />
                    Generate Burial Permit (Form XI)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3" />
                    Update deceased Citizen status to DECEASED
                  </li>
                </ul>
              </div>

              <DialogFooter className="gap-3">
                <Button variant="outline" onClick={() => setReviewRecord(null)}>
                  Cancel
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(reviewRecord.id)}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  {actionLoading ? "Processing..." : "Confirm Approval"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={(open) => {
        if (!open) {
          setShowRejectDialog(false)
          setRejectionReason("")
          if (!reviewRecord) setReviewRecord(null)
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Reject Death Record
            </DialogTitle>
            <DialogDescription>
              Please provide a detailed reason for rejection. This will be visible to the submitting Health Worker.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {reviewRecord && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm font-medium">
                  {reviewRecord.attended_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  DR-{reviewRecord.id?.toString().padStart(4, '0')}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rejection-reason">
                Rejection Reason <span className="text-red-500">*</span>
                <span className="text-muted-foreground font-normal text-xs"> (minimum 10 characters)</span>
              </Label>
              <Textarea
                id="rejection-reason"
                placeholder="e.g., Informant DIN not found, MCCD incomplete, deceased not in registry..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                {rejectionReason.trim().length}/10 characters minimum
              </p>
            </div>

            <DialogFooter className="gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowRejectDialog(false)
                  setRejectionReason("")
                }}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={() => handleReject(reviewRecord!.id)}
                disabled={actionLoading || rejectionReason.trim().length < 10}
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                {actionLoading ? "Processing..." : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Viewer Dialog */}
      {viewerEndpoint && viewerRecordId && (
        <DocumentViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          endpoint={viewerEndpoint}
          recordId={viewerRecordId}
          token={token}
          status={records.find(r => r.id === viewerRecordId)?.status || "PENDING"}
        />
      )}
    </div>
  )
}