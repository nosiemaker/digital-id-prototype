'use client'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { FileText, ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deathRecordApi, referenceApi } from '@/lib/axios'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { DistrictOption } from '@/utils/types'

const steps = [
  { id: 1, label: 'District & Relationship' },
  { id: 2, label: 'Deceased Details (Optional)' },
  { id: 3, label: 'Review & Submit' },
]

export default function PublicNoticeOfDeathPage() {
  const router = useRouter()
  const params = useParams()
  const deathRecordId = params?.id as string

  const [open, setOpen] = useState(true)
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [loadingDistricts, setLoadingDistricts] = useState(false)

  // Strictly matches NoticeOfDeathCreate schema.
  // All other fields (dates, causes, informant details, serials, checkboxes)
  // are auto-populated by the backend service layer.
  const [form, setForm] = useState({
    district: '',
    informant_relationship: '',
    deceased_din: '',
    surname: '',
    other_names: '',
    occupation: '',
    residential_address: '',
    date_of_birth: '',
    sex: 'MALE' as 'MALE' | 'FEMALE',
    nationality: '',
    national_identity_no: '',
    social_security_no: '',
    education_level: '',
    death_type: 'NATURAL' as 'NATURAL' | 'SUDDEN' | 'UNNATURAL',
  })

  useEffect(() => {
    const fetchDistricts = async () => {
      setLoadingDistricts(true)
      try {
        const districtsData = await referenceApi.getDistricts()
        setDistricts(districtsData)
      } catch (err) {
        toast.error('Failed to load districts')
      } finally {
        setLoadingDistricts(false)
      }
    }
    fetchDistricts()
  }, [])

  function validateStep(currentStep: number): boolean {
    const newErrors: Record<string, string> = {}
    if (currentStep === 1) {
      if (!form.district.trim()) newErrors.district = 'District is required'
      if (!form.informant_relationship.trim()) newErrors.informant_relationship = 'Relationship is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => { if (validateStep(step)) { setErrors({}); setStep(s => Math.min(s + 1, 3)) } }
  const prevStep = () => { setErrors({}); setStep(s => Math.max(s - 1, 1)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep(step)) return

    setSubmitting(true)
    try {
      // Build payload strictly matching NoticeOfDeathCreate
      const payload: Record<string, any> = {
        district: form.district.trim(),
        informant_relationship: form.informant_relationship.trim(),
      }

      // Only attach optional fields if the user actually filled them
      if (form.deceased_din.trim()) payload.deceased_din = form.deceased_din.trim()
      if (form.surname.trim()) payload.surname = form.surname.trim()
      if (form.other_names.trim()) payload.other_names = form.other_names.trim()
      if (form.occupation.trim()) payload.occupation = form.occupation.trim()
      if (form.residential_address.trim()) payload.residential_address = form.residential_address.trim()
      if (form.date_of_birth) payload.date_of_birth = form.date_of_birth
      if (form.sex) payload.sex = form.sex
      if (form.nationality.trim()) payload.nationality = form.nationality.trim()
      if (form.national_identity_no.trim()) payload.national_identity_no = form.national_identity_no.trim()
      if (form.social_security_no.trim()) payload.social_security_no = form.social_security_no.trim()
      if (form.education_level.trim()) payload.education_level = form.education_level.trim()
      if (form.death_type && form.death_type !== 'NATURAL') {payload.death_type = form.death_type;}

      await deathRecordApi.submitNoticeOfDeath(parseInt(deathRecordId), payload)
      toast.success('Notice of Death submitted successfully. The Registrar will review your case.')
      setOpen(false)
      router.push('/login')
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
            {step === 1 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
                  <p className="text-sm font-medium text-blue-700">Auto-Populated Data</p>
                  <p className="text-xs text-blue-600/80">Medical causes, dates, informant details, and form serials are automatically loaded from the MCCD & your citizen profile. Only provide the district and your relationship to the deceased.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>District *</Label>
                    <Select value={form.district} onValueChange={(value) => setForm({ ...form, district: value })}>
                      <SelectTrigger className={cn(errors.district && "border-red-500")}>
                        <SelectValue placeholder={loadingDistricts ? "Loading districts..." : "Select district"} />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingDistricts ? (
                          <SelectItem value="loading" disabled>Loading districts...</SelectItem>
                        ) : districts.length === 0 ? (
                          <SelectItem value="no-districts" disabled>No districts available</SelectItem>
                        ) : (
                          districts.map((district) => (
                            <SelectItem key={district.id} value={district.name}>
                              {district.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {errors.district && <p className="text-xs text-red-500">{errors.district}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Your Relationship to Deceased *</Label>
                    <Select value={form.informant_relationship} onValueChange={(value) => setForm({ ...form, informant_relationship: value })}>
                      <SelectTrigger className={cn(errors.informant_relationship && "border-red-500")}>
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
                    {errors.informant_relationship && <p className="text-xs text-red-500">{errors.informant_relationship}</p>}
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Deceased Details (Optional)</h3>
                <p className="text-xs text-muted-foreground -mt-2">Leave blank if the deceased is registered in the system. Provide their DIN or fill manually if unregistered.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Deceased DIN (if known)</Label>
                    <Input value={form.deceased_din} onChange={e => setForm({ ...form, deceased_din: e.target.value })} placeholder="e.g. 123456/01/1" />
                  </div>
                  <div className="space-y-2">
                    <Label>Surname</Label>
                    <Input value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Other Names</Label>
                    <Input value={form.other_names} onChange={e => setForm({ ...form, other_names: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Sex</Label>
                    <Select value={form.sex} onValueChange={(v: any) => setForm({ ...form, sex: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nationality</Label>
                    <Input value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })} placeholder="e.g. Zambian" />
                  </div>
                  <div className="space-y-2">
                    <Label>NRC / National ID</Label>
                    <Input value={form.national_identity_no} onChange={e => setForm({ ...form, national_identity_no: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Occupation</Label>
                    <Input value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} />
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 pt-4">Death Classification</h3>
                <div className="space-y-2">
                  <Label>Type of Death</Label>
                  <Select value={form.death_type} onValueChange={(v: any) => setForm({ ...form, death_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NATURAL">Natural Death</SelectItem>
                      <SelectItem value="SUDDEN">Sudden Death (Post-Mortem Required)</SelectItem>
                      <SelectItem value="UNNATURAL">Unnatural Cause (Coroner Required)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                  <p className="text-sm font-medium text-foreground">Summary</p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                    <li>District: <span className="text-foreground">{form.district}</span></li>
                    <li>Relationship: <span className="text-foreground">{form.informant_relationship}</span></li>
                    <li>Death Type: <span className="text-foreground">{form.death_type}</span></li>
                    {form.deceased_din && <li>Deceased DIN: <span className="text-foreground">{form.deceased_din}</span></li>}
                  </ul>
                  <p className="text-xs text-muted-foreground pt-2">
                    By submitting, you confirm these details are accurate. The Registrar will review the case alongside the Medical Certificate.
                  </p>
                </div>
              </div>
            )}
          </form>

          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20">
            <div className="flex w-full justify-between">
              <Button type="button" variant="outline" onClick={step === 1 ? () => router.back() : prevStep}>
                {step === 1 ? 'Cancel' : <><ArrowLeft className="h-4 w-4 mr-2" /> Back</>}
              </Button>
              {step < 3 ? (
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