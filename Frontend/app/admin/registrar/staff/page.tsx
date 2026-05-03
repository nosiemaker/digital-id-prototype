"use client"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  UserCog, Users, Stethoscope, ClipboardList, Plus, Search, Filter,
  Loader2, CheckCircle2, XCircle, ShieldAlert, Trash2, Eye, MapPin
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useRoleGuard } from "@/hooks/use-role-guard"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { staffApi } from "@/lib/api/staff"
import { referenceApi } from "@/lib/api/reference"
import { StaffMember, ProvinceOption, DistrictOption } from "@/utils/types"

const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: "easeOut" }
}
const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } }
}

export default function StaffManagementPage() {
  useRoleGuard(["REGISTRAR"])

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"hw" | "ro">("hw")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  
  // Add Dialog State
  const [addOpen, setAddOpen] = useState(false)
  const [addRole, setAddRole] = useState<"hw" | "ro">("hw")
  const [formData, setFormData] = useState({
    citizen_din: "", facility_name: "", department: "", station_name: "", district_id: ""
  })
  const [submitting, setSubmitting] = useState(false)
  
  // Province/District State
  const [provinces, setProvinces] = useState<ProvinceOption[]>([])
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [selectedProvince, setSelectedProvince] = useState<string>("all")

  // Remove Dialog State
  const [removeOpen, setRemoveOpen] = useState(false)
  const [targetStaff, setTargetStaff] = useState<StaffMember | null>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => { 
    fetchStaff()
    fetchProvinces()
  }, [])
  
  useEffect(() => {
    if (selectedProvince && selectedProvince !== "all") {
      fetchDistricts(selectedProvince)
    } else {
      setDistricts([])
    }
  }, [selectedProvince])

  async function fetchStaff() {
    setLoading(true)
    try {
      const res = await staffApi.getAll()
      setStaff(res.staff || [])
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to load staff list")
    } finally {
      setLoading(false)
    }
  }
  
  async function fetchProvinces() {
    try {
      const data = await referenceApi.getProvinces()
      setProvinces(data)
    } catch (err: any) {
      console.error("Failed to fetch provinces:", err)
    }
  }
  
  async function fetchDistricts(provinceCode: string) {
    try {
      const data = await referenceApi.getDistricts(provinceCode)
      setDistricts(data)
    } catch (err: any) {
      console.error("Failed to fetch districts:", err)
      setDistricts([])
    }
  }

  async function handleAddStaff() {
    if (!formData.citizen_din.trim()) {
      return toast.error("Citizen DIN is required")
    }
    setSubmitting(true)
    try {
      if (addRole === "hw") {
        await staffApi.addHealthWorker({
          citizen_din: formData.citizen_din.trim(),
          facility_name: formData.facility_name.trim() || undefined,
          department: formData.department.trim() || undefined
        })
        toast.success("Health Worker added. Employee ID & temporary password sent via email.")
      } else {
        await staffApi.addRegistrationOfficer({
          citizen_din: formData.citizen_din.trim(),
          station_name: formData.station_name.trim() || undefined,
          district_id: formData.district_id ? Number(formData.district_id) : undefined
        })
        toast.success("Registration Officer added. Employee ID & temporary password sent via email.")
      }
      setAddOpen(false)
      setFormData({ citizen_din: "", facility_name: "", department: "", station_name: "", district_id: "" })
      setSelectedProvince("all")
      setDistricts([])
      fetchStaff()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to add staff member")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveStaff() {
    if (!targetStaff?.citizen_din) return
    setRemoving(true)
    try {
      const isHW = targetStaff.role?.includes("HEALTH_WORKER")
      if (isHW) await staffApi.removeHealthWorker(targetStaff.citizen_din)
      else await staffApi.removeRegistrationOfficer(targetStaff.citizen_din)
      toast.success(`${isHW ? "Health Worker" : "Registration Officer"} deactivated`)
      setRemoveOpen(false)
      setTargetStaff(null)
      fetchStaff()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Failed to deactivate staff")
    } finally {
      setRemoving(false)
    }
  }

  const filteredStaff = staff.filter(s => {
    const isHW = s.role?.includes("HEALTH_WORKER")
    const isRO = s.role?.includes("REGISTRATION_OFFICER")
    const matchesTab = activeTab === "hw" ? isHW : isRO
    const matchesSearch = 
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.citizen_din?.toLowerCase().includes(search.toLowerCase()) ||
      s.employee_id?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && s.is_active) || 
      (statusFilter === "inactive" && !s.is_active)
    return matchesTab && matchesSearch && matchesStatus
  })

  const stats = [
    { label: "Total Staff", value: staff.length.toString(), icon: Users, color: "text-primary", bg: "bg-primary/10" },
    { label: "Health Workers", value: staff.filter(s => s.role?.includes("HEALTH_WORKER")).length.toString(), icon: Stethoscope, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Reg. Officers", value: staff.filter(s => s.role?.includes("REGISTRATION_OFFICER")).length.toString(), icon: ClipboardList, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Active", value: staff.filter(s => s.is_active).length.toString(), icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" }
  ]

  return (
    <motion.div initial="initial" animate="animate" variants={staggerContainer} className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Staff Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add, view, and manage Health Workers & Registration Officers
          </p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          <UserCog className="h-3 w-3 mr-1" /> Registrar Admin
        </Badge>
      </motion.div>

      {/* Stats */}
      <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.bg)}>
                  <Icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{loading ? "—" : stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* Controls */}
      <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, DIN, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] bg-card border-border">
            <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button className="ml-auto gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Add Staff
        </Button>
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeInUp}>
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as "hw" | "ro")} className="space-y-4">
          <TabsList className="bg-muted/30">
            <TabsTrigger value="hw" className="gap-2"><Stethoscope className="h-4 w-4" /> Health Workers</TabsTrigger>
            <TabsTrigger value="ro" className="gap-2"><ClipboardList className="h-4 w-4" /> Registration Officers</TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">DIN</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Employee ID</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                      ) : filteredStaff.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No staff members found</td></tr>
                      ) : filteredStaff.map(s => (
                        <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">{s.name || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{s.email || "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs text-primary">{s.citizen_din || "—"}</td>
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.employee_id || "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={cn("text-xs capitalize", s.is_active ? "border-green-500/30 bg-green-500/10 text-green-500" : "border-red-500/30 bg-red-500/10 text-red-500")}>
                              {s.is_active ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                              {s.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toast.info("View details coming soon")}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              {s.is_active && (
                                <Button variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { setTargetStaff(s); setRemoveOpen(true) }}>
                                  <Trash2 className="h-4 w-4 mr-1" /> Deactivate
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </motion.div>

      {/* Add Staff Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5 text-primary" /> Add New Staff</DialogTitle>
            <DialogDescription>Assign system roles to an existing citizen by their DIN.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex gap-2 p-1 bg-muted/30 rounded-lg">
              <button onClick={() => setAddRole("hw")} className={cn("flex-1 py-1.5 text-sm font-medium rounded-md transition-all", addRole === "hw" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <Stethoscope className="h-4 w-4 inline mr-1" /> Health Worker
              </button>
              <button onClick={() => setAddRole("ro")} className={cn("flex-1 py-1.5 text-sm font-medium rounded-md transition-all", addRole === "ro" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <ClipboardList className="h-4 w-4 inline mr-1" /> Reg. Officer
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Citizen DIN <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. 123456/01/1" value={formData.citizen_din} onChange={e => setFormData({...formData, citizen_din: e.target.value})} />
              </div>
              <div className="col-span-2 rounded-lg bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                ℹ️ Employee ID will be auto-generated. A secure temporary password will be emailed to the user automatically.
              </div>
              {addRole === "hw" ? (
                <>
                  <div className="space-y-1"><Label>Facility Name</Label><Input value={formData.facility_name} onChange={e => setFormData({...formData, facility_name: e.target.value})} /></div>
                  <div className="space-y-1"><Label>Department</Label><Input value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})} /></div>
                </>
              ) : (
                <>
                  <div className="space-y-1"><Label>Station Name</Label><Input value={formData.station_name} onChange={e => setFormData({...formData, station_name: e.target.value})} /></div>
                  <div className="space-y-1">
                    <Label>Province</Label>
                    <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a province" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Provinces</SelectItem>
                        {provinces.map(province => (
                          <SelectItem key={province.code} value={province.code}>
                            {province.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>District</Label>
                    <Select 
                      value={formData.district_id} 
                      onValueChange={(value) => setFormData({...formData, district_id: value})}
                      disabled={selectedProvince === "all" || districts.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedProvince !== "all" ? "Select a district" : "Select a province first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {districts.map(district => (
                          <SelectItem key={district.id} value={district.id.toString()}>
                            {district.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              setAddOpen(false)
              setSelectedProvince("all")
              setDistricts([])
            }}>Cancel</Button>
            <Button onClick={handleAddStaff} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {submitting ? "Assigning..." : "Assign Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Dialog */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><ShieldAlert className="h-5 w-5" /> Deactivate Staff</DialogTitle>
            <DialogDescription>This will remove their role permissions and deactivate their account access.</DialogDescription>
          </DialogHeader>
          {targetStaff && (
            <div className="bg-muted/30 p-3 rounded-lg space-y-1">
              <p className="font-medium">{targetStaff.name || "—"}</p>
              <p className="text-xs text-muted-foreground">DIN: {targetStaff.citizen_din || "—"} | ID: {targetStaff.employee_id || "—"}</p>
            </div>
          )}
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveStaff} disabled={removing}>
              {removing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              {removing ? "Processing..." : "Confirm Deactivation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}