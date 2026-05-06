"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller, SubmitHandler } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Skull, Check, ArrowLeft, ArrowRight, Loader2, Stethoscope,
} from "lucide-react"
import { ICD11SearchInput } from "@/components/icd11-search-input"
import { DINLookupInput } from "@/components/din-lookup-input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { deathRecordApi } from "@/lib/axios"
import { useRoleGuard } from "@/hooks/use-role-guard"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { CitizenLookupResult } from "@/utils/types"

const steps = [
  { id: 1, label: "Deceased & Timeline" },
  { id: 2, label: "ICD-11 Causes" },
  { id: 3, label: "Attendant & Informant" },
  { id: 4, label: "Review & Submit" },
]

// 🔹 Zod Schema
const deathRecordSchema = z.object({
  citizen_din: z.string().min(1, "Deceased DIN is required"),
  hospital_name: z.string().min(1, "Hospital name is required"),
  attended_name: z.string().min(1, "Deceased name is required"),
  illness_start_date: z.string().min(1, "Illness start date is required"),
  last_attended_alive_date: z.string().optional(),
  death_date: z.string().min(1, "Date of death is required"),
  death_time: z.string().optional(),
  body_identified_of: z.string().optional(),
  age_stated: z.string().optional(),
  postmortem_confirmed: z.boolean().default(false),
  cause_a: z.string().min(1, "Primary cause (A) is required"),
  cause_a_interval: z.string().optional(),
  cause_a_icd_code: z.string().min(1, "ICD-11 code for (A) is required"),
  cause_b: z.string().optional(),
  cause_b_interval: z.string().optional(),
  cause_b_icd_code: z.string().optional(),
  cause_c: z.string().optional(),
  cause_c_interval: z.string().optional(),
  cause_c_icd_code: z.string().optional(),
  other_condition_1: z.string().optional(),
  other_condition_1_interval: z.string().optional(),
  other_condition_2: z.string().optional(),
  other_condition_2_interval: z.string().optional(),
  medical_attendant_name: z.string().min(1, "Attendant name is required"),
  medical_attendant_qualification: z.string().min(1, "Qualification is required"),
  medical_attendant_residence: z.string().optional(),
  informant_din: z.string().min(1, "Informant DIN is required"),
  informant_relationship: z.string().min(1, "Relationship is required"),
  informant_contact_no: z.string().optional(),
  informant_postal_address: z.string().optional(),
  village: z.string().optional(),
  chief: z.string().optional(),
  district: z.string().optional(),
})

type DeathRecordForm = z.infer<typeof deathRecordSchema>

// 🔹 Fields to validate per step
const stepFields: Record<number, (keyof DeathRecordForm)[]> = {
  1: ["citizen_din", "hospital_name", "attended_name", "illness_start_date", "death_date"],
  2: ["cause_a", "cause_a_icd_code"],
  3: ["medical_attendant_name", "medical_attendant_qualification", "informant_din", "informant_relationship"],
}

