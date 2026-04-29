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
} from "lucide-react"
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

const icd11Codes = [
  { code: "BA00", description: "Acute myocardial infarction" },
  { code: "BA80", description: "Heart failure" },
  { code: "CA40", description: "Malignant neoplasm of lung" },
  { code: "1A00", description: "Cholera" },
  { code: "1A07", description: "Typhoid fever" },
  { code: "1C62", description: "HIV disease" },
  { code: "1D00", description: "Tuberculosis" },
  { code: "BD10", description: "Cerebrovascular disease" },
  { code: "JA00", description: "Pneumonia" },
  { code: "NB20", description: "Road traffic accident" },
  { code: "PA00", description: "Natural causes (old age)" },
  { code: "PB00", description: "Unknown cause" },
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
      const [allRecords, pending] = await Promise.all([
        deathRecordApi.getAll(),
        deathRecordApi.getPendingSubmissions()
      ])
      
      setRecords((allRecords as any).records || [])
      setPendingSubmissions((pending as any).pending_submissions || pending || [])
    } catch (err: any) {
      toast.error(err.detail || "Failed to fetch death records")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      if (!form.citizen_din || !form.hospital_name || !form.attended_name || !form.medical_no || !form.informant_din) {
        toast.error("Please fill in all required fields")
        return
      }

      const payload = {
        citizen_din: form.citizen_din,
        hospital_name: form.hospital_name,
        medical_no: form.medical_no,
        attended_name: form.attended_name,
        illness_start_date: form.illness_start_date,
        last_attended_alive_date: form.last_attended_alive_date,
        last_attended_alive_day: parseInt(form.last_attended_alive_day),
        death_date: form.death_date,
        death_day: parseInt(form.death_day),
        death_year: parseInt(form.death_year.toString()),
        death_time: form.death_time,
        body_identified_of: form.body_identified_of,
        age_stated: form.age_stated,
        postmortem_confirmed: form.postmortem_confirmed,
        cause_a: form.cause_a,
        cause_a_interval: form.cause_a_interval,
        cause_a_icd_code: form.cause_a_icd_code,
        cause_b: form.cause_b || "",
        cause_b_interval: form.cause_b_interval,
        cause_b_icd_code: form.cause_b_icd_code,
        cause_c: form.cause_c || "",
        cause_c_interval: form.cause_c_interval,
        cause_c_icd_code: form.cause_c_icd_code,
        other_condition_1: form.other_condition_1 || "",
        other_condition_1_interval: form.other_condition_1_interval,
        other_condition_2: form.other_condition_2 || "",
        other_condition_2_interval: form.other_condition_2_interval,
        witness_date: form.witness_date,
        certificate_handed_to: form.certificate_handed_to,
        medical_attendant_name: form.medical_attendant_name,
        medical_attendant_signature: form.medical_attendant_signature,
        medical_attendant_qualification: form.medical_attendant_qualification,
        medical_attendant_residence: form.medical_attendant_residence,
        village: form.village || "",
        chief: form.chief || "",
        district: form.district,
        informant_din: form.informant_din,
        informant_relationship: form.informant_relationship,
        informant_contact_no: form.informant_contact_no,
        informant_postal_address: form.informant_postal_address,
        informant_signature: form.informant_signature,
        informant_declaration_date: form.informant_declaration_date,
      }

      await deathRecordApi.submit(payload)
      toast.success("Death record submitted for review")
      setRegisterOpen(false)
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
      toast.error(err.detail || "Failed to submit record")
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
        <Button onClick={() => setRegisterOpen(true)} className="bg-primary hover:bg-primary/90">
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
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
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

            {/* Death Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Death Details</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Date of Death *</Label>
                  <Input
                    type="date"
                    className="bg-card border-border"
                    value={form.death_date}
                    onChange={(e) => setForm({ ...form, death_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Day of Death</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={form.death_day}
                    onChange={(e) => setForm({ ...form, death_day: e.target.value })}
                    className="bg-card border-border"
                  />
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
            </div>

            {/* Cause of Death */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">ICD-11 Cause of Death Coding</h3>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Primary Cause (A) *</Label>
                  <Input
                    placeholder="Primary cause of death"
                    value={form.cause_a}
                    onChange={(e) => setForm({ ...form, cause_a: e.target.value })}
                    className="bg-card border-border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ICD-11 Code for A</Label>
                    <Select value={form.cause_a_icd_code} onValueChange={(val) => setForm({ ...form, cause_a_icd_code: val })}>
                      <SelectTrigger className="bg-card border-border">
                        <SelectValue placeholder="Select ICD-11 code" />
                      </SelectTrigger>
                      <SelectContent>
                        {icd11Codes.map((code) => (
                          <SelectItem key={code.code} value={code.code}>
                            {code.code} - {code.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                <div className="space-y-2">
                  <Label>Secondary Cause (B)</Label>
                  <Input
                    placeholder="Secondary cause (if any)"
                    value={form.cause_b}
                    onChange={(e) => setForm({ ...form, cause_b: e.target.value })}
                    className="bg-card border-border"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>ICD-11 Code for B</Label>
                    <Select value={form.cause_b_icd_code} onValueChange={(val) => setForm({ ...form, cause_b_icd_code: val })}>
                      <SelectTrigger className="bg-card border-border">
                        <SelectValue placeholder="Select ICD-11 code" />
                      </SelectTrigger>
                      <SelectContent>
                        {icd11Codes.map((code) => (
                          <SelectItem key={code.code} value={code.code}>
                            {code.code} - {code.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
            </div>

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
                    className="bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Qualification *</Label>
                  <Input
                    placeholder="Medical qualification"
                    value={form.medical_attendant_qualification}
                    onChange={(e) => setForm({ ...form, medical_attendant_qualification: e.target.value })}
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
                    className="bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Relationship *</Label>
                  <Input
                    placeholder="Relationship to deceased"
                    value={form.informant_relationship}
                    onChange={(e) => setForm({ ...form, informant_relationship: e.target.value })}
                    className="bg-card border-border"
                  />
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

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Skull className="h-4 w-4 mr-2" />}
                {submitting ? "Submitting..." : "Register Death"}
              </Button>
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
