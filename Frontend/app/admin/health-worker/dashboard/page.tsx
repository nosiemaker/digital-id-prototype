'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Baby, Skull, Clock, CheckCircle2, XCircle, Plus, FileText, Eye,
  AlertCircle, Loader2, ChevronLeft, ChevronRight, Search, Filter
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { birthRecordApi, deathRecordApi } from '@/lib/axios'
import { useRoleGuard } from '@/hooks/use-role-guard'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  DocumentViewerDialog,
  BIRTH_FULL_PACK_ENDPOINT,
  DEATH_FULL_PACK_ENDPOINT,
  type StreamingEndpoint,
} from '@/components/document-viewer'

export default function HealthWorkerDashboard() {
  useRoleGuard(['HEALTH_WORKER'])
  const router = useRouter()
  
  const [birthSubmissions, setBirthSubmissions] = useState<any[]>([])
  const [deathSubmissions, setDeathSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<'birth' | 'death'>('birth')
  
  // Document viewer state
  const [viewerOpen, setViewerOpen] = useState(false)
  const [viewerEndpoint, setViewerEndpoint] = useState<StreamingEndpoint | null>(null)
  const [viewerRecordId, setViewerRecordId] = useState<number | null>(null)
  const [viewerRecordName, setViewerRecordName] = useState('')
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [birthData, deathData] = await Promise.all([
        birthRecordApi.getMySubmissions(),
        deathRecordApi.getMySubmissions()
      ])
      setBirthSubmissions(birthData.records || [])
      setDeathSubmissions(deathData.records || [])
    } catch (err: any) {
      toast.error(err.detail || 'Failed to load your submissions')
    } finally {
      setLoading(false)
    }
  }

  const allSubmissions = activeTab === 'birth' ? birthSubmissions : deathSubmissions
  const filtered = allSubmissions.filter(r => {
    const name = activeTab === 'birth'
      ? `${r.child_given_name || ''} ${r.child_surname || ''}`.trim()
      : r.attended_name || r.deceasedName || ''
    
    const matchesSearch = 
      name.toLowerCase().includes(search.toLowerCase()) ||
      (r.id || '').toString().includes(search)
    const matchesStatus = statusFilter === 'all' || r.status?.toLowerCase() === statusFilter
    return matchesSearch && matchesStatus
  })

  const stats = {
    pendingBirths: birthSubmissions.filter(r => r.status === 'PENDING').length,
    approvedBirths: birthSubmissions.filter(r => r.status === 'APPROVED').length,
    rejectedBirths: birthSubmissions.filter(r => r.status === 'REJECTED').length,
    pendingDeaths: deathSubmissions.filter(r => r.status === 'PENDING').length,
    approvedDeaths: deathSubmissions.filter(r => r.status === 'APPROVED').length,
    rejectedDeaths: deathSubmissions.filter(r => r.status === 'REJECTED').length,
  }

  function openViewer(endpoint: StreamingEndpoint, record: any, name: string) {
    setViewerEndpoint(endpoint)
    setViewerRecordId(record.id)
    setViewerRecordName(name)
    setViewerOpen(true)
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Health Worker Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your birth and death registration submissions
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => router.push('/admin/health-worker/birth-records')} className="bg-primary hover:bg-primary/90">
            <Baby className="h-4 w-4 mr-2" /> Register Birth
          </Button>
          <Button onClick={() => router.push('/admin/health-worker/death-records')} variant="outline" className="border-border">
            <Skull className="h-4 w-4 mr-2" /> Register Death
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

      {/* Submission History Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">My Submission History</h2>
          <div className="flex items-center gap-1 p-1 bg-muted/30 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('birth')}
              className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-all", activeTab === 'birth' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              Births
            </button>
            <button
              onClick={() => setActiveTab('death')}
              className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-all", activeTab === 'death' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              Deaths
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Notes</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">No submissions found</td></tr>
                ) : filtered.map(record => (
                  <tr key={record.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-primary">
                      {activeTab === 'birth' ? 'BR-' : 'DR-'}{record.id?.toString().padStart(4, '0')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-foreground">
                        {activeTab === 'birth' 
                          ? `${record.child_given_name || ''} ${record.child_surname || ''}`.trim()
                          : record.attended_name || record.deceasedName || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {record.submitted_at ? new Date(record.submitted_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn(
                        "text-xs font-medium capitalize",
                        record.status === 'APPROVED' && "border-green-500/30 bg-green-500/10 text-green-500",
                        record.status === 'PENDING' && "border-yellow-500/30 bg-yellow-500/10 text-yellow-500",
                        record.status === 'REJECTED' && "border-red-500/30 bg-red-500/10 text-red-500"
                      )}>
                        {record.status === 'APPROVED' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {record.status === 'PENDING' && <Clock className="h-3 w-3 mr-1" />}
                        {record.status === 'REJECTED' && <XCircle className="h-3 w-3 mr-1" />}
                        {record.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {record.status === 'REJECTED' && record.rejection_reason ? (
                        <span className="text-red-600 font-medium" title={record.rejection_reason}>
                          ⚠️ {record.rejection_reason}
                        </span>
                      ) : record.status === 'PENDING' ? (
                        'Awaiting review'
                      ) : (
                        'Completed'
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {record.status === 'APPROVED' && (
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => openViewer(
                            activeTab === 'birth' ? BIRTH_FULL_PACK_ENDPOINT : DEATH_FULL_PACK_ENDPOINT,
                            record,
                            activeTab === 'birth' ? `${record.child_given_name} ${record.child_surname}` : record.attended_name
                          )}>
                          <FileText className="h-4 w-4 mr-1" /> View Docs
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Document Viewer */}
      {viewerEndpoint && viewerRecordId && (
        <DocumentViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          endpoint={viewerEndpoint}
          recordId={viewerRecordId}
          recordName={viewerRecordName}
          token={token}
          status="APPROVED"
        />
      )}
    </div>
  )
}