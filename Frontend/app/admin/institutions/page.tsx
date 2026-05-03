"use client"

import { useState, useEffect } from "react"
import { 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  Mail, 
  FileText,
  Search,
  ChevronRight,
  Loader2,
  AlertCircle
} from "lucide-react"
import { thirdPartyApi } from "@/lib/api/thirdParty"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const AVAILABLE_SCOPES = [
  { id: "full_name", label: "Full Name" },
  { id: "dob", label: "Date of Birth" },
  { id: "nrc", label: "NRC Number" },
  { id: "gender", label: "Gender" },
  { id: "address", label: "Residential Address" },
  { id: "phone", label: "Phone Number" },
  { id: "photo", label: "Profile Photo" },
]

export default function AdminInstitutionsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["full_name", "nrc"])
  const [rejectionReason, setRejectionReason] = useState("")
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchRequests()
  }, [])

  async function fetchRequests() {
    setLoading(true)
    try {
      const data = await thirdPartyApi.getPending()
      setRequests(data)
    } catch (err) {
      console.error(err)
      toast.error("Failed to load institution requests")
    } finally {
      setLoading(false)
    }
  }

  const toggleScope = (scopeId: string) => {
    setSelectedScopes(prev => 
      prev.includes(scopeId) 
        ? prev.filter(s => s !== scopeId) 
        : [...prev, scopeId]
    )
  }

  async function handleApprove() {
    if (!selectedRequest) return
    setProcessing(true)
    try {
      await thirdPartyApi.approve(selectedRequest.id, selectedScopes)
      toast.success(`${selectedRequest.third_party_institution_details?.name || "Institution"} has been approved.`)
      setSelectedRequest(null)
      fetchRequests()
    } catch (err: any) {
      console.error("Approval error:", err)
      const detail = err.response?.data?.detail || err.message || "Approval failed"
      toast.error(detail)
    } finally {
      setProcessing(false)
    }
  }

  async function handleReject() {
    if (!selectedRequest || !rejectionReason) return
    setProcessing(true)
    try {
      await thirdPartyApi.reject(selectedRequest.id, rejectionReason)
      toast.success("Application rejected")
      setSelectedRequest(null)
      setRejectionReason("")
      fetchRequests()
    } catch (err: any) {
      toast.error(err?.detail || "Rejection failed")
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Institutional Partners</h1>
          <p className="text-muted-foreground mt-1 text-sm">Review and authorize third-party data access requests.</p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
          <Clock className="h-3.5 w-3.5" />
          {requests.length} Pending Applications
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input 
              placeholder="Search institutions..." 
              className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-sm outline-none focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="space-y-3">
            {requests.map((req) => (
              <button
                key={req.id}
                onClick={() => {
                  setSelectedRequest(req)
                  // If backend provides pre-filled scope, use it, else default
                  if (req.third_party_institution_details?.permitted_scope?.length > 0) {
                    setSelectedScopes(req.third_party_institution_details.permitted_scope)
                  }
                }}
                className={cn(
                  "w-full text-left p-4 rounded-xl border transition-all hover:shadow-md group",
                  selectedRequest?.id === req.id 
                    ? "bg-primary/5 border-primary shadow-sm" 
                    : "bg-card border-border"
                )}
              >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Building2 className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold truncate max-w-[150px]">
                          {req.third_party_institution_details?.name || req.name || (req.id ? `Request #${req.id}` : JSON.stringify(req).substring(0, 20))}
                        </h3>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          REG: {req.third_party_institution_details?.reg_number || req.reg_number || "PENDING"}
                        </p>
                      </div>
                    </div>
                  <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", selectedRequest?.id === req.id && "rotate-90 text-primary")} />
                </div>
              </button>
            ))}

            {requests.length === 0 && (
              <div className="p-8 text-center rounded-xl border border-dashed border-border bg-card/50">
                <ShieldCheck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-xs text-muted-foreground">All caught up! No pending registrations.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Review Details */}
        <div className="lg:col-span-2">
          {selectedRequest ? (
            <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-6 border-b border-border bg-secondary/20">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedRequest.third_party_institution_details?.name || "Pending Institution"}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" /> {selectedRequest.third_party_institution_details?.email || "No email provided"}
                      </span>
                      <span className="h-3 w-[1px] bg-border" />
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" /> Registration: {selectedRequest.third_party_institution_details?.reg_number || "NOT_FOUND"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 pb-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Institution Type</p>
                    <p className="text-sm font-medium">{selectedRequest.third_party_institution_details?.institution_type || "Not Specified"}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Contact Phone</p>
                    <p className="text-sm font-medium">{selectedRequest.third_party_institution_details?.phone || "Not Provided"}</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Purpose of Access</p>
                  <p className="text-sm leading-relaxed">{selectedRequest.third_party_institution_details?.purpose || "No purpose stated"}</p>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {/* Scope Selection */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Grant Data Access Permissions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {AVAILABLE_SCOPES.map((scope) => (
                      <button
                        key={scope.id}
                        onClick={() => toggleScope(scope.id)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border text-sm transition-all",
                          selectedScopes.includes(scope.id)
                            ? "bg-primary/5 border-primary/40 text-foreground font-medium"
                            : "bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50"
                        )}
                      >
                        {scope.label}
                        {selectedScopes.includes(scope.id) ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-[1px] bg-border" />

                {/* Actions */}
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <button
                      onClick={handleApprove}
                      disabled={processing}
                      className="w-full md:flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve & Issue Credentials
                    </button>
                    
                    <button
                      onClick={() => setSelectedRequest(null)}
                      className="w-full md:w-auto px-6 py-3.5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="pt-8 mt-8 border-t border-border">
                    <h3 className="text-sm font-bold text-red-500 mb-4 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> Danger Zone
                    </h3>
                    <div className="flex gap-2">
                      <input 
                        placeholder="Reason for rejection..." 
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        className="flex-1 bg-secondary/50 border border-border rounded-lg px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-red-400"
                      />
                      <button
                        onClick={handleReject}
                        disabled={processing || !rejectionReason}
                        className="px-6 py-2 rounded-lg bg-red-500/10 text-red-500 text-xs font-bold hover:bg-red-500 hover:text-white transition-all disabled:opacity-30"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[400px] rounded-2xl border border-dashed border-border flex flex-col items-center justify-center text-center p-8 bg-card/30">
              <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground opacity-30" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Select an Institution</h2>
              <p className="text-sm text-muted-foreground max-w-xs mt-1">
                Choose an application from the list to review their details and manage data access scopes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
