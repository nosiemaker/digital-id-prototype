"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Baby, Check, ArrowLeft, ArrowRight, Loader2,
} from "lucide-react"
import { DINLookupInput } from "@/components/din-lookup-input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { birthRecordApi } from "@/lib/api"
import { referenceApi } from "@/lib/api"
import { useRoleGuard } from "@/hooks/use-role-guard"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { CitizenLookupResult, DistrictOption } from "@/utils/types"

const steps = [
  { id: 1, label: "Child & Birth Details" },
  { id: 2, label: "Parent Information" },
  { id: 3, label: "Attendance & Sign-off" },
  { id: 4, label: "Review & Submit" },
]

const birthRecordSchema = z.object({
  submission_ref: z.string(),
  district: z.string().min(1, "District is required"),
  date_and_time_of_birth_notification: z.string().min(1, "Notification date & time is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  place_of_birth: z.enum(["HEALTH_FACILITY", "HOME", "OTHER"]),
  health_facility_name: z.string().optional(),
  home_address: z.string().optional(),
  other_place_specified: z.string().optional(),
  child_surname: z.string().min(1, "Surname is required"),
  child_given_name: z.string().min(1, "Given name is required"),
  child_other_names: z.string().optional(),
  sex: z.enum(["MALE", "FEMALE"]),
  birth_weight_kg: z.string().min(1, "Weight is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Must be a valid positive number"
  ),
  mother_din: z.string().min(1, "Mother DIN is required"),
  father_din: z.string().optional(),
  mother_village_of_origin: z.string().optional(),
  mother_chief: z.string().optional(),
  mother_district: z.string().optional(),
  mother_tribe: z.string().optional(),
  mother_usual_place_of_residence: z.string().optional(),
  father_village_of_origin: z.string().optional(),
  father_chief: z.string().optional(),
  father_district: z.string().optional(),
  father_tribe: z.string().optional(),
  attendant_at_birth: z.enum(["MIDWIFE", "TBA", "OTHER"]),
  attendant_other_specified: z.string().optional(),
  marital_status: z.string().min(1, "Marital status is required"),
  father_acknowledgement_date: z.string().optional(),
  mother_consent_date: z.string().optional(),
  file_number: z.string().optional(),
  place_of_birth_text: z.string().optional(),
  time_of_birth: z.string().optional(),
  officer_in_charge: z.string().optional(),
  official_stamp_ref: z.string().optional(),
  date_signed: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.place_of_birth === "HEALTH_FACILITY" && !data.health_facility_name?.trim()) {
    ctx.addIssue({ path: ["health_facility_name"], code: z.ZodIssueCode.custom, message: "Facility name is required" })
  }
  if (data.place_of_birth === "HOME" && !data.home_address?.trim()) {
    ctx.addIssue({ path: ["home_address"], code: z.ZodIssueCode.custom, message: "Home address is required" })
  }
  if (data.place_of_birth === "OTHER" && !data.other_place_specified?.trim()) {
    ctx.addIssue({ path: ["other_place_specified"], code: z.ZodIssueCode.custom, message: "Please specify the place" })
  }
  if (data.attendant_at_birth === "OTHER" && !data.attendant_other_specified?.trim()) {
    ctx.addIssue({ path: ["attendant_other_specified"], code: z.ZodIssueCode.custom, message: "Please specify attendant" })
  }
  if (data.marital_status === "NOT_MARRIED") {
    if (!data.father_acknowledgement_date?.trim()) {
      ctx.addIssue({ path: ["father_acknowledgement_date"], code: z.ZodIssueCode.custom, message: "Acknowledgement date required" })
    }
    if (!data.mother_consent_date?.trim()) {
      ctx.addIssue({ path: ["mother_consent_date"], code: z.ZodIssueCode.custom, message: "Consent date required" })
    }
  }
})

type BirthRecordForm = z.infer<typeof birthRecordSchema>


