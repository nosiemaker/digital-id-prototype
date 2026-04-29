"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  Baby, Search, Plus, Filter, Download, MoreHorizontal, Eye, FileText,
  CheckCircle2, Clock, Building2, Home, ChevronLeft, ChevronRight, Loader2,
  AlertCircle, ArrowRight, ArrowLeft, Check
} from "lucide-react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { birthRecordApi, type BirthRecordSubmission } from "@/lib/axios"
import { useRoleGuard } from "@/hooks/use-role-guard"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const languages = [
  { code: "en", label: "English" }, { code: "bem", label: "Bemba" },
  { code: "nya", label: "Nyanja" }, { code: "ton", label: "Tonga" },
  { code: "loz", label: "Lozi" }, { code: "kqn", label: "Kaonde" },
  { code: "lun", label: "Lunda" },
]

const steps = [
  { id: 1, label: "Child & Birth Details" },
  { id: 2, label: "Parent Information" },
  { id: 3, label: "Attendance & Sign-off" },
]

// Extend the type to include additional fields
type ExtendedBirthRecordSubmission = BirthRecordSubmission & {
  home_address?: string
}

export default function BirthRecordsPage() {
  useRoleGuard(["HEALTH_WORKER", "REGISTRAR"])
  const router = useRouter()
  const searchParams = useSearchParams()
  const action = searchParams.get("action")

  const [records, setRecords] = useState<any[]>([])
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [registerOpen, setRegisterOpen] = useState(action === "new")
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [language, setLanguage] = useState("en")
  const [activeTab, setActiveTab] = useState<"certified" | "pending">("certified")
  const [submitting, setSubmitting] = useState(false)
  
  // Multi-step state
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<Partial<ExtendedBirthRecordSubmission>>({
    date_of_birth: new Date().toISOString().split('T')[0],
    sex: "MALE",
    place_of_birth: "HEALTH_FACILITY",
    attendant_at_birth: "MIDWIFE",
    marital_status: "MARRIED",
    date_and_time_of_birth_notification: new Date().toISOString(),
  })

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [allRecords, pending] = await Promise.all([
        birthRecordApi.getAll(),
        birthRecordApi.getPendingSubmissions()
      ])
      
      setRecords(allRecords.records || [])
      setPendingSubmissions(pending.pending_submissions || [])
    } catch (err: any) {
      toast.error(err.detail || "Failed to fetch birth records")
    } finally {
      setLoading(false)
    }
  }

  function validateStep(currentStep: number): boolean {
    const newErrors: Record<string, string> = {}
    if (currentStep === 1) {
      if (!form.child_surname) newErrors.child_surname = "Surname is required"
      if (!form.child_given_name) newErrors.child_given_name = "Given name is required"
      if (!form.date_of_birth) newErrors.date_of_birth = "Date of birth is required"
      if (!form.birth_weight_kg) newErrors.birth_weight_kg = "Weight is required"
      if (!form.place_of_birth) newErrors.place_of_birth = "Place of birth is required"
      if (form.place_of_birth === "HEALTH_FACILITY" && !form.health_facility_name) newErrors.health_facility_name = "Facility name is required"
      if (form.place_of_birth === "HOME" && !form.home_address) newErrors.home_address = "Home address is required"
      if (!form.district) newErrors.district = "District is required"
    } else if (currentStep === 2) {
      if (!form.mother_din) newErrors.mother_din = "Mother's DIN is required"
    } else if (currentStep === 3) {
      if (!form.attendant_at_birth) newErrors.attendant_at_birth = "Attendant is required"
      if (form.attendant_at_birth === "OTHER" && !form.attendant_other_specified) newErrors.attendant_other_specified = "Please specify attendant"
      if (!form.marital_status) newErrors.marital_status = "Marital status is required"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => { if (validateStep(step)) { setErrors({}); setStep(s => Math.min(s + 1, 3)) } }
  const prevStep = () => { setErrors({}); setStep(s => Math.max(s - 1, 1)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep(3)) return
    setSubmitting(true)
    try {
      const payload: BirthRecordSubmission = {
        mother_din: form.mother_din!,
        father_din: form.father_din || "",
        district: form.district!,
        date_and_time_of_birth_notification: form.date_and_time_of_birth_notification || new Date().toISOString(),
        date_of_birth: form.date_of_birth!,
        place_of_birth: form.place_of_birth as any,
        health_facility_name: form.health_facility_name,
        other_place_specified: form.other_place_specified,
        child_surname: form.child_surname!,
        child_given_name: form.child_given_name!,
        child_other_names: form.child_other_names,
        sex: form.sex as any,
        birth_weight_kg: parseFloat(form.birth_weight_kg as any) || 3.0,
        father_village_of_origin: form.father_village_of_origin,
        father_chief: form.father_chief,
        father_district: form.father_district,
        father_tribe: form.father_tribe,
        mother_village_of_origin: form.mother_village_of_origin,
        mother_chief: form.mother_chief,
        mother_district: form.mother_district,
        mother_tribe: form.mother_tribe,
        mother_usual_place_of_residence: form.mother_usual_place_of_residence,
        attendant_at_birth: form.attendant_at_birth as any,
        attendant_other_specified: form.attendant_at_birth === "OTHER" ? form.attendant_other_specified : undefined,
        marital_status: form.marital_status as any,
        father_acknowledgement_signature: form.marital_status === "NOT_MARRIED" ? form.father_acknowledgement_signature : undefined,
        father_acknowledgement_date: form.marital_status === "NOT_MARRIED" ? form.father_acknowledgement_date : undefined,
        mother_consent_signature: form.marital_status === "NOT_MARRIED" ? form.mother_consent_signature : undefined,
        mother_consent_date: form.marital_status === "NOT_MARRIED" ? form.mother_consent_date : undefined,
        file_number: form.file_number,
        place_of_birth_text: form.place_of_birth_text,
        time_of_birth: form.time_of_birth,
        officer_in_charge: form.officer_in_charge,
        official_stamp_ref: form.official_stamp_ref,
        date_signed: form.date_signed,
      }

      await birthRecordApi.submit(payload)
      toast.success("Birth record submitted for review")
      setRegisterOpen(false)
      setStep(1)
      setForm({
        date_of_birth: new Date().toISOString().split('T')[0],
        sex: "MALE",
        place_of_birth: "HEALTH_FACILITY",
        attendant_at_birth: "MIDWIFE",
        marital_status: "MARRIED",
        date_and_time_of_birth_notification: new Date().toISOString(),
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
    const name = record.childName || `${record.child_given_name || ""} ${record.child_surname || ""}` || ""
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      (record.id || "").toString().toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || record.status?.toLowerCase() === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = [
    { label: "Total Births", value: records.length.toString(), change: "+12%", icon: Baby },
    { label: "Hospital Births", value: records.filter((r: any) => r.place_of_birth === "HEALTH_FACILITY").length.toString(), change: "+8%", icon: Building2 },
    { label: "Home Births", value: records.filter((r: any) => r.place_of_birth === "HOME").length.toString(), change: "+18%", icon: Home },
    { label: "Pending Approval", value: pendingSubmissions.length.toString(), change: "-5%", icon: Clock },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Birth Records</h1>
          <p className="text-sm text-muted-foreground">Register and manage birth certificates across Zambia</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { setRegisterOpen(true); setStep(1) }} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Register Birth
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <span className={cn("text-xs font-medium", stat.change.startsWith("+") ? "text-green-500" : "text-red-500")}>
                  {stat.change}
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg w-fit">
        <button onClick={() => setActiveTab("certified")} className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-all", activeTab === "certified" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          All Records
        </button>
        <button onClick={() => setActiveTab("pending")} className={cn("px-4 py-1.5 text-sm font-medium rounded-md transition-all", activeTab === "pending" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
          Pending Submissions
          {pendingSubmissions.length > 0 && (
            <Badge className="ml-2 bg-primary/20 text-primary border-none text-[10px] h-4 px-1.5">{pendingSubmissions.length}</Badge>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
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
          <Download className="h-4 w-4 mr-2" /> Export
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Record ID</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Child Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sex</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date of Birth</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mother DIN</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No records found</td></tr>
              ) : filteredRecords.map((record) => (
                <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary">BR-{record.id?.toString().padStart(4, '0')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {(record.child_given_name?.[0] || "") + (record.child_surname?.[0] || "")}
                      </div>
                      <span className="font-medium text-foreground">{record.child_given_name} {record.child_surname}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{record.sex}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(record.date_of_birth).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{record.mother_din}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn("text-xs font-medium capitalize",
                      record.status === "APPROVED" && "border-green-500/30 bg-green-500/10 text-green-500",
                      record.status === "PENDING" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                      record.status === "REJECTED" && "border-red-500/30 bg-red-500/10 text-red-500"
                    )}>
                      {record.status === "APPROVED" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {record.status === "PENDING" && <Clock className="h-3 w-3 mr-1" />}
                      {record.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedRecord(record)}><Eye className="h-4 w-4 mr-2" /> View Details</DropdownMenuItem>
                        {record.status === "APPROVED" && <DropdownMenuItem><FileText className="h-4 w-4 mr-2" /> View Certificate</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-muted-foreground">Showing {filteredRecords.length} of {currentList.length} records</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled className="h-8"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-xs text-muted-foreground">Page 1 of 1</span>
            <Button variant="outline" size="sm" disabled className="h-8"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </div>

      {/* Register Birth Dialog (Multi-Step) */}
      <Dialog open={registerOpen} onOpenChange={(open) => { setRegisterOpen(open); if (!open) { setStep(1); setErrors({}) } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle>Register New Birth</DialogTitle>
            <DialogDescription>Complete the steps below. Serial numbers are auto-generated by the system.</DialogDescription>
            
            {/* Step Indicator */}
            <div className="flex items-center justify-between mt-4 px-2">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors border",
                    step > s.id ? "bg-primary text-primary-foreground border-primary" :
                    step === s.id ? "bg-primary/10 text-primary border-primary" :
                    "bg-muted text-muted-foreground border-border"
                  )}>
                    {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                  </div>
                  <span className={cn("ml-2 text-xs font-medium hidden sm:block", step >= s.id ? "text-foreground" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                  {i < steps.length - 1 && (
                    <div className={cn("flex-1 h-px mx-3", step > s.id ? "bg-primary" : "bg-border")} />
                  )}
                </div>
              ))}
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
            {/* STEP 1: Child & Birth Details */}
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Child Surname *</Label>
                    <Input value={form.child_surname || ""} onChange={(e) => setForm({ ...form, child_surname: e.target.value })} className={cn(errors.child_surname && "border-red-500")} />
                    {errors.child_surname && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.child_surname}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Given Name *</Label>
                    <Input value={form.child_given_name || ""} onChange={(e) => setForm({ ...form, child_given_name: e.target.value })} className={cn(errors.child_given_name && "border-red-500")} />
                    {errors.child_given_name && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.child_given_name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Other Names</Label>
                    <Input value={form.child_other_names || ""} onChange={(e) => setForm({ ...form, child_other_names: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Sex *</Label>
                    <Select value={form.sex} onValueChange={(val) => setForm({ ...form, sex: val as any })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="MALE">Male</SelectItem><SelectItem value="FEMALE">Female</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth *</Label>
                    <Input type="date" value={form.date_of_birth || ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className={cn(errors.date_of_birth && "border-red-500")} />
                    {errors.date_of_birth && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.date_of_birth}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Birth Weight (kg) *</Label>
                    <Input type="number" step="0.1" placeholder="3.5" value={form.birth_weight_kg || ""} onChange={(e) => setForm({ ...form, birth_weight_kg: parseFloat(e.target.value) })} className={cn(errors.birth_weight_kg && "border-red-500")} />
                    {errors.birth_weight_kg && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.birth_weight_kg}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Place of Birth *</Label>
                    <Select value={form.place_of_birth} onValueChange={(val) => setForm({ ...form, place_of_birth: val as any, health_facility_name: undefined })}>
                      <SelectTrigger className={cn(errors.place_of_birth && "border-red-500")}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HEALTH_FACILITY">Health Facility</SelectItem>
                        <SelectItem value="HOME">Home</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.place_of_birth && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.place_of_birth}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>District *</Label>
                    <Select value={form.district} onValueChange={(val) => setForm({ ...form, district: val })}>
                      <SelectTrigger className={cn(errors.district && "border-red-500")}><SelectValue placeholder="Select district" /></SelectTrigger>
                      <SelectContent>
                        {["Lusaka","Copperbelt","Eastern","Western","Northern","Southern","Central","Luapula","North-Western","Muchinga"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {errors.district && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.district}</p>}
                  </div>
                </div>

                {/* Conditional Place Fields */}
                {form.place_of_birth === "HEALTH_FACILITY" && (
                  <div className="space-y-2">
                    <Label>Health Facility Name *</Label>
                    <Input placeholder="e.g., University Teaching Hospital" value={form.health_facility_name || ""} onChange={(e) => setForm({ ...form, health_facility_name: e.target.value })} className={cn(errors.health_facility_name && "border-red-500")} />
                    {errors.health_facility_name && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.health_facility_name}</p>}
                  </div>
                )}
                {form.place_of_birth === "HOME" && (
                  <div className="space-y-2">
                    <Label>Home Address *</Label>
                    <Input placeholder="Plot number, street, village" value={form.home_address || ""} onChange={(e) => setForm({ ...form, home_address: e.target.value })} className={cn(errors.home_address && "border-red-500")} />
                    {errors.home_address && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.home_address}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Notification Date & Time *</Label>
                  <Input type="datetime-local" value={form.date_and_time_of_birth_notification?.slice(0,16) || ""} onChange={(e) => setForm({ ...form, date_and_time_of_birth_notification: new Date(e.target.value).toISOString() })} />
                </div>
              </div>
            )}

            {/* STEP 2: Parent Information */}
            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mother's DIN *</Label>
                    <Input placeholder="e.g., 123456/01/1" value={form.mother_din || ""} onChange={(e) => setForm({ ...form, mother_din: e.target.value })} className={cn(errors.mother_din && "border-red-500")} />
                    {errors.mother_din && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.mother_din}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Father's DIN (Optional)</Label>
                    <Input placeholder="e.g., 654321/01/1" value={form.father_din || ""} onChange={(e) => setForm({ ...form, father_din: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/10">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mother's Tribal Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Village of Origin" value={form.mother_village_of_origin || ""} onChange={(e) => setForm({ ...form, mother_village_of_origin: e.target.value })} />
                      <Input placeholder="Chief" value={form.mother_chief || ""} onChange={(e) => setForm({ ...form, mother_chief: e.target.value })} />
                      <Input placeholder="District" value={form.mother_district || ""} onChange={(e) => setForm({ ...form, mother_district: e.target.value })} />
                      <Input placeholder="Tribe" value={form.mother_tribe || ""} onChange={(e) => setForm({ ...form, mother_tribe: e.target.value })} />
                    </div>
                    <Input placeholder="Usual Place of Residence" value={form.mother_usual_place_of_residence || ""} onChange={(e) => setForm({ ...form, mother_usual_place_of_residence: e.target.value })} />
                  </div>
                  <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/10">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Father's Tribal Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Input placeholder="Village of Origin" value={form.father_village_of_origin || ""} onChange={(e) => setForm({ ...form, father_village_of_origin: e.target.value })} />
                      <Input placeholder="Chief" value={form.father_chief || ""} onChange={(e) => setForm({ ...form, father_chief: e.target.value })} />
                      <Input placeholder="District" value={form.father_district || ""} onChange={(e) => setForm({ ...form, father_district: e.target.value })} />
                      <Input placeholder="Tribe" value={form.father_tribe || ""} onChange={(e) => setForm({ ...form, father_tribe: e.target.value })} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Attendance & Sign-off */}
            {step === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Attendant at Birth *</Label>
                    <Select value={form.attendant_at_birth} onValueChange={(val) => setForm({ ...form, attendant_at_birth: val as any, attendant_other_specified: undefined })}>
                      <SelectTrigger className={cn(errors.attendant_at_birth && "border-red-500")}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MIDWIFE">Qualified Midwife</SelectItem>
                        <SelectItem value="TBA">Traditional Birth Attendant</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.attendant_at_birth && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.attendant_at_birth}</p>}
                  </div>
                  {form.attendant_at_birth === "OTHER" && (
                    <div className="space-y-2">
                      <Label>Specify Attendant *</Label>
                      <Input value={form.attendant_other_specified || ""} onChange={(e) => setForm({ ...form, attendant_other_specified: e.target.value })} className={cn(errors.attendant_other_specified && "border-red-500")} />
                      {errors.attendant_other_specified && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.attendant_other_specified}</p>}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Marital Status *</Label>
                  <Select value={form.marital_status} onValueChange={(val) => setForm({ ...form, marital_status: val as any })}>
                    <SelectTrigger className={cn(errors.marital_status && "border-red-500")}><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent><SelectItem value="MARRIED">Married</SelectItem><SelectItem value="NOT_MARRIED">Not Married</SelectItem></SelectContent>
                  </Select>
                  {errors.marital_status && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3"/> {errors.marital_status}</p>}
                </div>

                {form.marital_status === "NOT_MARRIED" && (
                  <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20 space-y-3">
                    <p className="text-xs text-yellow-600 font-medium">⚠️ Paternity acknowledgement & mother consent required for unmarried parents.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <Input type="date" placeholder="Father Ack. Date" value={form.father_acknowledgement_date || ""} onChange={(e) => setForm({ ...form, father_acknowledgement_date: e.target.value })} />
                      <Input type="date" placeholder="Mother Consent Date" value={form.mother_consent_date || ""} onChange={(e) => setForm({ ...form, mother_consent_date: e.target.value })} />
                    </div>
                    <p className="text-xs text-muted-foreground italic">Signature capture integration pending. Base64 strings will be attached programmatically.</p>
                  </div>
                )}

                <div className="pt-2 border-t border-border space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">M.F.2 Facility Sign-off (Optional)</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Input placeholder="File / Case Number" value={form.file_number || ""} onChange={(e) => setForm({ ...form, file_number: e.target.value })} />
                    <Input placeholder="Officer In Charge" value={form.officer_in_charge || ""} onChange={(e) => setForm({ ...form, officer_in_charge: e.target.value })} />
                    <Input type="date" placeholder="Date Signed" value={form.date_signed || ""} onChange={(e) => setForm({ ...form, date_signed: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </form>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20">
            <div className="flex w-full justify-between">
              <Button type="button" variant="outline" onClick={step === 1 ? () => setRegisterOpen(false) : prevStep}>
                {step === 1 ? "Cancel" : <><ArrowLeft className="h-4 w-4 mr-2" /> Back</>}
              </Button>
              {step < 3 ? (
                <Button type="button" onClick={nextStep} className="bg-primary hover:bg-primary/90">
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" onClick={handleSubmit} className="bg-primary hover:bg-primary/90" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Baby className="h-4 w-4 mr-2" />}
                  {submitting ? "Submitting..." : "Submit Registration"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Record Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Birth Record Details</DialogTitle></DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {(selectedRecord.child_given_name?.[0] || "") + (selectedRecord.child_surname?.[0] || "")}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selectedRecord.child_given_name} {selectedRecord.child_surname}</p>
                  <p className="text-sm text-muted-foreground">BR-{selectedRecord.id?.toString().padStart(4, '0')}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-muted-foreground">Sex</p><p className="font-medium text-foreground">{selectedRecord.sex}</p></div>
                <div><p className="text-muted-foreground">Date of Birth</p><p className="font-medium text-foreground">{new Date(selectedRecord.date_of_birth).toLocaleDateString()}</p></div>
                <div><p className="text-muted-foreground">Mother's DIN</p><p className="font-medium text-foreground font-mono">{selectedRecord.mother_din}</p></div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={cn("text-xs font-medium capitalize mt-1",
                    selectedRecord.status === "APPROVED" && "border-green-500/30 bg-green-500/10 text-green-500",
                    selectedRecord.status === "PENDING" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                    selectedRecord.status === "REJECTED" && "border-red-500/30 bg-red-500/10 text-red-500"
                  )}>{selectedRecord.status}</Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
