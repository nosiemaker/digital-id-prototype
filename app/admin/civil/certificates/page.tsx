"use client"

import { useState } from "react"
import {
  FileText,
  Search,
  Download,
  Eye,
  Printer,
  CheckCircle2,
  Clock,
  XCircle,
  Shield,
  Baby,
  Skull,
  QrCode,
  Copy,
  ChevronLeft,
  ChevronRight,
  Filter,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

const certificates = [
  { id: "BC-2024-001-VERIFIED", type: "birth", name: "Mwamba Banda Jr.", dob: "2024-03-15", issueDate: "2024-03-20", status: "verified", verifications: 12, province: "Lusaka" },
  { id: "BC-2024-002-PENDING", type: "birth", name: "Chanda Mulenga", dob: "2024-03-14", issueDate: "2024-03-18", status: "pending", verifications: 0, province: "Copperbelt" },
  { id: "DC-2024-001-VERIFIED", type: "death", name: "Mwape Chola", dod: "2024-03-14", issueDate: "2024-03-18", status: "verified", verifications: 5, province: "Lusaka" },
  { id: "BC-2024-003-VERIFIED", type: "birth", name: "Tembo Chilufya", dob: "2024-03-12", issueDate: "2024-03-22", status: "verified", verifications: 8, province: "Luapula" },
  { id: "DC-2024-002-PENDING", type: "death", name: "Martha Mbewe", dod: "2024-03-13", issueDate: "2024-03-17", status: "pending", verifications: 0, province: "Central" },
  { id: "BC-2024-004-REVOKED", type: "birth", name: "Invalid Record", dob: "2024-01-01", issueDate: "2024-01-05", status: "revoked", verifications: 2, province: "Eastern" },
  { id: "DC-2024-003-VERIFIED", type: "death", name: "Joseph Banda", dod: "2024-03-12", issueDate: "2024-03-16", status: "verified", verifications: 3, province: "Copperbelt" },
  { id: "BC-2024-005-VERIFIED", type: "birth", name: "Bwalya Zimba", dob: "2024-03-08", issueDate: "2024-03-12", status: "verified", verifications: 15, province: "Eastern" },
]

const stats = [
  { label: "Total Certificates", value: "2,094", icon: FileText },
  { label: "Birth Certificates", value: "1,247", icon: Baby },
  { label: "Death Certificates", value: "847", icon: Skull },
  { label: "Verified Today", value: "156", icon: CheckCircle2 },
]

export default function CertificatesPage() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedCert, setSelectedCert] = useState<typeof certificates[0] | null>(null)
  const [verifyCertId, setVerifyCertId] = useState("")
  const [verifyResult, setVerifyResult] = useState<"valid" | "invalid" | null>(null)

  const filteredCerts = certificates.filter((cert) => {
    const matchesSearch =
      cert.name.toLowerCase().includes(search.toLowerCase()) ||
      cert.id.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === "all" || cert.type === typeFilter
    const matchesStatus = statusFilter === "all" || cert.status === statusFilter
    return matchesSearch && matchesType && matchesStatus
  })

  const handleVerify = () => {
    const found = certificates.find((c) => c.id.toLowerCase() === verifyCertId.toLowerCase())
    if (found && found.status === "verified") {
      setVerifyResult("valid")
    } else {
      setVerifyResult("invalid")
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Digital Certificates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate, verify, and manage birth and death certificates
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
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
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="all">All Certificates</TabsTrigger>
          <TabsTrigger value="verify">Verify Certificate</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or certificate ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px] bg-card border-border">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="birth">Birth</SelectItem>
                <SelectItem value="death">Death</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-card border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
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
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Certificate ID</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Event Date</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Issue Date</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Verifications</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCerts.map((cert) => (
                    <tr key={cert.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <code className="font-mono text-xs text-primary">{cert.id}</code>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-medium capitalize",
                            cert.type === "birth" && "border-blue-500/30 bg-blue-500/10 text-blue-500",
                            cert.type === "death" && "border-orange-500/30 bg-orange-500/10 text-orange-500"
                          )}
                        >
                          {cert.type === "birth" && <Baby className="h-3 w-3 mr-1" />}
                          {cert.type === "death" && <Skull className="h-3 w-3 mr-1" />}
                          {cert.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{cert.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {cert.type === "birth" ? cert.dob : cert.dod}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{cert.issueDate}</td>
                      <td className="px-4 py-3">
                        <span className="text-foreground">{cert.verifications}</span>
                        <span className="text-muted-foreground text-xs ml-1">times</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-medium capitalize",
                            cert.status === "verified" && "border-green-500/30 bg-green-500/10 text-green-500",
                            cert.status === "pending" && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                            cert.status === "revoked" && "border-red-500/30 bg-red-500/10 text-red-500"
                          )}
                        >
                          {cert.status === "verified" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {cert.status === "pending" && <Clock className="h-3 w-3 mr-1" />}
                          {cert.status === "revoked" && <XCircle className="h-3 w-3 mr-1" />}
                          {cert.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedCert(cert)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Download className="h-4 w-4" />
                          </Button>
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
                Showing {filteredCerts.length} of {certificates.length} certificates
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
        </TabsContent>

        <TabsContent value="verify" className="space-y-6">
          {/* Verification Tool */}
          <div className="max-w-xl mx-auto">
            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Verify Certificate</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Enter a certificate ID or scan a QR code to verify authenticity
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter certificate ID (e.g., BC-2024-001-VERIFIED)"
                    value={verifyCertId}
                    onChange={(e) => {
                      setVerifyCertId(e.target.value)
                      setVerifyResult(null)
                    }}
                    className="bg-background border-border flex-1"
                  />
                  <Button onClick={handleVerify} className="bg-primary hover:bg-primary/90">
                    Verify
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                <Button variant="outline" className="w-full border-border">
                  <QrCode className="h-4 w-4 mr-2" />
                  Scan QR Code
                </Button>
              </div>

              {/* Result */}
              {verifyResult && (
                <div
                  className={cn(
                    "rounded-lg p-4 border",
                    verifyResult === "valid"
                      ? "border-green-500/30 bg-green-500/10"
                      : "border-red-500/30 bg-red-500/10"
                  )}
                >
                  {verifyResult === "valid" ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <p className="font-semibold text-green-500">Certificate is Valid</p>
                        <p className="text-sm text-green-500/80 mt-1">
                          This certificate has been verified and is authentic.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                      <div>
                        <p className="font-semibold text-red-500">Certificate Not Found or Invalid</p>
                        <p className="text-sm text-red-500/80 mt-1">
                          The certificate ID provided could not be verified. Please check the ID and try again.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Certificate Preview Dialog */}
      <Dialog open={!!selectedCert} onOpenChange={() => setSelectedCert(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Certificate Preview</DialogTitle>
          </DialogHeader>
          {selectedCert && (
            <div className="space-y-4 mt-4">
              {/* Certificate Card */}
              <div className="relative rounded-xl border-2 border-primary/30 bg-card p-6 overflow-hidden">
                {/* Header stripe */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-primary" />
                
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
                  <Shield className="h-48 w-48 text-foreground" />
                </div>

                <div className="relative space-y-4">
                  {/* Header */}
                  <div className="text-center border-b border-border pb-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Republic of Zambia
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-foreground">
                      {selectedCert.type === "birth" ? "Birth Certificate" : "Death Certificate"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">Official Digital Certificate</p>
                  </div>

                  {/* Content */}
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Certificate No:</span>
                      <code className="font-mono text-xs text-primary">{selectedCert.id}</code>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Full Name:</span>
                      <span className="font-medium text-foreground">{selectedCert.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {selectedCert.type === "birth" ? "Date of Birth:" : "Date of Death:"}
                      </span>
                      <span className="text-foreground">
                        {selectedCert.type === "birth" ? selectedCert.dob : selectedCert.dod}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Province:</span>
                      <span className="text-foreground">{selectedCert.province}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issue Date:</span>
                      <span className="text-foreground">{selectedCert.issueDate}</span>
                    </div>
                  </div>

                  {/* QR Code Placeholder */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="grid grid-cols-6 gap-1">
                      {Array.from({ length: 36 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-2 w-2 rounded-sm",
                            Math.random() > 0.5 ? "bg-foreground" : "bg-transparent"
                          )}
                        />
                      ))}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium",
                        selectedCert.status === "verified" && "border-green-500/30 bg-green-500/10 text-green-500"
                      )}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" className="border-border">
                  <Copy className="h-4 w-4 mr-1" />
                  Copy ID
                </Button>
                <Button variant="outline" className="border-border">
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
                <Button className="bg-primary hover:bg-primary/90">
                  <Download className="h-4 w-4 mr-1" />
                  PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
