'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Search, Plus, ArrowLeft, ArrowRight, Check, AlertCircle,
  Clock, User, MapPin, Calendar, ShieldAlert, FileCheck, Loader2
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { deathRecordApi } from '@/lib/axios'
import { useRoleGuard } from '@/hooks/use-role-guard'
import { useMe } from '@/hooks/useMe'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const steps = [
  { id: 1, label: 'Link Death Record' },
  { id: 2, label: 'Deceased & Informant' },
  { id: 3, label: 'Police & Appendices' },
  { id: 4, label: 'Review & Submit' },
]

export default function NoticeOfDeathPage() {
  useRoleGuard(['CITIZEN', 'HEALTH_WORKER'])
  const router = useRouter()
  const { me, loading: meLoading } = useMe()
  
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  
  // Get citizen DIN from auth context
  const citizenDin = me?.citizen_din || ''

  const [form, setForm] = useState<Record<string, any>>({
    death_record_id: '',
    serial_number: '',
    date_and_time: new Date().toISOString(),
    district: '',
    date_of_death: '',
    place_of_death: 'HEALTH_FACILITY',
    place_of_death_name: '',
    surname: '',
    other_names: '',
    age_at_death: '',
    sex: 'MALE',
    informant_din: citizenDin,
    informant_relationship: '',
    informant_contact_no: '',
    informant_postal_address: '',
    death_type: 'NATURAL',
    has_mccd: true,
    has_informant_national_id: false,
    has_coroner_report: false,
    informant_declaration_name: '',
    informant_declaration_date: new Date().toISOString().split('T')[0],
  })

  // Update form when citizenDin changes
  useEffect(() => {
    if (citizenDin) {
      setForm(prev => ({
        ...prev,
        informant_din: citizenDin,
        informant_declaration_name: me?.name || citizenDin
      }))
    }
  }, [citizenDin, me?.name])

  function validateStep(currentStep: number): boolean {
    const newErrors: Record<string, string> = {}
    if (currentStep === 1) {
      if (!form.death_record_id) newErrors.death_record_id = 'Death Record ID is required'
      if (!form.serial_number) newErrors.serial_number = 'Form serial number is required'
      if (!form.district) newErrors.district = 'District is required'
    }
    if (currentStep === 2) {
      if (!form.date_of_death) newErrors.date_of_death = 'Date of death is required'
      if (!form.surname) newErrors.surname = 'Deceased surname is required'
      if (!form.informant_din) newErrors.informant_din = 'Informant DIN is required'
      if (!form.informant_relationship) newErrors.informant_relationship = 'Relationship is required'
    }
    if (currentStep === 3) {
      if (form.death_type === 'SUDDEN' || form.death_type === 'UNNATURAL') {
        if (!form.has_coroner_report) newErrors.has_coroner_report = 'Coroner report required for sudden/unnatural deaths'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => { if (validateStep(step)) { setErrors({}); setStep(s => Math.min(s + 1, 4)) } }
  const prevStep = () => { setErrors({}); setStep(s => Math.max(s - 1, 1)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep(3)) return
    setSubmitting(true)
    try {
      const payload = {
        serial_number: form.serial_number,
        date_and_time: form.date_and_time,
        district: form.district,
        date_of_death: form.date_of_death,
        place_of_death: form.place_of_death,
        place_of_death_name: form.place_of_death_name || undefined,
        surname: form.surname,
        other_names: form.other_names || undefined,
        age_at_death: form.age_at_death ? parseInt(form.age_at_death) : undefined,
        sex: form.sex,
        informant_din: form.informant_din,
        informant_relationship: form.informant_relationship,
        informant_contact_no: form.informant_contact_no || undefined,
        informant_postal_address: form.informant_postal_address || undefined,
        death_type: form.death_type,
        has_mccd: form.has_mccd,
        has_informant_national_id: form.has_informant_national_id,
        has_coroner_report: form.has_coroner_report,
        informant_declaration_name: form.informant_declaration_name || form.informant_din,
        informant_declaration_date: form.informant_declaration_date,
      }

      await deathRecordApi.submitNoticeOfDeath(parseInt(form.death_record_id), payload)
      toast.success('Notice of Death submitted successfully. The record is now ready for Registrar review.')
      setOpen(false)
      setStep(1)
      // Reset form with current auth context
      setForm({
        death_record_id: '', serial_number: '', date_and_time: new Date().toISOString(),
        district: '', date_of_death: '', place_of_death: 'HEALTH_FACILITY', place_of_death_name: '',
        surname: '', other_names: '', age_at_death: '', sex: 'MALE', informant_din: citizenDin,
        informant_relationship: '', informant_contact_no: '', informant_postal_address: '',
        death_type: 'NATURAL', has_mccd: true, has_informant_national_id: false, has_coroner_report: false,
        informant_declaration_name: me?.name || citizenDin || '', informant_declaration_date: new Date().toISOString().split('T')[0],
      })
      router.push('/admin/citizens/certificates')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.detail || 'Failed to submit Notice of Death')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Submit Notice of Death</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete the DNRPC form to attach to an existing death registration. This step is required before the Registrar can approve the record.
          </p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 w-fit">
          <User className="h-3 w-3 mr-1" /> Citizen / Informant Portal
        </Badge>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) router.back() }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Notice of Death (DNRPC Form)
            </DialogTitle>
            <DialogDescription>
              Link this notice to the Death Record ID provided by the Health Worker.
            </DialogDescription>
            <div className="flex items-center justify-between mt-4 px-2">
              {steps.map((s, i) => (
                <div key={s.id} className="flex items-center flex-1 last:flex-none">
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors border",
                    step > s.id ? "bg-primary text-primary-foreground border-primary" :
                    step === s.id ? "bg-primary/10 text-primary border-primary" : "bg-muted text-muted-foreground border-border"
                  )}>
                    {step > s.id ? <Check className="h-4 w-4" /> : s.id}
                  </div>
                  <span className={cn("ml-2 text-xs font-medium hidden sm:block", step >= s.id ? "text-foreground" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                  {i < steps.length - 1 && <div className={cn("flex-1 h-px mx-3", step > s.id ? "bg-primary" : "bg-border")} />}
                </div>
              ))}
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
                  <p className="text-sm font-medium text-blue-700">Step 1: Link to Existing Death Record</p>
                  <p className="text-xs text-blue-600/80">Enter the Death Record ID (DR-XXXX) given to you by the Health Worker after MCCD submission.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Death Record ID *</Label>
                    <Input placeholder="e.g., 123" value={form.death_record_id} onChange={e => setForm({ ...form, death_record_id: e.target.value })} className={cn(errors.death_record_id && "border-red-500")} />
                    {errors.death_record_id && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.death_record_id}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Form Serial Number *</Label>
                    <Input placeholder="Pre-printed on DNRPC form" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} className={cn(errors.serial_number && "border-red-500")} />
                    {errors.serial_number && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.serial_number}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>District *</Label>
                  <Input placeholder="District of registration" value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} className={cn(errors.district && "border-red-500")} />
                  {errors.district && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.district}</p>}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Deceased Particulars</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Surname *</Label>
                    <Input value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} className={cn(errors.surname && "border-red-500")} />
                    {errors.surname && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.surname}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Other Names</Label>
                    <Input value={form.other_names} onChange={e => setForm({ ...form, other_names: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Age at Death</Label>
                    <Input type="number" value={form.age_at_death} onChange={e => setForm({ ...form, age_at_death: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date of Death *</Label>
                    <Input type="date" value={form.date_of_death} onChange={e => setForm({ ...form, date_of_death: e.target.value })} className={cn(errors.date_of_death && "border-red-500")} />
                    {errors.date_of_death && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.date_of_death}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Sex</Label>
                    <Select value={form.sex} onValueChange={v => setForm({ ...form, sex: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="MALE">Male</SelectItem><SelectItem value="FEMALE">Female</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Place of Death *</Label>
                    <Select value={form.place_of_death} onValueChange={v => setForm({ ...form, place_of_death: v, place_of_death_name: '' })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HEALTH_FACILITY">Health Facility</SelectItem>
                        <SelectItem value="HOME">Home</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.place_of_death !== 'HEALTH_FACILITY' && (
                    <div className="space-y-2">
                      <Label>Place Description / Facility Name</Label>
                      <Input value={form.place_of_death_name} onChange={e => setForm({ ...form, place_of_death_name: e.target.value })} />
                    </div>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 pt-4">Informant Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Informant DIN *</Label>
                    <Input 
                      value={form.informant_din} 
                      onChange={e => setForm({ ...form, informant_din: e.target.value })} 
                      className={cn(errors.informant_din && "border-red-500")}
                      placeholder={meLoading ? "Loading..." : "Your DIN will auto-populate"}
                      disabled={meLoading}
                    />
                    {errors.informant_din && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.informant_din}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship to Deceased *</Label>
                    <Input value={form.informant_relationship} onChange={e => setForm({ ...form, informant_relationship: e.target.value })} className={cn(errors.informant_relationship && "border-red-500")} />
                    {errors.informant_relationship && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.informant_relationship}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input value={form.informant_contact_no} onChange={e => setForm({ ...form, informant_contact_no: e.target.value })} />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Death Classification & Appendices</h3>
                <div className="space-y-2">
                  <Label>Type of Death</Label>
                  <Select value={form.death_type} onValueChange={v => setForm({ ...form, death_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NATURAL">Natural Death</SelectItem>
                      <SelectItem value="SUDDEN">Sudden Death (Post-Mortem Required)</SelectItem>
                      <SelectItem value="UNNATURAL">Unnatural Cause (Coroner Required)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(form.death_type === 'SUDDEN' || form.death_type === 'UNNATURAL') && (
                  <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20 space-y-2">
                    <p className="text-xs text-yellow-600 font-medium flex items-center gap-1"><ShieldAlert className="h-4 w-4" /> Police/Coroner documentation is required for this death type.</p>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attached Documents Checklist</p>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.has_mccd} onChange={e => setForm({ ...form, has_mccd: e.target.checked })} className="h-4 w-4 rounded border-border text-primary" />
                      <span className="text-sm">Original MCCD attached</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.has_informant_national_id} onChange={e => setForm({ ...form, has_informant_national_id: e.target.checked })} className="h-4 w-4 rounded border-border text-primary" />
                      <span className="text-sm">Copy of Informant's NRC/NID attached</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.has_coroner_report} onChange={e => setForm({ ...form, has_coroner_report: e.target.checked })} className="h-4 w-4 rounded border-border text-primary" />
                      <span className="text-sm">Coroner/Post-Mortem Report attached (if applicable)</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-start gap-3">
                    <FileCheck className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-blue-700">Review & Declare</p>
                      <p className="text-xs text-blue-600/80">Verify all details. Submission will mark the death record as ready for Registrar review.</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Record ID:</span> <span className="font-mono ml-2">{form.death_record_id}</span></div>
                  <div><span className="text-muted-foreground">Serial:</span> <span className="font-mono ml-2">{form.serial_number}</span></div>
                  <div><span className="text-muted-foreground">Deceased:</span> <span className="ml-2">{form.other_names} {form.surname}</span></div>
                  <div><span className="text-muted-foreground">Date of Death:</span> <span className="ml-2">{form.date_of_death ? new Date(form.date_of_death).toLocaleDateString() : '-'}</span></div>
                  <div><span className="text-muted-foreground">Informant DIN:</span> <span className="font-mono ml-2">{form.informant_din}</span></div>
                  <div><span className="text-muted-foreground">Relationship:</span> <span className="ml-2">{form.informant_relationship}</span></div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label>Informant Full Name (Declaration) *</Label>
                  <Input value={form.informant_declaration_name} onChange={e => setForm({ ...form, informant_declaration_name: e.target.value })} placeholder="Type your full name to sign" />
                </div>

                <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Declaration</p>
                  <p className="text-xs text-muted-foreground">
                    I hereby declare that the information provided is true and correct. I understand that false statements may result in rejection or legal penalties.
                  </p>
                  <div className="flex items-start gap-2 pt-2">
                    <div className="flex h-4 w-4 items-center justify-center rounded border border-primary bg-primary/20">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <p className="text-xs text-foreground">I confirm all details are accurate and ready for submission.</p>
                  </div>
                </div>
              </div>
            )}
          </form>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20">
            <div className="flex w-full justify-between">
              <Button type="button" variant="outline" onClick={step === 1 ? () => router.back() : prevStep}>
                {step === 1 ? 'Cancel' : <><ArrowLeft className="h-4 w-4 mr-2" /> Back</>}
              </Button>
              {step < 4 ? (
                <Button type="button" onClick={nextStep} className="bg-primary hover:bg-primary/90">
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" onClick={handleSubmit} className="bg-primary hover:bg-primary/90" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  {submitting ? 'Submitting...' : 'Submit Notice of Death'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}