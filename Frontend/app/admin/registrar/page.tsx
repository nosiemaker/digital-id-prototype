"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Baby, Skull, Clock, CheckCircle2, FileText, ArrowRight,
  Loader2, AlertTriangle, UserCheck, Calendar, TrendingUp
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { birthRecordApi, deathRecordApi } from "@/lib/axios"
import { useRoleGuard } from "@/hooks/use-role-guard"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function RegistrarDashboardPage() {
  useRoleGuard(["REGISTRAR"])
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [pendingBirths, setPendingBirths] = useState<any[]>([])
  const [pendingDeaths, setPendingDeaths] = useState<any[]>([])
  const [allBirths, setAllBirths] = useState<any[]>([])
  const [allDeaths, setAllDeaths] = useState<any[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  async function fetchDashboardData() {
    setLoading(true)
    try {
      const [birthAll, birthPending, deathAll, deathPending] = await Promise.all([
        birthRecordApi.getAll(),
        birthRecordApi.getPendingSubmissions(),
        deathRecordApi.getAll(),
        deathRecordApi.getPendingSubmissions()
      ])

      setAllBirths(birthAll.records || [])
      setPendingBirths(birthPending.pending_submissions || [])
      setAllDeaths(deathAll.records || [])
      setPendingDeaths(deathPending.pending_submissions || [])
    } catch (err: any) {
      toast.error(err.detail || "Failed to load dashboard data")
    } finally {
      setLoading(false)
    }
  }

  const isToday = (dateString: string) => {
    if (!dateString) return false
    return new Date(dateString).toDateString() === new Date().toDateString()
  }

  const stats = [
    {
      label: "Pending Birth Reviews",
      value: pendingBirths.length.toString(),
      icon: Baby,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      action: () => router.push("/admin/registrar/birth-records")
    },
    {
      label: "Pending Death Reviews",
      value: pendingDeaths.length.toString(),
      icon: Skull,
      color: "text-red-500",
      bg: "bg-red-500/10",
      action: () => router.push("/admin/registrar/death-records")
    },
    {
      label: "Approved Today",
      value: [
        ...allBirths.filter((r: any) => r.status === "APPROVED" && isToday(r.reviewed_at)),
        ...allDeaths.filter((r: any) => r.status === "APPROVED" && isToday(r.reviewed_at))
      ].length.toString(),
      icon: CheckCircle2,
      color: "text-green-500",
      bg: "bg-green-500/10",
      action: () => router.push("/admin/registrar/certificates")
    },
    {
      label: "Total Processed",
      value: [
        ...allBirths.filter((r: any) => r.status !== "PENDING"),
        ...allDeaths.filter((r: any) => r.status !== "PENDING")
      ].length.toString(),
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
      action: () => router.push("/admin/registrar/certificates")
    }
  ]

  const recentPending = [
    ...pendingBirths.map((r: any) => ({ ...r, type: "birth" as const })),
    ...pendingDeaths.map((r: any) => ({ ...r, type: "death" as const }))
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registrar Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of pending reviews, approvals, and certificate issuance
          </p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
          <UserCheck className="h-3 w-3 mr-1" /> Registrar Portal
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              onClick={stat.action}
              className="rounded-xl border border-border bg-card p-4 cursor-pointer hover:bg-muted/30 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.bg)}>
                  <Icon className={cn("h-5 w-5", stat.color)} />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push("/admin/registrar/birth-records")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Baby className="h-4 w-4 text-blue-500" /> Birth Record Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Review and approve birth registrations. Generate certificates & DINs.
            </p>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {pendingBirths.length} pending
              </Badge>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                Open <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push("/admin/registrar/death-records")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Skull className="h-4 w-4 text-red-500" /> Death Record Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Verify MCCD & Notice of Death. Issue certificates & burial permits.
            </p>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {pendingDeaths.length} pending
              </Badge>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                Open <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push("/admin/registrar/certificates")}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Certificate Registry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Search, view, and reissue approved birth & death certificates.
            </p>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {allBirths.length + allDeaths.length} total
              </Badge>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                Open <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Pending Submissions */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" /> Recent Pending Submissions
          </h3>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => router.push("/admin/registrar/birth-records")}>
            View All
          </Button>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : recentPending.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500/50" />
            <p>All caught up! No pending submissions require your attention.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Submitted</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentPending.map((record) => (
                  <tr key={`${record.type}-${record.id}`} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn(
                        "text-xs capitalize",
                        record.type === "birth" ? "border-blue-500/30 bg-blue-500/10 text-blue-500" : "border-red-500/30 bg-red-500/10 text-red-500"
                      )}>
                        {record.type === "birth" ? <Baby className="h-3 w-3 mr-1" /> : <Skull className="h-3 w-3 mr-1" />}
                        {record.type}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {record.type === "birth"
                        ? `${record.child_given_name || ""} ${record.child_surname || ""}`.trim()
                        : record.attended_name || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {record.type === "birth"
                        ? record.date_of_birth ? new Date(record.date_of_birth).toLocaleDateString() : "—"
                        : record.death_date ? new Date(record.death_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(record.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => router.push(`/admin/registrar/${record.type}-records`)}
                      >
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* System Notice */}
      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Registrar Workflow Reminder</p>
          <p className="text-sm text-blue-700 mt-1">
            Approving a record will automatically generate the official certificate, assign a DIN (for births), 
            and update the citizen registry. Ensure all supporting documents are verified before confirmation.
          </p>
        </div>
      </div>
    </div>
  )
}