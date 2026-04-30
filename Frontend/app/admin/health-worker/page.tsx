'use client'

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Baby, 
  Skull, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  TrendingUp,
  Building2,
  AlertCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { birthRecordApi, deathRecordApi } from "@/lib/axios"
import { useRoleGuard } from "@/hooks/use-role-guard"
import { toast } from "sonner"

export default function HealthWorkerDashboard() {
  useRoleGuard(["HEALTH_WORKER"])
  const router = useRouter()
  
  const [stats, setStats] = useState({
    pendingBirths: 0,
    approvedBirths: 0,
    rejectedBirths: 0,
    pendingDeaths: 0,
    approvedDeaths: 0,
    rejectedDeaths: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    try {
      const [birthData, deathData] = await Promise.all([
        birthRecordApi.getAll(),
        deathRecordApi.getPendingSubmissions()
      ])

      const births = birthData.records || []
      const deaths = (deathData as any).records || deathData || []

      setStats({
        pendingBirths: births.filter((r: any) => r.status === "PENDING").length,
        approvedBirths: births.filter((r: any) => r.status === "APPROVED").length,
        rejectedBirths: births.filter((r: any) => r.status === "REJECTED").length,
        pendingDeaths: deaths.filter((r: any) => r.status === "PENDING").length,
        approvedDeaths: deaths.filter((r: any) => r.status === "APPROVED").length,
        rejectedDeaths: deaths.filter((r: any) => r.status === "REJECTED").length,
      })
    } catch (err) {
      toast.error("Failed to load statistics")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Health Worker Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage birth and death registrations at your facility
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => router.push("/admin/birth-records")} className="bg-primary hover:bg-primary/90">
            <Baby className="h-4 w-4 mr-2" />
            Birth Records
          </Button>
          <Button onClick={() => router.push("/admin/death-records")} variant="outline" className="border-border">
            <Skull className="h-4 w-4 mr-2" />
            Death Records
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Births</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingBirths}</div>
            <p className="text-xs text-muted-foreground">Awaiting registrar review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved Births</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedBirths}</div>
            <p className="text-xs text-muted-foreground">Certificates issued</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Deaths</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingDeaths}</div>
            <p className="text-xs text-muted-foreground">Awaiting registrar review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved Deaths</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedDeaths}</div>
            <p className="text-xs text-muted-foreground">Certificates & permits issued</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => router.push("/admin/birth-records?action=new")}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Plus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Register New Birth</h3>
                <p className="text-sm text-muted-foreground">Submit Notice of Birth and Record of Birth forms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => router.push("/admin/death-records?action=new")}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10">
                <Plus className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Register New Death</h3>
                <p className="text-sm text-muted-foreground">Submit MCCD and Notice of Death forms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">View all your submissions in the Birth Records and Death Records sections</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}