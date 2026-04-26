"use client"

import { useState } from "react"
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
import { cn } from "@/lib/utils"

// ICD-11 Cause of Death Codes (simplified sample)
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

const stats = [
  { label: "Total Deaths", value: "847", change: "+3%", icon: Skull, color: "text-muted-foreground" },
  { label: "Hospital", value: "512", change: "-2%", icon: Building2, color: "text-blue-500" },
  { label: "Home", value: "298", change: "+8%", icon: Home, color: "text-orange-500" },
  { label: "Under Investigation", value: "12", change: "+2", icon: AlertTriangle, color: "text-yellow-500" },
]

const languages = [
  { code: "en", label: "English" },
  { code: "bem", label: "Bemba" },
  { code: "nya", label: "Nyanja" },
  { code: "ton", label: "Tonga" },
  { code: "loz", label: "Lozi" },
  { code: "kqn", label: "Kaonde" },
  { code: "lun", label: "Lunda" },
]
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { deathRecordApi, type DeathRecordBase } from "@/lib/axios"
import { useEffect } from "react"
import { toast } from "sonner"

export default function DeathRecordsPage() {
  const [records, setRecords] = useState<any[]>([])
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [registerOpen, setRegisterOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null)
  const [language, setLanguage] = useState("en")
  const [activeTab, setActiveTab] = useState<"certified" | "pending">("certified")

  const [form, setForm] = useState<DeathRecordBase>({
    citizen_din: "",
    hospital_name: "",
    death_date: new Date().toISOString().split('T')[0],
    cause_of_death: "",
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const response: any = await deathRecordApi.getPendingSubmissions()
      setPendingSubmissions(response.pending_submissions || [])
      
      // Mocked certified records for now
      setRecords([
        { id: "DR-2024-001", deceasedName: "Mwape Chola", sex: "Male", dod: "2024-03-14", age: 72, placeOfDeath: "UTH Lusaka", deathType: "hospital", causeCode: "PA00", causeName: "Natural causes (old age)", informant: "Jane Chola (Daughter)", status: "certified", registrationDate: "2024-03-16", province: "Lusaka" },
        { id: "DR-2024-003", deceasedName: "Joseph Banda", sex: "Male", dod: "2024-03-12", age: 58, placeOfDeath: "Kitwe Central Hospital", deathType: "hospital", causeCode: "BA00", causeName: "Acute myocardial infarction", informant: "Mary Banda (Wife)", status: "certified", registrationDate: "2024-03-14", province: "Copperbelt" },
      ])
    } catch (err) {
      console.error("Failed to fetch death records", err)
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    try {
      await deathRecordApi.submit(form)
      toast.success("Death record submitted for review")
      setRegisterOpen(false)
      fetchData()
    } catch (err) {
      toast.error("Failed to submit record")
    }
  }

  async function handleApprove(id: number) {
    try {
      await deathRecordApi.approve(id)
      toast.success("Record approved and certified")
      fetchData()
    } catch (err) {
      toast.error("Approval failed")
    }
  }

  const currentList = activeTab === "certified" ? records : pendingSubmissions

  const filteredRecords = currentList.filter((record) => {
    const name = record.deceasedName || record.full_name || ""
    const matchesSearch =
      name.toLowerCase().includes(search.toLowerCase()) ||
      (record.id || "").toString().toLowerCase().includes(search.toLowerCase())
    return matchesSearch
  })

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
        <div className="flex items-center gap-3">
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-[130px] bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setRegisterOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Register Death
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
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50", stat.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  stat.change.startsWith("+") ? "text-muted-foreground" : "text-green-500"
                )}>
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
        <button
          onClick={() => setActiveTab("certified")}
          className={cn(
            "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
            activeTab === "certified" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Certified Records
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
            placeholder="Search by name, ID or ICD code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-card border-border">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="certified">Certified</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_investigation">Under Investigation</SelectItem>
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Age/Sex</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date of Death</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cause (ICD-11)</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Place</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{record.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                        {(record.deceasedName || record.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="font-medium text-foreground">{record.deceasedName || record.full_name || "Unknown"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{record.age}y / {record.sex[0]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{record.dod}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <code className="text-xs font-mono text-primary">{record.causeCode}</code>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">{record.causeName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-foreground text-xs truncate max-w-[120px]">{record.placeOfDeath}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                        {record.deathType === "hospital" && <Building2 className="h-3 w-3" />}
                        {record.deathType === "home" && <Home className="h-3 w-3" />}
                        {record.deathType === "other" && <AlertTriangle className="h-3 w-3" />}
                        {record.deathType}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium capitalize whitespace-nowrap",
                        record.status === "certified" && "border-green-500/30 bg-green-500/10 text-green-500",
                        record.status === "pending" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                        record.status === "under_investigation" && "border-red-500/30 bg-red-500/10 text-red-500"
                      )}
                    >
                      {record.status === "certified" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {record.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                      {record.status === "under_investigation" && <AlertTriangle className="h-3 w-3 mr-1" />}
                      {record.status.replace("_", " ")}
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
                        <DropdownMenuItem>
                          <FileText className="h-4 w-4 mr-2" /> Generate Certificate
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" /> Download PDF
                        </DropdownMenuItem>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register Death</DialogTitle>
            <DialogDescription>
              Enter the details of the deceased. All fields marked with * are required. Use ICD-11 codes for cause of death.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-6 mt-4">
            {/* Deceased Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Deceased Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input placeholder="Enter first name" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input placeholder="Enter last name" className="bg-card border-border" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Sex *</Label>
                  <Select>
                    <SelectTrigger className="bg-card border-border">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Age at Death *</Label>
                  <Input type="number" placeholder="Years" className="bg-card border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>NRC Number</Label>
                  <Input placeholder="e.g., 123456/78/9" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Digital ID (if registered)</Label>
                  <Input placeholder="ZM-XXXX-XXX-XXXX" className="bg-card border-border" />
                </div>
              </div>
            </div>

            {/* Death Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Death Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Death *</Label>
                  <Input type="date" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Time of Death</Label>
                  <Input type="time" className="bg-card border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Place of Death *</Label>
                  <Input placeholder="Hospital, home address, etc." className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Death Type *</Label>
                  <Select>
                    <SelectTrigger className="bg-card border-border">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hospital">Hospital / Health Facility</SelectItem>
                      <SelectItem value="home">Home</SelectItem>
                      <SelectItem value="accident">Accident Scene</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Province *</Label>
                <Select>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lusaka">Lusaka</SelectItem>
                    <SelectItem value="copperbelt">Copperbelt</SelectItem>
                    <SelectItem value="eastern">Eastern</SelectItem>
                    <SelectItem value="western">Western</SelectItem>
                    <SelectItem value="northern">Northern</SelectItem>
                    <SelectItem value="southern">Southern</SelectItem>
                    <SelectItem value="central">Central</SelectItem>
                    <SelectItem value="luapula">Luapula</SelectItem>
                    <SelectItem value="northwestern">North-Western</SelectItem>
                    <SelectItem value="muchinga">Muchinga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cause of Death (ICD-11) */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">
                Cause of Death (ICD-11 Coding) *
              </h3>
              <div className="space-y-2">
                <Label>Primary Cause (ICD-11 Code) *</Label>
                <Select>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Select ICD-11 code" />
                  </SelectTrigger>
                  <SelectContent>
                    {icd11Codes.map((code) => (
                      <SelectItem key={code.code} value={code.code}>
                        <span className="font-mono text-primary">{code.code}</span> — {code.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Secondary Cause (if applicable)</Label>
                <Select>
                  <SelectTrigger className="bg-card border-border">
                    <SelectValue placeholder="Select ICD-11 code (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {icd11Codes.map((code) => (
                      <SelectItem key={code.code} value={code.code}>
                        <span className="font-mono text-primary">{code.code}</span> — {code.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Additional Notes</Label>
                <Textarea
                  placeholder="Any additional medical information or circumstances..."
                  className="bg-card border-border min-h-[80px]"
                />
              </div>
            </div>

            {/* Certifying Medical Officer */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Certifying Medical Officer</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Doctor&apos;s Name *</Label>
                  <Input placeholder="Full name" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>HPCZ Registration No.</Label>
                  <Input placeholder="Medical license number" className="bg-card border-border" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Health Facility</Label>
                <Input placeholder="Hospital or clinic name" className="bg-card border-border" />
              </div>
            </div>

            {/* Informant */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Informant Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Informant Name *</Label>
                  <Input placeholder="Person reporting death" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Relationship to Deceased *</Label>
                  <Select>
                    <SelectTrigger className="bg-card border-border">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="spouse">Spouse</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="sibling">Sibling</SelectItem>
                      <SelectItem value="relative">Other Relative</SelectItem>
                      <SelectItem value="police">Police Officer</SelectItem>
                      <SelectItem value="medical">Medical Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Informant Contact</Label>
                <Input placeholder="Phone number" className="bg-card border-border" />
              </div>
            </div>
          </form>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-primary hover:bg-primary/90">
              <Skull className="h-4 w-4 mr-2" />
              Register Death
            </Button>
          </DialogFooter>
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
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
                  {selectedRecord.deceasedName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selectedRecord.deceasedName}</p>
                  <p className="text-sm text-muted-foreground">{selectedRecord.id}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Age / Sex</p>
                  <p className="font-medium text-foreground">{selectedRecord.age} years / {selectedRecord.sex}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date of Death</p>
                  <p className="font-medium text-foreground">{selectedRecord.dod}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Place of Death</p>
                  <p className="font-medium text-foreground">{selectedRecord.placeOfDeath}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Province</p>
                  <p className="font-medium text-foreground">{selectedRecord.province}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Cause of Death (ICD-11)</p>
                  <p className="font-medium text-foreground">
                    <code className="text-primary font-mono">{selectedRecord.causeCode}</code> — {selectedRecord.causeName}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Informant</p>
                  <p className="font-medium text-foreground">{selectedRecord.informant}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-medium capitalize mt-1",
                      selectedRecord.status === "certified" && "border-green-500/30 bg-green-500/10 text-green-500",
                      selectedRecord.status === "pending" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                      selectedRecord.status === "under_investigation" && "border-red-500/30 bg-red-500/10 text-red-500"
                    )}
                  >
                    {selectedRecord.status.replace("_", " ")}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button className="flex-1 bg-primary hover:bg-primary/90">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Certificate
                </Button>
                <Button variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
