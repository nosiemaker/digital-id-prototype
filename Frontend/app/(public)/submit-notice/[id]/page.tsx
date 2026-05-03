'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  FileText, ArrowLeft, ArrowRight, Check, Loader2
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
import { deathRecordApi } from '@/lib/axios'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const steps = [
  { id: 2, label: 'Deceased & Informant' },
  { id: 3, label: 'Police & Appendices' },
  { id: 4, label: 'Review & Submit' },
]

export default function PublicNoticeOfDeathPage() {
  const router = useRouter()
  // Catch the ID from the email link
  const params = useParams()
  const deathRecordId = params?.id as string

  const [open, setOpen] = useState(true)
  const [step, setStep] = useState(2) // Start at step 2 automatically
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  const [form, setForm] = useState<Record<string, any>>({
    death_record_id: deathRecordId || '',
    serial_number: '', // The user will still need to type the DNRPC form serial
    date_and_time: new Date().toISOString(),
    district: '',
    date_of_death: '',
    place_of_death: 'HEALTH_FACILITY',
    place_of_death_name: '',
    surname: '',
    other_names: '',
    age_at_death: '',
    sex: 'MALE',
    informant_din: '',
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

  useEffect(() => {
    if (deathRecordId) {
      const fetchData = async () => {
        try {
          const response = await deathRecordApi.getRecord(parseInt(deathRecordId))
          const mccdData = response.record
          
          setForm(prev => ({
            ...prev,
            surname: mccdData.notice_of_death?.surname || prev.surname,
            other_names: mccdData.notice_of_death?.other_names || prev.other_names,
            date_of_death: mccdData.notice_of_death?.death_date || prev.date_of_death,
            sex: mccdData.notice_of_death?.sex || prev.sex,
            place_of_death: mccdData.notice_of_death?.place_of_death || prev.place_of_death,
            district: mccdData.notice_of_death?.district || prev.district,
          }))
        } catch (error) {
          toast.error("Could not load existing death record details.")
        } finally {
          setLoadingData(false)
        }
      }
      fetchData()
    } else {
      setLoadingData(false)
    }
  }, [deathRecordId])

  function validateStep(currentStep: number): boolean {
    const newErrors: Record<string, string> = {}
    if (currentStep === 2) {
      if (!form.serial_number) newErrors.serial_number = 'Form serial number is required'
      if (!form.date_of_death) newErrors.date_of_death = 'Date of death is required'
      if (!form.surname) newErrors.surname = 'Deceased surname is required'
      if (!form.informant_din) newErrors.informant_din = 'Informant DIN is required'
      if (!form.informant_relationship) newErrors.informant_relationship = 'Relationship is required'
    }
    if (currentStep === 3) {
      if (form.death_type === 'SUDDEN' || form.death_type === 'UNNATURAL') {
        if (!form.has_coroner_report) newErrors.has_coroner_report = 'Coroner report required'
      }
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => { if (validateStep(step)) { setErrors({}); setStep(s => Math.min(s + 1, 4)) } }
  const prevStep = () => { setErrors({}); setStep(s => Math.max(s - 1, 2)) }

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

      // Notice we are calling the new public endpoint, not the authenticated one
      await deathRecordApi.submitNoticeOfDeath(parseInt(form.death_record_id), payload)
      toast.success('Notice of Death submitted successfully. The Registrar will review it.')
      setOpen(false)
      router.push('/') // Redirect to a generic public success/home page
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.detail || 'Failed to submit Notice of Death')
    } finally {
      setSubmitting(false)
    }
  }

  if (loadingData) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Submit Notice of Death</h1>
          <p className="text-sm text-muted-foreground mt-1">Case Reference: #{deathRecordId}</p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 w-fit">
          Public Informant Portal
        </Badge>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) router.back() }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Notice of Death (DNRPC Form)
            </DialogTitle>
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
            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
                  <p className="text-sm font-medium text-blue-700">Medical Data Pre-filled</p>
                  <p className="text-xs text-blue-600/80">Some details have been loaded from the Medical Certificate. Please review and provide the physical form serial number.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b">
                   <div className="space-y-2">
                    <Label>DNRPC Form Serial Number *</Label>
                    <Input placeholder="Pre-printed on physical form" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} className={cn(errors.serial_number && "border-red-500")} />
                  </div>
                  <div className="space-y-2">
                    <Label>District</Label>
                    <Input value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} />
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-foreground pb-2">Deceased Particulars</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Surname *</Label>
                    <Input value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} className={cn(errors.surname && "border-red-500")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Other Names</Label>
                    <Input value={form.other_names} onChange={e => setForm({ ...form, other_names: e.target.value })} />
                  </div>
                   <div className="space-y-2">
                    <Label>Date of Death *</Label>
                    <Input type="date" value={form.date_of_death} onChange={e => setForm({ ...form, date_of_death: e.target.value })} className={cn(errors.date_of_death && "border-red-500")} />
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 pt-4">Your Details (Informant)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Your DIN / NRC *</Label>
                    <Input value={form.informant_din} onChange={e => setForm({ ...form, informant_din: e.target.value })} className={cn(errors.informant_din && "border-red-500")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Relationship to Deceased *</Label>
                    <Input value={form.informant_relationship} onChange={e => setForm({ ...form, informant_relationship: e.target.value })} className={cn(errors.informant_relationship && "border-red-500")} />
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Death Classification</h3>
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
                 {/* Checkboxes logic exactly as before */}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2 pt-2">
                  <Label>Type Your Full Name to Sign *</Label>
                  <Input value={form.informant_declaration_name} onChange={e => setForm({ ...form, informant_declaration_name: e.target.value })} placeholder="Electronic Signature" />
                </div>
                <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    I confirm all details are accurate and ready for submission to the Registrar.
                  </p>
                </div>
              </div>
            )}
          </form>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20">
            <div className="flex w-full justify-between">
              <Button type="button" variant="outline" onClick={step === 2 ? () => router.back() : prevStep}>
                {step === 2 ? 'Cancel' : <><ArrowLeft className="h-4 w-4 mr-2" /> Back</>}
              </Button>
              {step < 4 ? (
                <Button type="button" onClick={nextStep} className="bg-primary hover:bg-primary/90">
                  Next <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" onClick={handleSubmit} className="bg-primary hover:bg-primary/90" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                  Submit Notice
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}