"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import {
  Skull,
  Search,
  Plus,
  Filter,
  Download,
  MoreHorizontal,
  Eye,
  FileText,
  CheckCircle2,
  Clock,
  Building2,
  Home,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Stethoscope,
  Check,
  UserCheck,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
} from "lucide-react"
import { ICD11SearchInput } from "@/components/icd11-search-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { deathRecordApi } from "@/lib/axios"
import { useRoleGuard } from "@/hooks/use-role-guard"
import { toast } from "sonner"
import { cn } from "@/lib/utils"


const steps = [
  { id: 1, label: "Deceased Information" },
  { id: 2, label: "Death & Cause" },
  { id: 3, label: "Attendant & Informant" },
  { id: 4, label: "Review & Submit" },
]

export default function DeathRecordsPage() {
  useRoleGuard(["HEALTH_WORKER", "REGISTRAR"])
  
  const searchParams = useSearchParams()
  const action = searchParams.get("action")
  
  const [records, setRecords] = useState<any[]>([])
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [registerOpen, setRegisterOpen] = useState(action === "new")
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [activeTab, setActiveTab] = useState<"certified" | "pending">("certified")
  const [submitting, setSubmitting] = useState(false)
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    citizen_din: "",
    hospital_name: "",
    medical_no: "",
    attended_name: "",
    illness_start_date: "",
    last_attended_alive_date: "",
    last_attended_alive_day: "",
    death_date: "",
    death_day: "",
    death_year: new Date().getFullYear() % 100,
    death_time: "",
    body_identified_of: "",
    age_stated: "",
    postmortem_confirmed: false,
    cause_a: "",
    cause_a_interval: "",
    cause_a_icd_code: "",
    cause_b: "",
    cause_b_interval: "",
    cause_b_icd_code: "",
    cause_c: "",
    cause_c_interval: "",
    cause_c_icd_code: "",
    other_condition_1: "",
    other_condition_1_interval: "",
    other_condition_2: "",
    other_condition_2_interval: "",
    witness_date: "",
    certificate_handed_to: "",
    medical_attendant_name: "",
    medical_attendant_signature: "",
    medical_attendant_qualification: "",
    medical_attendant_residence: "",
    village: "",
    chief: "",
    district: "",
    informant_din: "",
    informant_relationship: "",
    informant_contact_no: "",
    informant_postal_address: "",
    informant_signature: "",
    informant_declaration_date: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      // Health workers can only submit records, not view all/pending records
      // These endpoints are for registrar role only
      setRecords([])
      setPendingSubmissions([])
    } catch (err: any) {
      toast.error(err.detail || "Failed to fetch death records")
    } finally {
      setLoading(false)
    }
  }

  function getStepErrors(currentStep: number) {
    const newErrors: Record<string, string> = {}
    if (currentStep === 1) {
      if (!form.citizen_din) newErrors.citizen_din = "Citizen DIN is required"
      if (!form.hospital_name) newErrors.hospital_name = "Hospital name is required"
      if (!form.medical_no) newErrors.medical_no = "Medical record number is required"
      if (!form.attended_name) newErrors.attended_name = "Deceased name is required"
    }

    if (currentStep === 2) {
      if (!form.death_date) newErrors.death_date = "Date of death is required"
      if (!form.cause_a) newErrors.cause_a = "Primary cause is required"
      if (!form.cause_a_icd_code) newErrors.cause_a_icd_code = "ICD-11 code is required"
      
      // Validate death_day - either provided or derivable from death_date
      if (!form.death_day && !form.death_date) {
        newErrors.death_day = "Day of death is required or provide date of death"
      } else if (form.death_day) {
        const day = parseInt(form.death_day)
        if (isNaN(day) || day < 1 || day > 31) {
          newErrors.death_day = "Day of death must be between 1 and 31"
        }
      }
      
      // Validate last_attended_alive_day if provided
      if (form.last_attended_alive_day) {
        const day = parseInt(form.last_attended_alive_day)
        if (isNaN(day) || day < 1) {
          newErrors.last_attended_alive_day = "Last attended alive day must be at least 1"
        }
      }
    }

    if (currentStep === 3) {
      if (!form.medical_attendant_name) newErrors.medical_attendant_name = "Medical attendant name is required"
      if (!form.medical_attendant_qualification) newErrors.medical_attendant_qualification = "Qualification is required"
      if (!form.witness_date) newErrors.witness_date = "Witness date is required"
      if (!form.informant_din) newErrors.informant_din = "Informant DIN is required"
      if (!form.informant_relationship) newErrors.informant_relationship = "Informant relationship is required"
    }

    return newErrors
  }

  function validateStep(currentStep: number) {
    const newErrors = getStepErrors(currentStep)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(step)) {
      setErrors({})
      setStep((s) => Math.min(s + 1, 4))
    }
  }

  const prevStep = () => {
    setErrors({})
    setStep((s) => Math.max(s - 1, 1))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (!validateStep(3)) {
        setStep(3)
        return
      }

      // ── Sanitise empty strings → null for optional dates / numbers ──
      const toDateOrNull = (val: string) => (val ? val : null)
      const toIntOrNull  = (val: string) => (val && !isNaN(Number(val)) ? parseInt(val) : null)

      // Derive death_day from death_date if the user didn't type one
      const derivedDeathDay = form.death_day
        ? parseInt(form.death_day)
        : form.death_date
          ? new Date(form.death_date).getDate()
          : null

      // Derive death_year from death_date as full 4-digit year
      const derivedDeathYear = form.death_date
        ? new Date(form.death_date).getFullYear()
        : null

      // Ensure required number fields have default values
      const lastAttendedAliveDay = form.last_attended_alive_day ? parseInt(form.last_attended_alive_day) : 1
      
      const payload = {
        citizen_din: form.citizen_din,
        hospital_name: form.hospital_name,
        medical_no: form.medical_no,
        attended_name: form.attended_name,
        illness_start_date: form.illness_start_date || new Date().toISOString().split("T")[0], // Default to today if not provided
        last_attended_alive_date: form.last_attended_alive_date || new Date().toISOString().split("T")[0], // Default to today
        last_attended_alive_day: lastAttendedAliveDay,
        death_date: form.death_date,                               // required
        death_day: derivedDeathDay || 1,                           // Default to 1 if null
        death_year: derivedDeathYear || new Date().getFullYear(),  // Default to current year
        death_time: form.death_time || null,
        body_identified_of: form.body_identified_of || "Unknown",
        age_stated: form.age_stated || "0",
        postmortem_confirmed: form.postmortem_confirmed,
        cause_of_death: form.cause_a,                              // Map cause_a to cause_of_death for API
        cause_a: form.cause_a,
        cause_a_interval: form.cause_a_interval || "",
        cause_a_icd_code: form.cause_a_icd_code,
        cause_b: form.cause_b || "",
        cause_b_interval: form.cause_b_interval || "",
        cause_b_icd_code: form.cause_b_icd_code || "",
        cause_c: form.cause_c || "",
        cause_c_interval: form.cause_c_interval || "",
        cause_c_icd_code: form.cause_c_icd_code || "",
        other_condition_1: form.other_condition_1 || "",
        other_condition_1_interval: form.other_condition_1_interval || "",
        other_condition_2: form.other_condition_2 || "",
        other_condition_2_interval: form.other_condition_2_interval || "",
        witness_date: form.witness_date || new Date().toISOString().split("T")[0],
        certificate_handed_to: form.certificate_handed_to || "Not specified",
        medical_attendant_name: form.medical_attendant_name,
        medical_attendant_signature: form.medical_attendant_signature || "",
        medical_attendant_qualification: form.medical_attendant_qualification,
        medical_attendant_residence: form.medical_attendant_residence || "Not specified",
        village: form.village || "",
        chief: form.chief || "",
        district: form.district || "",
        informant_din: form.informant_din,
        informant_relationship: form.informant_relationship,
        informant_contact_no: form.informant_contact_no || "",
        informant_postal_address: form.informant_postal_address || "",
        informant_signature: form.informant_signature || "",
        informant_declaration_date: form.informant_declaration_date || null,
      }

      // Guard against derived nulls for required fields
      if (payload.death_day < 1 || payload.death_day > 31) {
        toast.error("Day of death must be between 1 and 31")
        setSubmitting(false)
        return
      }

      console.log("Submitting death record with payload:", payload)
      const response = await deathRecordApi.submit(payload)
      console.log("Submission response:", response)
      toast.success("Death record submitted for review")
      setRegisterOpen(false)
      setStep(1)
      setErrors({})
      setForm({
        citizen_din: "",
        hospital_name: "",
        medical_no: "",
        attended_name: "",
        illness_start_date: "",
        last_attended_alive_date: "",
        last_attended_alive_day: "",
        death_date: "",
        death_day: "",
        death_year: new Date().getFullYear() % 100,
        death_time: "",
        body_identified_of: "",
        age_stated: "",
        postmortem_confirmed: false,
        cause_a: "",
        cause_a_interval: "",
        cause_a_icd_code: "",
        cause_b: "",
        cause_b_interval: "",
        cause_b_icd_code: "",
        cause_c: "",
        cause_c_interval: "",
        cause_c_icd_code: "",
        other_condition_1: "",
        other_condition_1_interval: "",
        other_condition_2: "",
        other_condition_2_interval: "",
        witness_date: "",
        certificate_handed_to: "",
        medical_attendant_name: "",
        medical_attendant_signature: "",
        medical_attendant_qualification: "",
        medical_attendant_residence: "",
        village: "",
        chief: "",
        district: "",
        informant_din: "",
        informant_relationship: "",
        informant_contact_no: "",
        informant_postal_address: "",
        informant_signature: "",
        informant_declaration_date: "",
      })
      fetchData()
    } catch (err: any) {
      console.error("Submission error:", err)
      console.error("Error response:", err.response?.data)
      console.error("Error status:", err.response?.status)
      toast.error(err.response?.data?.detail || err.detail || "Failed to submit record. Check console for details.")
    } finally {
      setSubmitting(false)
    }
  }

  const currentList = activeTab === "certified" ? records : pendingSubmissions

  const filteredRecords = currentList.filter((record) => {
    const name = record.attended_name || record.deceasedName || ""
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      (record.id || "").toString().toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || record.status?.toLowerCase() === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = [
    { label: "Total Deaths", value: records.length.toString(), change: "+3%", icon: Skull, color: "text-muted-foreground" },
    { label: "Hospital", value: records.filter((r: any) => r.place_of_death === "HEALTH_FACILITY").length.toString(), change: "-2%", icon: Building2, color: "text-blue-500" },
    { label: "Home", value: records.filter((r: any) => r.place_of_death === "HOME").length.toString(), change: "+8%", icon: Home, color: "text-orange-500" },
    { label: "Pending", value: pendingSubmissions.length.toString(), change: "+2", icon: AlertTriangle, color: "text-yellow-500" },
  ]

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Death Records</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register and manage death certificates with ICD-11 cause coding
          </p>
        </div>
        <Button onClick={() => { setStep(1); setErrors({}); setRegisterOpen(true) }} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          Register Death
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50", stat.color)}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab("certified")}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
            activeTab === "certified" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All Records
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
            activeTab === "pending" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Pending Submissions
          {pendingSubmissions.length > 0 && (
            <Badge className="ml-2 bg-primary/20 text-primary border-none text-[10px] h-4 px-1.5">
              {pendingSubmissions.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or record ID..."
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
        <Button variant="outline" className="border-border">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Place of Death</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Primary Cause</th>
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
                    No records found
                  </td>
                </tr>
              ) : filteredRecords.map((record) => (
                <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary">DR-{record.id?.toString().padStart(4, '0')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-xs font-bold text-muted-foreground">
                        {record.attended_name?.[0] || "?"}
                      </div>
                      <span className="font-medium text-foreground">{record.attended_name || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {record.death_date ? new Date(record.death_date).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {record.place_of_death === "HEALTH_FACILITY" ? "Hospital" : record.place_of_death === "HOME" ? "Home" : "Other"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{record.cause_a || "-"}</td>
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
                      {record.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedRecord(record)}>
                          <Eye className="h-4 w-4 mr-2" /> View Details
                        </DropdownMenuItem>
                        {record.status === "APPROVED" && (
                          <DropdownMenuItem>
                            <FileText className="h-4 w-4 mr-2" /> Download Permit
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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

      {/* Register Death Dialog */}
      <Dialog open={registerOpen} onOpenChange={(open) => { setRegisterOpen(open); if (!open) { setStep(1); setErrors({}) } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Register Death Certificate (MCCD)
            </DialogTitle>
            <DialogDescription>
              Enter medical certificate of cause of death details with ICD-11 coding
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="flex items-center justify-between mt-4 gap-2">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors border",
                      step > s.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : step === s.id
                        ? "bg-primary/10 text-primary border-primary"
                        : "bg-muted text-muted-foreground border-border"
                    )}
                  >
                    {s.id}
                  </div>
                  <span className={cn("ml-2 text-xs font-medium hidden sm:block", step >= s.id ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                  {i < steps.length - 1 && (
                    <div className={cn("flex-1 h-px mx-3", step > s.id ? "bg-primary" : "bg-border")}></div>
                  )}
                </div>
              ))}
            </div>

            {step === 1 && (
              <>
                {/* Deceased Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Deceased Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Citizen DIN *</Label>
                  <Input
                    placeholder="e.g., ZM-123456-01-1"
                    value={form.citizen_din}
                    onChange={(e) => setForm({ ...form, citizen_din: e.target.value })}
                    className="bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hospital Name *</Label>
                  <Input
                    placeholder="Enter hospital name"
                    value={form.hospital_name}
                    onChange={(e) => setForm({ ...form, hospital_name: e.target.value })}
                    className="bg-card border-border"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Medical Record No. *</Label>
                  <Input
                    placeholder="Enter medical record number"
                    value={form.medical_no}
                    onChange={(e) => setForm({ ...form, medical_no: e.target.value })}
                    className="bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Deceased Name *</Label>
                  <Input
                    placeholder="Enter full name"
                    value={form.attended_name}
                    onChange={(e) => setForm({ ...form, attended_name: e.target.value })}
                    className="bg-card border-border"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input
                    type="date"
                    className="bg-card border-border"
                    value={form.illness_start_date}
                    onChange={(e) => setForm({ ...form, illness_start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Age at Death</Label>
                  <Input
                    placeholder="Age in years"
                    value={form.age_stated}
                    onChange={(e) => setForm({ ...form, age_stated: e.target.value })}
                    className="bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Body Identified By</Label>
                  <Input
                    placeholder="Name of identifier"
                    value={form.body_identified_of}
                    onChange={(e) => setForm({ ...form, body_identified_of: e.target.value })}
                    className="bg-card border-border"
                  />
                </div>
              </div>
            </div>
          </>
        )}

            {step === 2 && (
              <>
                {/* Death Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Death Details</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Date of Death *</Label>
                      <Input
                        type="date"
                        className={cn("bg-card border-border", errors.death_date && "border-red-500")}
                        value={form.death_date}
                        onChange={(e) => {
                          const value = e.target.value
                          setForm({
                            ...form,
                            death_date: value,
                            death_year: value ? Number(new Date(value).getFullYear().toString().slice(-2)) : form.death_year,
                          })
                        }}
                      />
                      {errors.death_date && (
                        <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.death_date}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Day of Death</Label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={form.death_day}
                        onChange={(e) => setForm({ ...form, death_day: e.target.value })}
                        className={cn("bg-card border-border", errors.death_day && "border-red-500")}
                      />
                      {errors.death_day && (
                        <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.death_day}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Time of Death</Label>
                      <Input
                        type="time"
                        value={form.death_time}
                        onChange={(e) => setForm({ ...form, death_time: e.target.value })}
                        className="bg-card border-border"
                      />
                    </div>
                  </div>

                  {/* Last Attended Alive Details */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label>Last Attended Alive Date</Label>
                      <Input
                        type="date"
                        value={form.last_attended_alive_date}
                        onChange={(e) => setForm({ ...form, last_attended_alive_date: e.target.value })}
                        className="bg-card border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Last Attended Alive Day</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Day number (1-31)"
                        value={form.last_attended_alive_day}
                        onChange={(e) => setForm({ ...form, last_attended_alive_day: e.target.value })}
                        className={cn("bg-card border-border", errors.last_attended_alive_day && "border-red-500")}
                      />
                      {errors.last_attended_alive_day && (
                        <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.last_attended_alive_day}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cause of Death */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">ICD-11 Cause of Death Coding</h3>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Primary Cause (A) — ICD-11 *</Label>
                        <ICD11SearchInput
                          instanceId="1"
                          value={form.cause_a_icd_code}
                          label={form.cause_a}
                          onSelect={(code, title) =>
                            setForm({ ...form, cause_a_icd_code: code, cause_a: title })
                          }
                          onClear={() =>
                            setForm({ ...form, cause_a_icd_code: "", cause_a: "" })
                          }
                          placeholder="Search ICD-11 primary cause…"
                          error={errors.cause_a_icd_code || errors.cause_a}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Interval (Days)</Label>
                        <Input
                          type="number"
                          placeholder="Days between onset and death"
                          value={form.cause_a_interval}
                          onChange={(e) => setForm({ ...form, cause_a_interval: e.target.value })}
                          className="bg-card border-border"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Secondary Cause (B) — ICD-11</Label>
                        <ICD11SearchInput
                          instanceId="2"
                          value={form.cause_b_icd_code}
                          label={form.cause_b}
                          onSelect={(code, title) =>
                            setForm({ ...form, cause_b_icd_code: code, cause_b: title })
                          }
                          onClear={() =>
                            setForm({ ...form, cause_b_icd_code: "", cause_b: "" })
                          }
                          placeholder="Search ICD-11 secondary cause…"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Interval (Days)</Label>
                        <Input
                          type="number"
                          placeholder="Days between onset and death"
                          value={form.cause_b_interval}
                          onChange={(e) => setForm({ ...form, cause_b_interval: e.target.value })}
                          className="bg-card border-border"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Tertiary Cause (C) — ICD-11</Label>
                        <ICD11SearchInput
                          instanceId="3"
                          value={form.cause_c_icd_code}
                          label={form.cause_c}
                          onSelect={(code, title) =>
                            setForm({ ...form, cause_c_icd_code: code, cause_c: title })
                          }
                          onClear={() =>
                            setForm({ ...form, cause_c_icd_code: "", cause_c: "" })
                          }
                          placeholder="Search ICD-11 tertiary cause…"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Interval (Days)</Label>
                        <Input
                          type="number"
                          placeholder="Days between onset and death"
                          value={form.cause_c_interval}
                          onChange={(e) => setForm({ ...form, cause_c_interval: e.target.value })}
                          className="bg-card border-border"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                {/* Medical Attendant Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Medical Attendant</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Attendant Name *</Label>
                      <Input
                        placeholder="Full name"
                        value={form.medical_attendant_name}
                        onChange={(e) => setForm({ ...form, medical_attendant_name: e.target.value })}
                        className={cn("bg-card border-border", errors.medical_attendant_name && "border-red-500")}
                      />
                      {errors.medical_attendant_name && (
                        <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.medical_attendant_name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Qualification *</Label>
                      <Input
                        placeholder="Medical qualification"
                        value={form.medical_attendant_qualification}
                        onChange={(e) => setForm({ ...form, medical_attendant_qualification: e.target.value })}
                        className={cn("bg-card border-border", errors.medical_attendant_qualification && "border-red-500")}
                      />
                      {errors.medical_attendant_qualification && (
                        <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.medical_attendant_qualification}</p>
                      )}
                    </div>
                  </div>

                  {/* NEW ROW */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label>Witness Date *</Label>
                      <Input
                        type="date"
                        value={form.witness_date}
                        onChange={(e) => setForm({ ...form, witness_date: e.target.value })}
                        className={cn("bg-card border-border", errors.witness_date && "border-red-500")}
                      />
                      {errors.witness_date && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />{errors.witness_date}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Certificate Handed To</Label>
                      <Input
                        placeholder="Name / address"
                        value={form.certificate_handed_to}
                        onChange={(e) => setForm({ ...form, certificate_handed_to: e.target.value })}
                        className="bg-card border-border"
                      />
                    </div>
                  </div>
                </div>

                {/* Informant Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Informant</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Informant DIN *</Label>
                      <Input
                        placeholder="e.g., ZM-123456-01-1"
                        value={form.informant_din}
                        onChange={(e) => setForm({ ...form, informant_din: e.target.value })}
                        className={cn("bg-card border-border", errors.informant_din && "border-red-500")}
                      />
                      {errors.informant_din && (
                        <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.informant_din}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Relationship *</Label>
                      <Input
                        placeholder="Relationship to deceased"
                        value={form.informant_relationship}
                        onChange={(e) => setForm({ ...form, informant_relationship: e.target.value })}
                        className={cn("bg-card border-border", errors.informant_relationship && "border-red-500")}
                      />
                      {errors.informant_relationship && (
                        <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.informant_relationship}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Number</Label>
                      <Input
                        placeholder="Phone number"
                        value={form.informant_contact_no}
                        onChange={(e) => setForm({ ...form, informant_contact_no: e.target.value })}
                        className="bg-card border-border"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Postal Address</Label>
                      <Input
                        placeholder="Address"
                        value={form.informant_postal_address}
                        onChange={(e) => setForm({ ...form, informant_postal_address: e.target.value })}
                        className="bg-card border-border"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {step === 4 && (
              <>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Review & Submit</h3>
                  <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-blue-700">Please review all details carefully before submitting.</p>
                        <p className="text-xs text-blue-600/80">Once submitted, this record will be sent to the registrar for approval and certificate generation.</p>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deceased Information</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">DIN:</span> <span className="font-mono">{form.citizen_din || "-"}</span></div>
                        <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{form.attended_name || "-"}</span></div>
                        <div><span className="text-muted-foreground">Hospital:</span> <span className="font-medium">{form.hospital_name || "-"}</span></div>
                        <div><span className="text-muted-foreground">Medical No:</span> <span className="font-mono">{form.medical_no || "-"}</span></div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Death Details</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{form.death_date ? new Date(form.death_date).toLocaleDateString() : "-"}</span></div>
                        <div><span className="text-muted-foreground">Day:</span> <span className="font-medium">{form.death_day || "-"}</span></div>
                        <div><span className="text-muted-foreground">Time:</span> <span className="font-medium">{form.death_time || "-"}</span></div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cause of Death (ICD-11)</p>
                      <div className="space-y-1 text-xs">
                        <div><span className="text-muted-foreground">Primary (A):</span> <span className="font-medium">{form.cause_a || "-"}</span></div>
                        <div><span className="text-muted-foreground">ICD-11 Code:</span> <span className="font-mono">{form.cause_a_icd_code || "-"}</span></div>
                        <div><span className="text-muted-foreground">Interval:</span> <span className="font-medium">{form.cause_a_interval ? `${form.cause_a_interval} days` : "-"}</span></div>
                        {form.cause_b && (
                          <>
                            <div className="pt-1 border-t border-border"><span className="text-muted-foreground">Secondary (B):</span> <span className="font-medium">{form.cause_b}</span></div>
                            <div><span className="text-muted-foreground">ICD-11 Code:</span> <span className="font-mono">{form.cause_b_icd_code || "-"}</span></div>
                            <div><span className="text-muted-foreground">Interval:</span> <span className="font-medium">{form.cause_b_interval ? `${form.cause_b_interval} days` : "-"}</span></div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Medical Attendant</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{form.medical_attendant_name || "-"}</span></div>
                        <div><span className="text-muted-foreground">Qualification:</span> <span className="font-medium">{form.medical_attendant_qualification || "-"}</span></div>
                        <div><span className="text-muted-foreground">Witness Date:</span> <span className="font-medium">{form.witness_date ? new Date(form.witness_date).toLocaleDateString() : "-"}</span></div>
                        <div><span className="text-muted-foreground">Certificate To:</span> <span className="font-medium">{form.certificate_handed_to || "-"}</span></div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-muted/10 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informant</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">DIN:</span> <span className="font-mono">{form.informant_din || "-"}</span></div>
                        <div><span className="text-muted-foreground">Relationship:</span> <span className="font-medium">{form.informant_relationship || "-"}</span></div>
                        <div><span className="text-muted-foreground">Contact:</span> <span className="font-medium">{form.informant_contact_no || "-"}</span></div>
                        <div><span className="text-muted-foreground">Address:</span> <span className="font-medium">{form.informant_postal_address || "-"}</span></div>
                      </div>
                    </div>

                    <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Declaration</p>
                      <p className="text-xs text-muted-foreground">
                        I hereby declare that the information provided above is true and correct to the best of my knowledge. I understand that false statements may result in rejection of this death registration.
                      </p>
                      <div className="flex items-start gap-2 pt-2">
                        <div className="flex h-4 w-4 items-center justify-center rounded border border-primary bg-primary/20">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <p className="text-xs text-foreground">I confirm all details are accurate and ready for submission.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <DialogFooter className="mt-6 flex justify-between">
              <Button type="button" variant="outline" onClick={step === 1 ? () => setRegisterOpen(false) : prevStep}>
                {step === 1 ? "Cancel" : <><ArrowLeft className="h-4 w-4 mr-2" />Back</>}
              </Button>
              {step < 4 ? (
                <Button type="button" onClick={nextStep} className="bg-primary hover:bg-primary/90">
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Skull className="h-4 w-4 mr-2" />}
                  {submitting ? "Submitting..." : "Register Death"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Record Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Death Record Details</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/50 text-lg font-bold text-muted-foreground">
                  {selectedRecord.attended_name?.[0] || "?"}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selectedRecord.attended_name}</p>
                  <p className="text-sm text-muted-foreground">DR-{selectedRecord.id?.toString().padStart(4, '0')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date of Death</p>
                  <p className="font-medium text-foreground">
                    {selectedRecord.death_date ? new Date(selectedRecord.death_date).toLocaleDateString() : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Place of Death</p>
                  <p className="font-medium text-foreground">
                    {selectedRecord.place_of_death === "HEALTH_FACILITY" ? "Hospital" : "Home"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Primary Cause</p>
                  <p className="font-medium text-foreground">{selectedRecord.cause_a || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-medium capitalize mt-1",
                      selectedRecord.status === "APPROVED" && "border-green-500/30 bg-green-500/10 text-green-500",
                      selectedRecord.status === "PENDING" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                      selectedRecord.status === "REJECTED" && "border-red-500/30 bg-red-500/10 text-red-500"
                    )}
                  >
                    {selectedRecord.status}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
