"use client"
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm, Controller, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { FileText, ArrowLeft, ArrowRight, Check, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deathRecordApi, referenceApi } from '@/lib/axios'
import { cn } from '@/lib/utils'
import type { DistrictOption } from '@/utils/types'

const steps = [
  { id: 1, label: 'District & Relationship' },
  { id: 2, label: 'Deceased Details (Optional)' },
  { id: 3, label: 'Review & Submit' },
]

const noticeOfDeathSchema = z.object({
  district: z.string().min(1, 'District is required'),
  informant_relationship: z.string().min(1, 'Relationship is required'),
  deceased_din: z.string().optional(),
  surname: z.string().optional(),
  other_names: z.string().optional(),
  occupation: z.string().optional(),
  residential_address: z.string().optional(),
  date_of_birth: z.string().optional(),
  sex: z.enum(['MALE', 'FEMALE']).default('MALE'),
  nationality: z.string().optional(),
  national_identity_no: z.string().optional(),
  social_security_no: z.string().optional(),
  education_level: z.string().optional(),
  death_type: z.enum(['NATURAL', 'SUDDEN', 'UNNATURAL']).default('NATURAL'),
})

type NoticeOfDeathForm = z.infer<typeof noticeOfDeathSchema>

const stepFields: Record<number, (keyof NoticeOfDeathForm)[]> = {
  1: ['district', 'informant_relationship'],
  2: [],
  3: [],
}

