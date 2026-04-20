"use client"

import { useState } from "react"
import {
  Baby,
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

const birthRecords = [
  { id: "BR-2024-001", childName: "Mwamba Banda Jr.", sex: "Male", dob: "2024-03-15", placeOfBirth: "UTH Lusaka", birthType: "hospital", motherName: "Grace Banda", fatherName: "John Banda", status: "certified", registrationDate: "2024-03-18", province: "Lusaka" },
  { id: "BR-2024-002", childName: "Chanda Mulenga", sex: "Female", dob: "2024-03-14", placeOfBirth: "Kitwe Central Hospital", birthType: "hospital", motherName: "Mary Mulenga", fatherName: "Peter Mulenga", status: "pending", registrationDate: "2024-03-16", province: "Copperbelt" },
  { id: "BR-2024-003", childName: "Tembo Chilufya", sex: "Male", dob: "2024-03-12", placeOfBirth: "Mansa Village", birthType: "home", motherName: "Ruth Chilufya", fatherName: "Emmanuel Chilufya", status: "certified", registrationDate: "2024-03-20", province: "Luapula" },
  { id: "BR-2024-004", childName: "Mutale Phiri", sex: "Female", dob: "2024-03-10", placeOfBirth: "Ndola Teaching Hospital", birthType: "hospital", motherName: "Esther Phiri", fatherName: "David Phiri", status: "pending", registrationDate: "2024-03-12", province: "Copperbelt" },
  { id: "BR-2024-005", childName: "Bwalya Zimba", sex: "Male", dob: "2024-03-08", placeOfBirth: "Chipata General Hospital", birthType: "hospital", motherName: "Agnes Zimba", fatherName: "Joseph Zimba", status: "certified", registrationDate: "2024-03-10", province: "Eastern" },
  { id: "BR-2024-006", childName: "Namukolo Sakala", sex: "Female", dob: "2024-03-05", placeOfBirth: "Mongu District Hospital", birthType: "hospital", motherName: "Sarah Sakala", fatherName: "Moses Sakala", status: "rejected", registrationDate: "2024-03-08", province: "Western" },
  { id: "BR-2024-007", childName: "Kalumba Ng'andu", sex: "Male", dob: "2024-03-01", placeOfBirth: "Kasama Village", birthType: "home", motherName: "Joyce Ng'andu", fatherName: "Charles Ng'andu", status: "pending", registrationDate: "2024-03-05", province: "Northern" },
  { id: "BR-2024-008", childName: "Mwila Tembo", sex: "Female", dob: "2024-02-28", placeOfBirth: "Levy Mwanawasa Hospital", birthType: "hospital", motherName: "Catherine Tembo", fatherName: "Michael Tembo", status: "certified", registrationDate: "2024-03-02", province: "Lusaka" },
]

const stats = [
  { label: "Total Births", value: "1,247", change: "+12%", icon: Baby },
  { label: "Hospital Births", value: "892", change: "+8%", icon: Building2 },
  { label: "Home Births", value: "355", change: "+18%", icon: Home },
  { label: "Pending Approval", value: "48", change: "-5%", icon: Clock },
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

export default function BirthRecordsPage() {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [birthTypeFilter, setBirthTypeFilter] = useState("all")
  const [registerOpen, setRegisterOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<typeof birthRecords[0] | null>(null)
  const [language, setLanguage] = useState("en")

  const filteredRecords = birthRecords.filter((record) => {
    const matchesSearch =
      record.childName.toLowerCase().includes(search.toLowerCase()) ||
      record.id.toLowerCase().includes(search.toLowerCase()) ||
      record.motherName.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || record.status === statusFilter
    const matchesBirthType = birthTypeFilter === "all" || record.birthType === birthTypeFilter
    return matchesSearch && matchesStatus && matchesBirthType
  })

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Birth Records</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register and manage birth certificates across Zambia
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
            Register Birth
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
                <span className={cn(
                  "text-xs font-medium",
                  stat.change.startsWith("+") ? "text-green-500" : "text-red-500"
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or ID..."
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
            <SelectItem value="certified">Certified</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={birthTypeFilter} onValueChange={setBirthTypeFilter}>
          <SelectTrigger className="w-[150px] bg-card border-border">
            <SelectValue placeholder="Birth Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="hospital">Hospital</SelectItem>
            <SelectItem value="home">Home Birth</SelectItem>
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
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Child Name</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sex</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date of Birth</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Place / Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Mother</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary">{record.id}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {record.childName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                      </div>
                      <span className="font-medium text-foreground">{record.childName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{record.sex}</td>
                  <td className="px-4 py-3 text-muted-foreground">{record.dob}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-foreground text-xs">{record.placeOfBirth}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {record.birthType === "hospital" ? (
                          <><Building2 className="h-3 w-3" /> Hospital</>
                        ) : (
                          <><Home className="h-3 w-3" /> Home</>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{record.motherName}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium capitalize",
                        record.status === "certified" && "border-green-500/30 bg-green-500/10 text-green-500",
                        record.status === "pending" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                        record.status === "rejected" && "border-red-500/30 bg-red-500/10 text-red-500"
                      )}
                    >
                      {record.status === "certified" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {record.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
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
            Showing {filteredRecords.length} of {birthRecords.length} records
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

      {/* Register Birth Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register New Birth</DialogTitle>
            <DialogDescription>
              Enter the details of the newborn child. All fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-6 mt-4">
            {/* Birth Type */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card hover:border-primary transition-colors"
              >
                <Building2 className="h-6 w-6 text-primary" />
                <span className="text-sm font-medium text-foreground">Hospital Birth</span>
                <span className="text-xs text-muted-foreground">Health facility delivery</span>
              </button>
              <button
                type="button"
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border bg-card hover:border-primary transition-colors"
              >
                <Home className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Home Birth</span>
                <span className="text-xs text-muted-foreground">Traditional birth attendant</span>
              </button>
            </div>

            {/* Child Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Child Information</h3>
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
                  <Label>Date of Birth *</Label>
                  <Input type="date" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Time of Birth</Label>
                  <Input type="time" className="bg-card border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Place of Birth *</Label>
                  <Input placeholder="Hospital name or village" className="bg-card border-border" />
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
            </div>

            {/* Mother Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Mother Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mother&apos;s Full Name *</Label>
                  <Input placeholder="Enter full name" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Mother&apos;s NRC</Label>
                  <Input placeholder="e.g., 123456/78/9" className="bg-card border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mother&apos;s Age *</Label>
                  <Input type="number" placeholder="Age at birth" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Mother&apos;s Nationality</Label>
                  <Input placeholder="Zambian" defaultValue="Zambian" className="bg-card border-border" />
                </div>
              </div>
            </div>

            {/* Father Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Father Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Father&apos;s Full Name</Label>
                  <Input placeholder="Enter full name" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Father&apos;s NRC</Label>
                  <Input placeholder="e.g., 123456/78/9" className="bg-card border-border" />
                </div>
              </div>
            </div>

            {/* Informant */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Informant Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Informant Name *</Label>
                  <Input placeholder="Person reporting birth" className="bg-card border-border" />
                </div>
                <div className="space-y-2">
                  <Label>Relationship to Child *</Label>
                  <Select>
                    <SelectTrigger className="bg-card border-border">
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mother">Mother</SelectItem>
                      <SelectItem value="father">Father</SelectItem>
                      <SelectItem value="relative">Relative</SelectItem>
                      <SelectItem value="midwife">Midwife</SelectItem>
                      <SelectItem value="health_worker">Health Worker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </form>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setRegisterOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-primary hover:bg-primary/90">
              <Baby className="h-4 w-4 mr-2" />
              Register Birth
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Record Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Birth Record Details</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {selectedRecord.childName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selectedRecord.childName}</p>
                  <p className="text-sm text-muted-foreground">{selectedRecord.id}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Sex</p>
                  <p className="font-medium text-foreground">{selectedRecord.sex}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date of Birth</p>
                  <p className="font-medium text-foreground">{selectedRecord.dob}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Place of Birth</p>
                  <p className="font-medium text-foreground">{selectedRecord.placeOfBirth}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Province</p>
                  <p className="font-medium text-foreground">{selectedRecord.province}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mother</p>
                  <p className="font-medium text-foreground">{selectedRecord.motherName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Father</p>
                  <p className="font-medium text-foreground">{selectedRecord.fatherName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Registration Date</p>
                  <p className="font-medium text-foreground">{selectedRecord.registrationDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs font-medium capitalize mt-1",
                      selectedRecord.status === "certified" && "border-green-500/30 bg-green-500/10 text-green-500",
                      selectedRecord.status === "pending" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                      selectedRecord.status === "rejected" && "border-red-500/30 bg-red-500/10 text-red-500"
                    )}
                  >
                    {selectedRecord.status}
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