const stepFields: Record<number, (keyof BirthRecordForm)[]> = {
  1: ["district", "child_surname", "child_given_name", "date_of_birth", "birth_weight_kg", "place_of_birth", "health_facility_name", "home_address", "other_place_specified", "date_and_time_of_birth_notification"],
  2: ["mother_din", "father_din", "mother_village_of_origin", "mother_chief", "mother_district", "mother_tribe", "mother_usual_place_of_residence", "father_village_of_origin", "father_chief", "father_district", "father_tribe"],
  3: ["attendant_at_birth", "attendant_other_specified", "marital_status", "father_acknowledgement_date", "mother_consent_date", "file_number", "place_of_birth_text", "time_of_birth", "officer_in_charge", "official_stamp_ref", "date_signed"],
}

function generateSubmissionRef() {
  const ts = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `BR-SUB-${ts}-${rnd}`
}

export default function BirthRecordsPage() {
  useRoleGuard(["HEALTH_WORKER", "REGISTRAR"])
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [motherCitizen, setMotherCitizen] = useState<CitizenLookupResult | null>(null)
  const [fatherCitizen, setFatherCitizen] = useState<CitizenLookupResult | null>(null)

  const {
    register,
    control,
    handleSubmit,
    trigger,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<BirthRecordForm>({
    resolver: zodResolver(birthRecordSchema),
    defaultValues: {
      submission_ref: generateSubmissionRef(),
      district: "",
      date_and_time_of_birth_notification: new Date().toISOString(),
      date_of_birth: new Date().toISOString().split("T")[0],
      place_of_birth: "HEALTH_FACILITY",
      health_facility_name: "",
      home_address: "",
      other_place_specified: "",
      child_surname: "",
      child_given_name: "",
      child_other_names: "",
      sex: "MALE",
      birth_weight_kg: "",
      mother_din: "",
      father_din: "",
      mother_village_of_origin: "", mother_chief: "", mother_district: "", mother_tribe: "", mother_usual_place_of_residence: "",
      father_village_of_origin: "", father_chief: "", father_district: "", father_tribe: "",
      attendant_at_birth: "MIDWIFE",
      attendant_other_specified: "",
      marital_status: "MARRIED",
      father_acknowledgement_date: "",
      mother_consent_date: "",
      file_number: "",
      place_of_birth_text: "",
      time_of_birth: "",
      officer_in_charge: "",
      official_stamp_ref: "",
      date_signed: "",
    },
    mode: "onChange",
  })

  const placeOfBirth = watch("place_of_birth")
  const attendantAtBirth = watch("attendant_at_birth")
  const maritalStatus = watch("marital_status")

  useEffect(() => {
    const fetchDistricts = async () => {
      setLoadingDistricts(true)
      try {
        const data = await referenceApi.getDistricts()
        setDistricts(data)
      } catch {
        toast.error("Failed to load districts")
      } finally {
        setLoadingDistricts(false)
      }
    }
    fetchDistricts()
  }, [])

  const nextStep = async () => {
    const isValid = await trigger(stepFields[step])
    if (isValid) setStep(s => Math.min(s + 1, 4))
  }
  const prevStep = () => setStep(s => Math.max(s - 1, 1))

  const onSubmit: SubmitHandler<BirthRecordForm> = async (data) => {
    try {
      const payload = {
        mother_din: data.mother_din,
        father_din: data.father_din || "",
        district: data.district,
        date_and_time_of_birth_notification: data.date_and_time_of_birth_notification,
        date_of_birth: data.date_of_birth,
        place_of_birth: data.place_of_birth,
        health_facility_name: data.place_of_birth === "HEALTH_FACILITY" ? data.health_facility_name : undefined,
        home_address: data.place_of_birth === "HOME" ? data.home_address : undefined,
        other_place_specified: data.place_of_birth === "OTHER" ? data.other_place_specified : undefined,
        child_surname: data.child_surname,
        child_given_name: data.child_given_name,
        child_other_names: data.child_other_names || undefined,
        sex: data.sex,
        birth_weight_kg: parseFloat(data.birth_weight_kg),
        mother_village_of_origin: data.mother_village_of_origin || undefined,
        mother_chief: data.mother_chief || undefined,
        mother_district: data.mother_district || undefined,
        mother_tribe: data.mother_tribe || undefined,
        mother_usual_place_of_residence: data.mother_usual_place_of_residence || undefined,
        father_village_of_origin: data.father_village_of_origin || undefined,
        father_chief: data.father_chief || undefined,
        father_district: data.father_district || undefined,
        father_tribe: data.father_tribe || undefined,
        attendant_at_birth: data.attendant_at_birth,
        attendant_other_specified: data.attendant_at_birth === "OTHER" ? data.attendant_other_specified : undefined,
        marital_status: data.marital_status as "MARRIED" | "NOT_MARRIED" | "DIVORCED" | "WIDOWED",
        father_acknowledgement_date: data.marital_status === "NOT_MARRIED" ? data.father_acknowledgement_date : undefined,
        mother_consent_date: data.marital_status === "NOT_MARRIED" ? data.mother_consent_date : undefined,
        file_number: data.file_number || undefined,
        place_of_birth_text: data.place_of_birth_text || undefined,
        time_of_birth: data.time_of_birth || undefined,
        officer_in_charge: data.officer_in_charge || undefined,
        official_stamp_ref: data.official_stamp_ref || undefined,
        date_signed: data.date_signed || undefined,
      }

      await birthRecordApi.submit(payload)
      toast.success("Birth record submitted. Awaiting Registrar review.")
      router.push('/admin/health-worker/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.detail || "Submission failed")
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Baby className="h-6 w-6 text-primary" /> Register Birth
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete the multi-step form. Serial numbers are auto-generated by the system.</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1 last:flex-none">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors border",
              step > s.id ? "bg-primary text-primary-foreground border-primary" :
              step === s.id ? "bg-primary/10 text-primary border-primary" : "bg-muted text-muted-foreground border-border"
            )}>
              {step > s.id ? <Check className="h-4 w-4" /> : s.id}
            </div>
            <span className={cn("ml-2 text-xs font-medium hidden sm:block", step >= s.id ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
            {i < steps.length - 1 && <div className={cn("flex-1 h-px mx-3", step > s.id ? "bg-primary" : "bg-border")} />}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-6 space-y-6">
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Submission Reference</Label>
                  <Input value={watch("submission_ref")} disabled className="bg-muted/30" />
                  <p className="text-xs text-muted-foreground">Auto-generated for tracking. System assigns official serials on submit.</p>
                </div>
                <div className="space-y-2">
                  <Label>District *</Label>
                  <Controller name="district" control={control} render={({ field, fieldState }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={cn(fieldState.error && "border-red-500")}>
                        <SelectValue placeholder="Select district" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingDistricts ? <SelectItem value="loading" disabled>Loading...</SelectItem> :
                         districts.length > 0 ? districts.map(d => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>) :
                         <SelectItem value="none" disabled>No districts available</SelectItem>}
                      </SelectContent>
                    </Select>
                  )} />
                  {errors.district && <p className="text-xs text-red-500">{errors.district.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Child Surname *</Label>
                  <Input {...register("child_surname")} className={cn(errors.child_surname && "border-red-500")} />
                  {errors.child_surname && <p className="text-xs text-red-500">{errors.child_surname.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Given Name *</Label>
                  <Input {...register("child_given_name")} className={cn(errors.child_given_name && "border-red-500")} />
                  {errors.child_given_name && <p className="text-xs text-red-500">{errors.child_given_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Other Names</Label>
                  <Input {...register("child_other_names")} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Sex *</Label>
                  <Controller name="sex" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent><SelectItem value="MALE">Male</SelectItem><SelectItem value="FEMALE">Female</SelectItem></SelectContent>
                    </Select>
                  )} />
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth *</Label>
                  <Input type="date" {...register("date_of_birth")} className={cn(errors.date_of_birth && "border-red-500")} />
                  {errors.date_of_birth && <p className="text-xs text-red-500">{errors.date_of_birth.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Birth Weight (kg) *</Label>
                  <Input type="number" step="0.1" {...register("birth_weight_kg")} className={cn(errors.birth_weight_kg && "border-red-500")} />
                  {errors.birth_weight_kg && <p className="text-xs text-red-500">{errors.birth_weight_kg.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Place of Birth *</Label>
                  <Controller name="place_of_birth" control={control} render={({ field }) => (
                    <Select value={field.value} onValueChange={(v) => {
                      field.onChange(v)
                      setValue("health_facility_name", "", { shouldValidate: true })
                      setValue("home_address", "", { shouldValidate: true })
                      setValue("other_place_specified", "", { shouldValidate: true })
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HEALTH_FACILITY">Health Facility</SelectItem>
                        <SelectItem value="HOME">Home</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                {placeOfBirth === "HEALTH_FACILITY" && (
                  <div className="space-y-2">
                    <Label>Facility Name *</Label>
                    <Input {...register("health_facility_name")} className={cn(errors.health_facility_name && "border-red-500")} />
                    {errors.health_facility_name && <p className="text-xs text-red-500">{errors.health_facility_name.message}</p>}
                  </div>
                )}
                {placeOfBirth === "HOME" && (
                  <div className="space-y-2">
                    <Label>Home Address *</Label>
                    <Input {...register("home_address")} className={cn(errors.home_address && "border-red-500")} />
                    {errors.home_address && <p className="text-xs text-red-500">{errors.home_address.message}</p>}
                  </div>
                )}
                {placeOfBirth === "OTHER" && (
                  <div className="space-y-2">
                    <Label>Specify Place *</Label>
                    <Input {...register("other_place_specified")} className={cn(errors.other_place_specified && "border-red-500")} />
                    {errors.other_place_specified && <p className="text-xs text-red-500">{errors.other_place_specified.message}</p>}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notification Date & Time *</Label>
                <Input type="datetime-local" {...register("date_and_time_of_birth_notification")} 
                  value={watch("date_and_time_of_birth_notification")?.slice(0, 16) || ""}
                  onChange={(e) => setValue("date_and_time_of_birth_notification", new Date(e.target.value).toISOString(), { shouldValidate: true })} 
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Controller name="mother_din" control={control} render={({ field, fieldState }) => (
                  <DINLookupInput 
                  value={field.value} 
                  onChange={v => field.onChange(v)} 
                  onCitizenFound={setMotherCitizen}
                  onLookupError={(msg) => {
                    if (msg) setError('mother_din', { type: 'manual', message: msg })
                    else clearErrors('mother_din')
                  }}
                  label="Mother DIN *" 
                  error={fieldState.error?.message} />
                )} />
                <Controller name="father_din" control={control} render={({ field, fieldState }) => (
                  <DINLookupInput 
                  value={field.value ?? ""} 
                  onChange={v => field.onChange(v)} 
                  onCitizenFound={setFatherCitizen}
                  onLookupError={(msg) => {
                    if (msg) setError('father_din', { type: 'manual', message: msg })
                    else clearErrors('father_din')
                  }} 
                  label="Father DIN (Optional)"
                  error={fieldState.error?.message} 
                  />
                )} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/10">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mother's Tribal Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Village" {...register("mother_village_of_origin")} />
                    <Input placeholder="Chief" {...register("mother_chief")} />
                    <Input placeholder="District" {...register("mother_district")} />
                    <Input placeholder="Tribe" {...register("mother_tribe")} />
                  </div>
                  <Input placeholder="Usual Residence" {...register("mother_usual_place_of_residence")} />
                </div>
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/10">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Father's Tribal Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Village" {...register("father_village_of_origin")} />
                    <Input placeholder="Chief" {...register("father_chief")} />
                    <Input placeholder="District" {...register("father_district")} />
                    <Input placeholder="Tribe" {...register("father_tribe")} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Attendant at Birth *</Label>
                  <Controller name="attendant_at_birth" control={control} render={({ field, fieldState }) => (
                    <Select value={field.value} onValueChange={(v) => {
                      field.onChange(v)
                      setValue("attendant_other_specified", "", { shouldValidate: true })
                    }}>
                      <SelectTrigger className={cn(fieldState.error && "border-red-500")}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MIDWIFE">Qualified Midwife</SelectItem>
                        <SelectItem value="TBA">Traditional Birth Attendant</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                {attendantAtBirth === "OTHER" && (
                  <div className="space-y-2">
                    <Label>Specify Attendant *</Label>
                    <Input {...register("attendant_other_specified")} className={cn(errors.attendant_other_specified && "border-red-500")} />
                    {errors.attendant_other_specified && <p className="text-xs text-red-500">{errors.attendant_other_specified.message}</p>}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Marital Status *</Label>
                  <Controller name="marital_status" control={control} render={({ field, fieldState }) => (
                    <Select value={field.value} onValueChange={(v) => {
                      field.onChange(v)
                      setValue("father_acknowledgement_date", "", { shouldValidate: true })
                      setValue("mother_consent_date", "", { shouldValidate: true })
                    }}>
                      <SelectTrigger className={cn(fieldState.error && "border-red-500")}><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARRIED">Married</SelectItem>
                        <SelectItem value="NOT_MARRIED">Not Married</SelectItem>
                        <SelectItem value="DIVORCED">Divorced</SelectItem>
                        <SelectItem value="WIDOWED">Widowed</SelectItem>
                      </SelectContent>
                    </Select>
                  )} />
                </div>
                {maritalStatus === "NOT_MARRIED" && (
                  <>
                    <div className="space-y-2">
                      <Label>Father Acknowledgement Date *</Label>
                      <Input type="date" {...register("father_acknowledgement_date")} className={cn(errors.father_acknowledgement_date && "border-red-500")} />
                      {errors.father_acknowledgement_date && <p className="text-xs text-red-500">{errors.father_acknowledgement_date.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Mother Consent Date *</Label>
                      <Input type="date" {...register("mother_consent_date")} className={cn(errors.mother_consent_date && "border-red-500")} />
                      {errors.mother_consent_date && <p className="text-xs text-red-500">{errors.mother_consent_date.message}</p>}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input placeholder="File Number" {...register("file_number")} />
                <Input placeholder="Officer In Charge" {...register("officer_in_charge")} />
                <Input placeholder="Official Stamp Ref" {...register("official_stamp_ref")} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
              <p className="text-sm text-muted-foreground">Please review the details before submitting. You can go back to edit any section.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="p-3 rounded-lg bg-muted/30"><span className="font-medium">Child:</span> {watch("child_given_name")} {watch("child_surname")} ({watch("sex")})</div>
                <div className="p-3 rounded-lg bg-muted/30"><span className="font-medium">DOB:</span> {watch("date_of_birth")} | <span className="font-medium">Weight:</span> {watch("birth_weight_kg")} kg</div>
                <div className="p-3 rounded-lg bg-muted/30"><span className="font-medium">District:</span> {districts.find(d => d.id.toString() === watch("district"))?.name || watch("district")}</div>
                <div className="p-3 rounded-lg bg-muted/30"><span className="font-medium">Place:</span> {watch("place_of_birth").replace("_", " ")}</div>
                <div className="p-3 rounded-lg bg-muted/30"><span className="font-medium">Mother DIN:</span> {watch("mother_din") || "N/A"}</div>
                <div className="p-3 rounded-lg bg-muted/30"><span className="font-medium">Father DIN:</span> {watch("father_din") || "N/A"}</div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={prevStep} disabled={step === 1 || isSubmitting}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={nextStep}>
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {isSubmitting ? "Submitting..." : "Submit Birth Record"}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}