export default function PublicNoticeOfDeathPage() {
  const router = useRouter()
  const params = useParams()
  const deathRecordId = params?.id as string
  const [step, setStep] = useState(1)
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<NoticeOfDeathForm>({
    resolver: zodResolver(noticeOfDeathSchema),
    defaultValues: {
      district: '',
      informant_relationship: '',
      deceased_din: '',
      surname: '',
      other_names: '',
      occupation: '',
      residential_address: '',
      date_of_birth: '',
      sex: 'MALE',
      nationality: '',
      national_identity_no: '',
      social_security_no: '',
      education_level: '',
      death_type: 'NATURAL',
    },
    mode: 'onChange',
  })

  useEffect(() => {
    const fetchDistricts = async () => {
      setLoadingDistricts(true)
      setApiError(null)
      try {
        const data = await referenceApi.getDistricts()
        setDistricts(data)
      } catch {
        setApiError('Failed to load districts. Please refresh the page.')
      } finally {
        setLoadingDistricts(false)
      }
    }
    fetchDistricts()
  }, [])

  const nextStep = async () => {
    setApiError(null)
    const isValid = await trigger(stepFields[step])
    if (isValid) setStep(s => Math.min(s + 1, 3))
  }

  const prevStep = () => {
    setApiError(null)
    setStep(s => Math.max(s - 1, 1))
  }

  const onSubmit: SubmitHandler<NoticeOfDeathForm> = async (data) => {
    setApiError(null)
    const recordId = parseInt(deathRecordId)
    if (!deathRecordId || isNaN(recordId)) {
      setApiError('Invalid case reference in URL')
      return
    }

    try {
      const clean = (val: string | undefined) => val?.trim() ? val.trim() : undefined
      const payload: Record<string, any> = {
        district: data.district.trim(),
        informant_relationship: data.informant_relationship.trim(),
      }

      if (clean(data.deceased_din)) payload.deceased_din = clean(data.deceased_din)
      if (clean(data.surname)) payload.surname = clean(data.surname)
      if (clean(data.other_names)) payload.other_names = clean(data.other_names)
      if (clean(data.occupation)) payload.occupation = clean(data.occupation)
      if (clean(data.residential_address)) payload.residential_address = clean(data.residential_address)
      if (data.date_of_birth) payload.date_of_birth = data.date_of_birth
      if (data.sex) payload.sex = data.sex
      if (clean(data.nationality)) payload.nationality = clean(data.nationality)
      if (clean(data.national_identity_no)) payload.national_identity_no = clean(data.national_identity_no)
      if (clean(data.social_security_no)) payload.social_security_no = clean(data.social_security_no)
      if (clean(data.education_level)) payload.education_level = clean(data.education_level)
      if (data.death_type && data.death_type !== 'NATURAL') payload.death_type = data.death_type

      await deathRecordApi.submitNoticeOfDeath(recordId, payload)
      setSuccess(true)
      setTimeout(() => router.push('/login'), 1500)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      
      if (typeof detail === 'object' && detail !== null) {
        let generalMsg = ''
        Object.entries(detail).forEach(([field, messages]) => {
          const msg = Array.isArray(messages) ? messages[0] : String(messages)
          if (field in noticeOfDeathSchema.shape) {
            setError(field as keyof NoticeOfDeathForm, { type: 'server', message: msg })
          } else {
            generalMsg += generalMsg ? ` | ${field}: ${msg}` : `${field}: ${msg}`
          }
        })
        setApiError(generalMsg || 'Please fix the highlighted fields.')
      } else {
        setApiError(typeof detail === 'string' ? detail : 'Failed to submit Notice of Death')
      }
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-start justify-center pt-10 sm:pt-16">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Submit Notice of Death</h1>
            <p className="text-sm text-muted-foreground mt-1">Case Reference: #{deathRecordId}</p>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 w-fit">
            Public Informant Portal
          </Badge>
        </div>

        {/* Inline Feedback Banners */}
        {apiError && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{apiError}</span>
          </div>
        )}
        {success && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            <span>Notice of Death submitted successfully. Redirecting to login...</span>
          </div>
        )}

        {/* Stepper */}
        <div className="flex items-center justify-between px-2 py-4 bg-card rounded-lg border border-border">
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

        {/* Form Card */}
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card rounded-lg border border-border p-6 space-y-6">
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
                <p className="text-sm font-medium text-blue-700">Auto-Populated Data</p>
                <p className="text-xs text-blue-600/80">Medical causes, dates, informant details, and form serials are automatically loaded from the MCCD & your citizen profile. Only provide the district and your relationship to the deceased.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>District *</Label>
                  <Controller name="district" control={control} render={({ field, fieldState }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={cn((fieldState.error || errors.district) && "border-red-500")}>
                        <SelectValue placeholder={loadingDistricts ? "Loading districts..." : "Select district"} />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingDistricts ? (
                          <SelectItem value="loading" disabled>Loading districts...</SelectItem>
                        ) : districts.length === 0 ? (
                          <SelectItem value="no-districts" disabled>No districts available</SelectItem>
                        ) : (
                          districts.map((district) => (
                            <SelectItem key={district.id} value={district.name}>{district.name}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )} />
                  {errors.district && <p className="text-xs text-red-500 mt-1">{errors.district.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Your Relationship to Deceased *</Label>
                  <Controller name="informant_relationship" control={control} render={({ field, fieldState }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={cn((fieldState.error || errors.informant_relationship) && "border-red-500")}>
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
                  )} />
                  {errors.informant_relationship && <p className="text-xs text-red-500 mt-1">{errors.informant_relationship.message}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Deceased Details (Optional)</h3>
              <p className="text-xs text-muted-foreground -mt-2">Leave blank if the deceased is registered in the system. Provide their DIN or fill manually if unregistered.</p>
            
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deceased DIN (if known)</Label>
                  <Input {...register('deceased_din')} placeholder="e.g. 123456/01/1" />
                </div>
                <div className="space-y-2">
                  <Label>Surname</Label>
                  <Input {...register('surname')} />
                </div>
                <div className="space-y-2">
                  <Label>Other Names</Label>
                  <Input {...register('other_names')} />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth</Label>
                  <Input type="date" {...register('date_of_birth')} />
                </div>
                <div className="space-y-2">
                  <Label>Sex</Label>
                  <Controller name="sex" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select sex" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label>Nationality</Label>
                  <Input {...register('nationality')} placeholder="e.g. Zambian" />
                </div>
                <div className="space-y-2">
                  <Label>NRC / National ID</Label>
                  <Input {...register('national_identity_no')} />
                </div>
                <div className="space-y-2">
                  <Label>Occupation</Label>
                  <Input {...register('occupation')} />
                </div>
              </div>

              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 pt-4">Death Classification</h3>
              <div className="space-y-2">
                <Label>Type of Death</Label>
                <Controller name="death_type" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NATURAL">Natural Death</SelectItem>
                      <SelectItem value="SUDDEN">Sudden Death (Post-Mortem Required)</SelectItem>
                      <SelectItem value="UNNATURAL">Unnatural Cause (Coroner Required)</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                <p className="text-sm font-medium text-foreground">Summary</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
                  <li>District: <span className="text-foreground">{watch('district')}</span></li>
                  <li>Relationship: <span className="text-foreground">{watch('informant_relationship')}</span></li>
                  <li>Death Type: <span className="text-foreground">{watch('death_type')}</span></li>
                  {watch('deceased_din') && <li>Deceased DIN: <span className="text-foreground">{watch('deceased_din')}</span></li>}
                </ul>
                <p className="text-xs text-muted-foreground pt-2">
                  By submitting, you confirm these details are accurate. The Registrar will review the case alongside the Medical Certificate.
                </p>
              </div>
            </div>
          )}

          {/* Navigation & Submit Buttons */}
          <div className="flex w-full justify-between pt-4 border-t border-border mt-6">
            <Button type="button" variant="outline" onClick={step === 1 ? () => router.back() : prevStep}>
              {step === 1 ? 'Cancel' : <><ArrowLeft className="h-4 w-4 mr-2" /> Back</>}
            </Button>
            {step < 3 ? (
              <Button type="button" onClick={nextStep} className="bg-primary hover:bg-primary/90">
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting || success}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                {isSubmitting ? 'Submitting...' : 'Submit Notice'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}