export default function DeathRecordsPage() {
  useRoleGuard(["HEALTH_WORKER", "REGISTRAR"])
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [informantCitizen, setInformantCitizen] = useState<CitizenLookupResult | null>(null)

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
  } = useForm<DeathRecordForm>({
    resolver: zodResolver(deathRecordSchema),
    defaultValues: {
      citizen_din: "",
      hospital_name: "",
      attended_name: "",
      illness_start_date: "",
      last_attended_alive_date: "",
      death_date: "",
      death_time: "",
      body_identified_of: "",
      age_stated: "",
      postmortem_confirmed: false,
      cause_a: "", cause_a_interval: "", cause_a_icd_code: "",
      cause_b: "", cause_b_interval: "", cause_b_icd_code: "",
      cause_c: "", cause_c_interval: "", cause_c_icd_code: "",
      other_condition_1: "", other_condition_1_interval: "",
      other_condition_2: "", other_condition_2_interval: "",
      medical_attendant_name: "",
      medical_attendant_qualification: "",
      medical_attendant_residence: "",
      informant_din: "",
      informant_relationship: "",
      informant_contact_no: "",
      informant_postal_address: "",
      village: "", chief: "", district: "",
    },
    mode: "onChange",
  })

  // 🔹 Step navigation with scoped validation
  const nextStep = async () => {
    const isValid = await trigger(stepFields[step])
    if (isValid) setStep(s => Math.min(s + 1, 4))
  }
  const prevStep = () => setStep(s => Math.max(s - 1, 1))

  // 🔹 Submission handler
  const onSubmit: SubmitHandler<DeathRecordForm> = async (data) => {
    try {
      const deathDateObj = data.death_date ? new Date(data.death_date) : null
      const derivedDeathDay = deathDateObj ? deathDateObj.getDate() : null
      const derivedDeathYear = deathDateObj ? parseInt(deathDateObj.getFullYear().toString().slice(-2)) : null
      
      const clean = (val: string | undefined) => val?.trim() ? val.trim() : undefined

      const payload = {
        citizen_din: data.citizen_din,
        hospital_name: data.hospital_name,
        attended_name: data.attended_name,
        illness_start_date: data.illness_start_date,
        last_attended_alive_date: clean(data.last_attended_alive_date),
        death_date: data.death_date,
        death_day: derivedDeathDay,
        death_year: derivedDeathYear,
        death_time: clean(data.death_time),
        body_identified_of: clean(data.body_identified_of) || "Unknown",
        age_stated: clean(data.age_stated) || "0",
        postmortem_confirmed: data.postmortem_confirmed,
        cause_a: data.cause_a,
        cause_a_interval: clean(data.cause_a_interval),
        cause_a_icd_code: data.cause_a_icd_code,
        cause_b: clean(data.cause_b),
        cause_b_interval: clean(data.cause_b_interval),
        cause_b_icd_code: clean(data.cause_b_icd_code),
        cause_c: clean(data.cause_c),
        cause_c_interval: clean(data.cause_c_interval),
        cause_c_icd_code: clean(data.cause_c_icd_code),
        other_condition_1: clean(data.other_condition_1),
        other_condition_1_interval: clean(data.other_condition_1_interval),
        other_condition_2: clean(data.other_condition_2),
        other_condition_2_interval: clean(data.other_condition_2_interval),
        witness_date: new Date().toISOString().split("T")[0],
        certificate_handed_to: "Informant",
        medical_attendant_name: data.medical_attendant_name,
        medical_attendant_qualification: data.medical_attendant_qualification,
        medical_attendant_residence: clean(data.medical_attendant_residence) || "Not specified",
        village: clean(data.village),
        chief: clean(data.chief),
        district: clean(data.district),
        informant_din: data.informant_din,
        informant_relationship: data.informant_relationship,
        informant_contact_no: clean(data.informant_contact_no) || informantCitizen?.phone,
        informant_postal_address: clean(data.informant_postal_address) || informantCitizen?.residential_address,
      }

      await deathRecordApi.submit(payload)
      toast.success("MCCD submitted successfully. Informant must now attach the Notice of Death.")
      router.push('/admin/health-worker/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.detail || "Submission failed")
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Stethoscope className="h-6 w-6 text-primary" /> Register MCCD
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Capture clinical cause of death. Medical reference numbers & timestamps are auto-generated.</p>
        </div>
      </div>

      {/* Stepper */}
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

      {/* Form Card */}
      <div className="rounded-xl border border-border bg-card">
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-6 space-y-6">
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Controller name="citizen_din" control={control} render={({ field, fieldState }) => (
                    <DINLookupInput
                      value={field.value}
                      onChange={field.onChange}
                      onLookupError={(msg) => {
                        if (msg) setError('citizen_din', { type: 'manual', message: msg })
                        else clearErrors('citizen_din')
                      }}
                      label="Deceased DIN *"
                      error={fieldState.error?.message}
                    />
                  )} />
                </div>
                <div className="space-y-2">
                  <Label>Hospital Name *</Label>
                  <Input {...register("hospital_name")} placeholder="e.g., Central Hospital" className={cn(errors.hospital_name && "border-red-500")} />
                  {errors.hospital_name && <p className="text-xs text-red-500">{errors.hospital_name.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name of Deceased *</Label>
                  <Input {...register("attended_name")} className={cn(errors.attended_name && "border-red-500")} />
                  {errors.attended_name && <p className="text-xs text-red-500">{errors.attended_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Age Stated</Label>
                  <Input placeholder="e.g., 45 years" {...register("age_stated")} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Illness Start Date *</Label>
                  <Input type="date" {...register("illness_start_date")} className={cn(errors.illness_start_date && "border-red-500")} />
                  {errors.illness_start_date && <p className="text-xs text-red-500">{errors.illness_start_date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Last Attended Alive</Label>
                  <Input type="date" {...register("last_attended_alive_date")} />
                </div>
                <div className="space-y-2">
                  <Label>Body Identified By</Label>
                  <Input {...register("body_identified_of")} placeholder="Leave blank if unknown" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Death *</Label>
                  <Input type="date" {...register("death_date")} className={cn(errors.death_date && "border-red-500")} />
                  {errors.death_date && <p className="text-xs text-red-500">{errors.death_date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Time of Death</Label>
                  <Input type="time" {...register("death_time")} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="postmortem" {...register("postmortem_confirmed")} className="h-4 w-4 rounded border-border text-primary" />
                <Label htmlFor="postmortem" className="text-sm cursor-pointer">Post-mortem examination confirmed</Label>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Stethoscope className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-700 leading-none">ICD-11 Cause of Death</p>
                  <p className="text-[11px] text-blue-600/70 mt-1 uppercase tracking-wider font-medium">Pathological sequence of events</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Cause A */}
                <div className="p-5 rounded-2xl border border-blue-500/20 bg-blue-500/[0.02] relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded bg-blue-500 text-white flex items-center justify-center text-[10px] font-black shadow-sm">A</span>
                      <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Primary / Immediate Cause</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      <div className="md:col-span-8">
                        <Controller name="cause_a_icd_code" control={control} render={({ field, fieldState }) => (
                          <ICD11SearchInput
                            instanceId="cause-a"
                            value={field.value}
                            label={watch("cause_a")}
                            onSelect={(code, title) => {
                              setValue("cause_a_icd_code", code, { shouldValidate: true })
                              setValue("cause_a", title, { shouldValidate: true })
                            }}
                            onClear={() => {
                              setValue("cause_a_icd_code", "", { shouldValidate: true })
                              setValue("cause_a", "", { shouldValidate: true })
                            }}
                            placeholder="Search immediate cause…"
                            error={fieldState.error?.message || errors.cause_a?.message}
                          />
                        )} />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5 block">Interval (A)</Label>
                        <Input placeholder="e.g. 5 days" className="h-12 bg-white" {...register("cause_a_interval")} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cause B */}
                <div className="p-5 rounded-2xl border border-border bg-slate-50/50 relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300" />
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded bg-slate-400 text-white flex items-center justify-center text-[10px] font-black shadow-sm">B</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Intermediate Cause</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      <div className="md:col-span-8">
                        <Controller name="cause_b_icd_code" control={control} render={({ field }) => (
                          <ICD11SearchInput
                            instanceId="cause-b"
                            value={field.value}
                            label={watch("cause_b")}
                            onSelect={(code, title) => {
                              setValue("cause_b_icd_code", code, { shouldValidate: true })
                              setValue("cause_b", title, { shouldValidate: true })
                            }}
                            onClear={() => {
                              setValue("cause_b_icd_code", "", { shouldValidate: true })
                              setValue("cause_b", "", { shouldValidate: true })
                            }}
                            placeholder="Search antecedent cause…"
                          />
                        )} />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5 block">Interval (B)</Label>
                        <Input placeholder="e.g. 2 years" className="h-12 bg-white" {...register("cause_b_interval")} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cause C */}
                <div className="p-5 rounded-2xl border border-border bg-slate-50/30 relative overflow-hidden group">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200" />
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <span className="h-5 w-5 rounded bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-black shadow-sm border border-slate-300">C</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Underlying Cause</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                      <div className="md:col-span-8">
                        <Controller name="cause_c_icd_code" control={control} render={({ field }) => (
                          <ICD11SearchInput
                            instanceId="cause-c"
                            value={field.value}
                            label={watch("cause_c")}
                            onSelect={(code, title) => {
                              setValue("cause_c_icd_code", code, { shouldValidate: true })
                              setValue("cause_c", title, { shouldValidate: true })
                            }}
                            onClear={() => {
                              setValue("cause_c_icd_code", "", { shouldValidate: true })
                              setValue("cause_c", "", { shouldValidate: true })
                            }}
                            placeholder="Search underlying cause…"
                          />
                        )} />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5 block">Interval (C)</Label>
                        <Input placeholder="e.g. 10 years" className="h-12 bg-white" {...register("cause_c_interval")} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-dashed border-border space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-1 bg-slate-300 rounded-full" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Other Significant Conditions</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 p-4 rounded-xl bg-slate-50/30 border border-slate-100">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Condition 1</Label>
                    <Input placeholder="Contributing condition…" className="bg-white" {...register("other_condition_1")} />
                    <Input placeholder="Duration…" className="bg-white text-xs" {...register("other_condition_1_interval")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Condition 2</Label>
                    <Input placeholder="Additional condition…" className="bg-white" {...register("other_condition_2")} />
                    <Input placeholder="Duration…" className="bg-white text-xs" {...register("other_condition_2_interval")} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">Medical Attendant</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input {...register("medical_attendant_name")} className={cn(errors.medical_attendant_name && "border-red-500")} />
                  {errors.medical_attendant_name && <p className="text-xs text-red-500">{errors.medical_attendant_name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Qualification *</Label>
                  <Input {...register("medical_attendant_qualification")} className={cn(errors.medical_attendant_qualification && "border-red-500")} />
                  {errors.medical_attendant_qualification && <p className="text-xs text-red-500">{errors.medical_attendant_qualification.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Residence / Facility</Label>
                  <Input {...register("medical_attendant_residence")} />
                </div>
              </div>

              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 pt-4">Informant Details</h3>
              <Controller name="informant_din" control={control} render={({ field, fieldState }) => (
                  <DINLookupInput
                    value={field.value}
                    onChange={field.onChange}
                    onCitizenFound={setInformantCitizen} 
                    onLookupError={(msg) => {
                      if (msg) setError('informant_din', { type: 'manual', message: msg })
                      else clearErrors('informant_din')
                    }}
                    label="Informant DIN *" 
                    error={fieldState.error?.message}
                  />
              )} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Relationship to Deceased *</Label>
                  <Input {...register("informant_relationship")} className={cn(errors.informant_relationship && "border-red-500")} />
                  {errors.informant_relationship && <p className="text-xs text-red-500">{errors.informant_relationship.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input value={watch("informant_contact_no") || informantCitizen?.phone || ""} onChange={e => setValue("informant_contact_no", e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Postal Address</Label>
                <Input value={watch("informant_postal_address") || informantCitizen?.residential_address || ""} onChange={e => setValue("informant_postal_address", e.target.value)} />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
                <p className="text-sm font-medium text-blue-700">Review & Submit MCCD</p>
                <p className="text-xs text-blue-600/80">Verify clinical details. Medical reference numbers, witness dates, and day/year derivations are handled automatically.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Deceased:</span> <span className="ml-2">{watch("attended_name")}</span></div>
                <div><span className="text-muted-foreground">Death Date:</span> <span className="ml-2">{watch("death_date") ? new Date(watch("death_date")).toLocaleDateString() : "-"}</span></div>
                <div><span className="text-muted-foreground">Primary Cause:</span> <span className="ml-2">{watch("cause_a") || "-"}</span></div>
                <div><span className="text-muted-foreground">ICD-11 (A):</span> <span className="font-mono ml-2">{watch("cause_a_icd_code") || "-"}</span></div>
                <div><span className="text-muted-foreground">Attendant:</span> <span className="ml-2">{watch("medical_attendant_name")}</span></div>
                <div><span className="text-muted-foreground">Informant DIN:</span> <span className="font-mono ml-2">{watch("informant_din")}</span></div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Medical Declaration</p>
                <p className="text-xs text-muted-foreground">I certify that I attended the deceased during their last illness and that the cause of death stated is accurate to the best of my medical knowledge.</p>
                <div className="flex items-start gap-2 pt-2">
                  <div className="flex h-4 w-4 items-center justify-center rounded border border-primary bg-primary/20"><Check className="h-3 w-3 text-primary" /></div>
                  <p className="text-xs text-foreground">I confirm all details are accurate and ready for submission.</p>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer nav */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 rounded-b-xl">
          <div className="flex w-full justify-between">
            <Button type="button" variant="outline" onClick={step === 1 ? () => router.back() : prevStep}>
              {step === 1 ? "Cancel" : <><ArrowLeft className="h-4 w-4 mr-2" /> Back</>}
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={nextStep} className="bg-primary hover:bg-primary/90">
                Next <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="submit" onClick={handleSubmit(onSubmit)} className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Skull className="h-4 w-4 mr-2" />}
                {isSubmitting ? "Submitting..." : "Submit MCCD"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}