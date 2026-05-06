"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Baby,
  Skull,
  FileText,
  Download,
  Loader2,
  Hash,
  Calendar,
  Shield,
  User,
  Home,
  Building2,
  MapPin,
  Search,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { birthRecordApi, deathRecordApi } from "@/lib/axios"
import { useRoleGuard } from "@/hooks/use-role-guard"
import { toast } from "sonner"
import { useMe } from "@/hooks/useMe"
import {
  BirthCertificate,
  BurialPermit,
  DeathCertificate
} from "@/utils/types"
import {
  DocumentViewer,
  BIRTH_CERTIFICATE_ENDPOINT,
  DEATH_CERTIFICATES_ENDPOINT,
  type StreamingEndpoint,
} from "@/components/document-viewer"

// ===========
// COMPONENT
// ===========

export default function CitizenCertificatesPage() {
  useRoleGuard(["CITIZEN"])
  const { me, enrollmentState, loading: meLoading } = useMe()

  const [activeTab, setActiveTab] = useState("birth")
  const [birthCerts, setBirthCerts] = useState<BirthCertificate[]>([])
  const [deathCerts, setDeathCerts] = useState<DeathCertificate[]>([])
  const [burialPermits, setBurialPermits] = useState<BurialPermit[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerEndpoint, setViewerEndpoint] = useState<StreamingEndpoint | null>(null)
  const [viewerRecordId, setViewerRecordId] = useState<number | null>(null)
  const [viewerRecordName, setViewerRecordName] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string>("")

  useEffect(() => {
    const stored = localStorage.getItem('zdid_access_token')
    if (stored) setToken(stored)
  }, [])

  useEffect(() => {
    if (meLoading || !me?.user_id || enrollmentState !== "ACTIVE") return

    const fetchData = async () => {
      setLoading(true)
      try {
        const [birthData, deathData, permitData] = await Promise.all([
          birthRecordApi.getMyCertificates(),
          deathRecordApi.getMyCertificates(),
          deathRecordApi.getMyBurialPermits(),
        ])
        setBirthCerts(birthData.certificates || [])
        setDeathCerts(deathData.certificates || [])
        setBurialPermits(permitData.permits || [])
      } catch (err: any) {
        setError(err.detail || "Failed to fetch your certificates")
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [meLoading, me?.user_id, enrollmentState])

  const belongsToUser = (cert: any, type: 'birth' | 'death' | 'permit') => {
    if (!me?.user_id) return false
    if (cert.status && cert.status !== "APPROVED") return false

    if (type === 'birth') {
      return cert.mother_system_user === me?.user_id || cert.father_system_user === me?.user_id
    }
    if (type === 'death' || type === 'permit') {
      return cert.informant_id === me?.user_id || cert.informant === me?.user_id
    }
    return false
  }

  const ownedBirthCerts = useMemo(() => birthCerts.filter(c => belongsToUser(c, 'birth')), [birthCerts, me?.user_id])
  const ownedDeathCerts = useMemo(() => deathCerts.filter(c => belongsToUser(c, 'death')), [deathCerts, me?.user_id])
  const ownedPermits = useMemo(() => burialPermits.filter(p => belongsToUser(p, 'permit')), [burialPermits, me?.user_id])

  function openBirthCertificate(cert: BirthCertificate) {
    setViewerEndpoint(BIRTH_CERTIFICATE_ENDPOINT)
    setViewerRecordId((cert as any).birth_records_id ?? cert.id)
    setViewerRecordName(`${cert.other_names} ${cert.surname}`)
    setViewerOpen(true)
  }

  function openDeathCertificates(cert: DeathCertificate) {
    setViewerEndpoint(DEATH_CERTIFICATES_ENDPOINT)
    setViewerRecordId(cert.death_records_id)
    setViewerRecordName(cert.deceased_names_and_surname)
    setViewerOpen(true)
  }

  const filterItems = (items: any[], searchTerm: string) => {
    if (!searchTerm) return items
    const term = searchTerm.toLowerCase()
    return items.filter((item) => {
      const name = item.deceased_names_and_surname || `${item.other_names || ""} ${item.surname || ""}` || item.deceased_name || ""
      return name.toLowerCase().includes(term) ||
        (item.reg_no || "").toLowerCase().includes(term) ||
        (item.registration_no || "").toLowerCase().includes(term)
    })
  }

  const filteredBirthCerts = filterItems(ownedBirthCerts, search)
  const filteredDeathCerts = filterItems(ownedDeathCerts, search)
  const filteredPermits = filterItems(ownedPermits, search)

  if (meLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (enrollmentState !== "ACTIVE") {
    return (
      // FIX: reduced padding on mobile (p-4 → p-6 lg:p-8), centred card content
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 text-center space-y-4">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/50" />
          <h2 className="text-xl font-bold text-foreground">Certificates Unavailable</h2>
          <p className="text-sm text-muted-foreground">
            {enrollmentState === "NOT_STARTED"
              ? "Complete your identity enrollment to view and download certificates."
              : "Your enrollment is currently under review. Certificates will appear here once your account is fully activated."}
          </p>
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            Status: {enrollmentState}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    // FIX: tighter padding on mobile (p-4 instead of p-6)
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">

      {/* Header */}
      {/* FIX: always stacked on mobile; row only on sm+ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">My Certificates</h1>
          {/* FIX: hide subtitle on very small screens to reduce clutter */}
          <p className="hidden sm:block text-sm text-muted-foreground mt-1">
            View and download your registered birth certificates, death certificates, and burial permits
          </p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 w-fit">
          <User className="h-3 w-3 mr-1" />
          Citizen Portal
        </Badge>
      </div>

      {/* Stats Summary */}
      {/* FIX: was grid-cols-3 with long labels — now compact on mobile with smaller text */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
              <Baby className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{birthCerts.length}</p>
              {/* FIX: abbreviated label on mobile */}
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                <span className="sm:hidden">Birth</span>
                <span className="hidden sm:inline">Birth Certificates</span>
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
              <Skull className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{deathCerts.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                <span className="sm:hidden">Death</span>
                <span className="hidden sm:inline">Death Certificates</span>
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-foreground">{burialPermits.length}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                <span className="sm:hidden">Permits</span>
                <span className="hidden sm:inline">Burial Permits</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      {/* FIX: full-width on mobile (removed max-w-sm constraint at mobile breakpoint) */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or reg. number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card border-border"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* FIX: tabs are full-width on mobile; labels shortened to icon + short word */}
        <TabsList className="bg-muted/30 w-full sm:w-auto grid grid-cols-3 sm:flex">
          <TabsTrigger value="birth" className="gap-1.5 text-xs sm:text-sm">
            <Baby className="h-4 w-4 shrink-0" />
            {/* FIX: short label on mobile, full label on sm+ */}
            <span className="sm:hidden">Birth</span>
            <span className="hidden sm:inline">Birth Certificates</span>
            {birthCerts.length > 0 && (
              <Badge className="ml-1 bg-blue-500/20 text-blue-600 border-none text-[10px] h-4 px-1.5">
                {birthCerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="death" className="gap-1.5 text-xs sm:text-sm">
            <Skull className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">Death</span>
            <span className="hidden sm:inline">Death Certificates</span>
            {deathCerts.length > 0 && (
              <Badge className="ml-1 bg-red-500/20 text-red-600 border-none text-[10px] h-4 px-1.5">
                {deathCerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="permits" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="sm:hidden">Permits</span>
            <span className="hidden sm:inline">Burial Permits</span>
            {burialPermits.length > 0 && (
              <Badge className="ml-1 bg-amber-500/20 text-amber-600 border-none text-[10px] h-4 px-1.5">
                {burialPermits.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Birth Certificates Tab */}
        <TabsContent value="birth">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              // FIX: reduced padding on mobile
              <div className="p-8 sm:p-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : filteredBirthCerts.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-muted-foreground">
                <Baby className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p>No birth certificates found</p>
                <p className="text-xs mt-1">Birth certificates appear here after registrar approval</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredBirthCerts.map((cert) => (
                  <div key={cert.id} className="p-3 sm:p-4 hover:bg-muted/20 transition-colors">
                    {/* FIX: stack avatar+info above the button on mobile */}
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-base sm:text-lg font-bold text-blue-600">
                          {(cert.other_names?.[0] || "") + (cert.surname?.[0] || "")}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm sm:text-base">
                            {cert.other_names} {cert.surname}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3 shrink-0" />
                              {cert.reg_no}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              Born {new Date(cert.date_of_birth).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {cert.district}
                            </span>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {cert.sex}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5">
                            <span>Mother: {cert.mother_name}</span>
                            {cert.father_name && <span>Father: {cert.father_name}</span>}
                          </div>
                        </div>
                      </div>
                      {/* FIX: full-width button on mobile */}
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto shrink-0"
                        onClick={() => openBirthCertificate(cert)}
                      >
                        <FileText className="h-4 w-4 mr-1.5" />
                        View Certificate
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Death Certificates Tab */}
        <TabsContent value="death">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-8 sm:p-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : filteredDeathCerts.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-muted-foreground">
                <Skull className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p>No death certificates found</p>
                <p className="text-xs mt-1">Death certificates appear here after registrar approval</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredDeathCerts.map((cert) => (
                  <div key={cert.id} className="p-3 sm:p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-base sm:text-lg font-bold text-red-600">
                          {cert.deceased_names_and_surname?.[0] || "?"}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm sm:text-base">
                            {cert.deceased_names_and_surname}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3 shrink-0" />
                              {cert.registration_no}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              Died {new Date(cert.date_of_death).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {cert.place_of_death}
                            </span>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {cert.sex}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5">
                            <span>Age: {cert.age}</span>
                            <span>Informant: {cert.informant_name} ({cert.informant_relationship})</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 w-full sm:w-auto shrink-0"
                        onClick={() => openDeathCertificates(cert)}
                      >
                        <FileText className="h-4 w-4 mr-1.5" />
                        View Certificates
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Burial Permits Tab */}
        <TabsContent value="permits">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="p-8 sm:p-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : filteredPermits.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p>No burial permits found</p>
                <p className="text-xs mt-1">Burial permits appear here after death registration approval</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredPermits.map((permit) => (
                  <div key={permit.id} className="p-3 sm:p-4 hover:bg-muted/20 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-base sm:text-lg font-bold text-amber-600">
                          {permit.deceased_name?.[0] || "?"}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm sm:text-base">{permit.deceased_name}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              Died {new Date(permit.date_of_death).toLocaleDateString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              {permit.place_of_death}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 shrink-0" />
                              {permit.issuing_authority}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground pt-0.5">
                            Issued: {new Date(permit.issued_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50 w-full sm:w-auto shrink-0"
                        onClick={() => {
                          toast.info("Download burial permit from the Death Certificates tab")
                        }}
                      >
                        <Download className="h-4 w-4 mr-1.5" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Document Viewer Dialog */}
      {viewerOpen && viewerEndpoint && (
        <DocumentViewer
          onClose={() => setViewerOpen(false)}
          endpoint={viewerEndpoint}
          recordId={viewerRecordId}
          recordName={viewerRecordName || undefined}
          token={token}
          status="APPROVED"
        />
      )}
    </div>
  )
}