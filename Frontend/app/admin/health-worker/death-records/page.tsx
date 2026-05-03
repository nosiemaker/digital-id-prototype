"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Skull, Check, ArrowLeft, ArrowRight, Loader2, Stethoscope,
} from "lucide-react"
import { ICD11SearchInput } from "@/components/icd11-search-input"
import { DINLookupInput } from "@/components/din-lookup-input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
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

export default function DeathRecordsPage() {
  useRoleGuard(["HEALTH_WORKER", "REGISTRAR"])
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [informantCitizen, setInformantCitizen] = useState<CitizenLookupResult | null>(null)

  const [form, setForm] = useState({
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
  })

  function validateStep(current: number) {
    const e: Record<string, string> = {}
    if (current === 1) {
      if (!form.attended_name) e.attended_name = "Deceased name is required"
      if (!form.illness_start_date) e.illness_start_date = "Illness start date is required"
      if (!form.death_date) e.death_date = "Date of death is required"
    }
    if (current === 2) {
      if (!form.cause_a) e.cause_a = "Primary cause (A) is required"
      if (!form.cause_a_icd_code) e.cause_a_icd_code = "ICD-11 code for (A) is required"
    }
    if (current === 3) {
      if (!form.medical_attendant_name) e.medical_attendant_name = "Attendant name is required"
      if (!form.medical_attendant_qualification) e.medical_attendant_qualification = "Qualification is required"
      if (!form.informant_din) e.informant_din = "Informant DIN is required"
      if (!form.informant_relationship) e.informant_relationship = "Relationship is required"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const nextStep = () => { if (validateStep(step)) { setErrors({}); setStep(s => Math.min(s + 1, 4)) } }
  const prevStep = () => { setErrors({}); setStep(s => Math.max(s - 1, 1)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep(3)) return
    setSubmitting(true)
    try {
      const deathDateObj = form.death_date ? new Date(form.death_date) : null
      const derivedDeathDay = deathDateObj ? deathDateObj.getDate() : null
      const derivedDeathYear = deathDateObj ? parseInt(deathDateObj.getFullYear().toString().slice(-2)) : null
      const clean = (val: string | undefined) => val?.trim() ? val.trim() : undefined

      const payload = {
        attended_name: form.attended_name,
        illness_start_date: form.illness_start_date,
        last_attended_alive_date: clean(form.last_attended_alive_date),
        death_date: form.death_date,
        death_day: derivedDeathDay,
        death_year: derivedDeathYear,
        death_time: clean(form.death_time),
        body_identified_of: clean(form.body_identified_of) || "Unknown",
        age_stated: clean(form.age_stated) || "0",
        postmortem_confirmed: form.postmortem_confirmed,
        cause_a: form.cause_a,
        cause_a_interval: clean(form.cause_a_interval),
        cause_a_icd_code: form.cause_a_icd_code,
        cause_b: clean(form.cause_b),
        cause_b_interval: clean(form.cause_b_interval),
        cause_b_icd_code: clean(form.cause_b_icd_code),
        cause_c: clean(form.cause_c),
        cause_c_interval: clean(form.cause_c_interval),
        cause_c_icd_code: clean(form.cause_c_icd_code),
        other_condition_1: clean(form.other_condition_1),
        other_condition_1_interval: clean(form.other_condition_1_interval),
        other_condition_2: clean(form.other_condition_2),
        other_condition_2_interval: clean(form.other_condition_2_interval),
        witness_date: new Date().toISOString().split("T")[0],
        certificate_handed_to: "Informant",
        medical_attendant_name: form.medical_attendant_name,
        medical_attendant_qualification: form.medical_attendant_qualification,
        medical_attendant_residence: form.medical_attendant_residence || "Not specified",
        village: clean(form.village),
        chief: clean(form.chief),
        district: clean(form.district),
        informant_din: form.informant_din,
        informant_relationship: form.informant_relationship,
        informant_contact_no: clean(form.informant_contact_no) || informantCitizen?.phone,
        informant_postal_address: clean(form.informant_postal_address) || informantCitizen?.residential_address,
      }

      await deathRecordApi.submit(payload as any)
      toast.success("MCCD submitted successfully. Informant must now attach the Notice of Death.")
      router.push('/admin/health-worker/dashboard')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.detail || "Submission failed")
    } finally {
      setSubmitting(false)
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
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deceased Full Name *</Label>
                  <Input value={form.attended_name} onChange={e => setForm({ ...form, attended_name: e.target.value })} className={cn(errors.attended_name && "border-red-500")} />
                  {errors.attended_name && <p className="text-xs text-red-500">{errors.attended_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Age Stated</Label>
                  <Input placeholder="e.g., 45 years" value={form.age_stated} onChange={e => setForm({ ...form, age_stated: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Illness Start Date *</Label>
                  <Input type="date" value={form.illness_start_date} onChange={e => setForm({ ...form, illness_start_date: e.target.value })} className={cn(errors.illness_start_date && "border-red-500")} />
                  {errors.illness_start_date && <p className="text-xs text-red-500">{errors.illness_start_date}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Last Attended Alive</Label>
                  <Input type="date" value={form.last_attended_alive_date} onChange={e => setForm({ ...form, last_attended_alive_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Body Identified By</Label>
                  <Input value={form.body_identified_of} onChange={e => setForm({ ...form, body_identified_of: e.target.value })} placeholder="Leave blank if unknown" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date of Death *</Label>
                  <Input type="date" value={form.death_date} onChange={e => setForm({ ...form, death_date: e.target.value })} className={cn(errors.death_date && "border-red-500")} />
                  {errors.death_date && <p className="text-xs text-red-500">{errors.death_date}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Time of Death</Label>
                  <Input type="time" value={form.death_time} onChange={e => setForm({ ...form, death_time: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="postmortem" checked={form.postmortem_confirmed} onChange={e => setForm({ ...form, postmortem_confirmed: e.target.checked })} className="h-4 w-4 rounded border-border text-primary" />
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
                        <ICD11SearchInput 
                          instanceId="cause-a" 
                          value={form.cause_a_icd_code} 
                          label={form.cause_a}
                          onSelect={(code, title) => setForm({ ...form, cause_a_icd_code: code, cause_a: title })}
                          onClear={() => setForm({ ...form, cause_a_icd_code: "", cause_a: "" })}
                          placeholder="Search immediate cause…" 
                          error={errors.cause_a || errors.cause_a_icd_code} 
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5 block">Interval (A)</Label>
                        <Input 
                          placeholder="e.g. 5 days" 
                          className="h-12 bg-white"
                          value={form.cause_a_interval} 
                          onChange={e => setForm({ ...form, cause_a_interval: e.target.value })} 
                        />
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
                        <ICD11SearchInput 
                          instanceId="cause-b" 
                          value={form.cause_b_icd_code} 
                          label={form.cause_b}
                          onSelect={(code, title) => setForm({ ...form, cause_b_icd_code: code, cause_b: title })}
                          onClear={() => setForm({ ...form, cause_b_icd_code: "", cause_b: "" })}
                          placeholder="Search antecedent cause…" 
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5 block">Interval (B)</Label>
                        <Input 
                          placeholder="e.g. 2 years" 
                          className="h-12 bg-white"
                          value={form.cause_b_interval} 
                          onChange={e => setForm({ ...form, cause_b_interval: e.target.value })} 
                        />
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
                        <ICD11SearchInput 
                          instanceId="cause-c" 
                          value={form.cause_c_icd_code} 
                          label={form.cause_c}
                          onSelect={(code, title) => setForm({ ...form, cause_c_icd_code: code, cause_c: title })}
                          onClear={() => setForm({ ...form, cause_c_icd_code: "", cause_c: "" })}
                          placeholder="Search underlying cause…" 
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5 block">Interval (C)</Label>
                        <Input 
                          placeholder="e.g. 10 years" 
                          className="h-12 bg-white"
                          value={form.cause_c_interval} 
                          onChange={e => setForm({ ...form, cause_c_interval: e.target.value })} 
                        />
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
                    <Input placeholder="Contributing condition…" className="bg-white" value={form.other_condition_1} onChange={e => setForm({ ...form, other_condition_1: e.target.value })} />
                    <Input placeholder="Duration…" className="bg-white text-xs" value={form.other_condition_1_interval} onChange={e => setForm({ ...form, other_condition_1_interval: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Condition 2</Label>
                    <Input placeholder="Additional condition…" className="bg-white" value={form.other_condition_2} onChange={e => setForm({ ...form, other_condition_2: e.target.value })} />
                    <Input placeholder="Duration…" className="bg-white text-xs" value={form.other_condition_2_interval} onChange={e => setForm({ ...form, other_condition_2_interval: e.target.value })} />
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
                  <Input value={form.medical_attendant_name} onChange={e => setForm({ ...form, medical_attendant_name: e.target.value })} className={cn(errors.medical_attendant_name && "border-red-500")} />
                  {errors.medical_attendant_name && <p className="text-xs text-red-500">{errors.medical_attendant_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Qualification *</Label>
                  <Input value={form.medical_attendant_qualification} onChange={e => setForm({ ...form, medical_attendant_qualification: e.target.value })} className={cn(errors.medical_attendant_qualification && "border-red-500")} />
                  {errors.medical_attendant_qualification && <p className="text-xs text-red-500">{errors.medical_attendant_qualification}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Residence / Facility</Label>
                  <Input value={form.medical_attendant_residence} onChange={e => setForm({ ...form, medical_attendant_residence: e.target.value })} />
                </div>
              </div>

              <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2 pt-4">Informant Details</h3>
              <DINLookupInput value={form.informant_din} onChange={din => setForm({ ...form, informant_din: din })} onCitizenFound={setInformantCitizen} label="Informant DIN *" error={errors.informant_din} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Relationship to Deceased *</Label>
                  <Input value={form.informant_relationship} onChange={e => setForm({ ...form, informant_relationship: e.target.value })} className={cn(errors.informant_relationship && "border-red-500")} />
                  {errors.informant_relationship && <p className="text-xs text-red-500">{errors.informant_relationship}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Contact Number</Label>
                  <Input value={form.informant_contact_no || informantCitizen?.phone || ""} onChange={e => setForm({ ...form, informant_contact_no: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Postal Address</Label>
                <Input value={form.informant_postal_address || informantCitizen?.residential_address || ""} onChange={e => setForm({ ...form, informant_postal_address: e.target.value })} />
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
                <div><span className="text-muted-foreground">Deceased:</span> <span className="ml-2">{form.attended_name}</span></div>
                <div><span className="text-muted-foreground">Death Date:</span> <span className="ml-2">{form.death_date ? new Date(form.death_date).toLocaleDateString() : "-"}</span></div>
                <div><span className="text-muted-foreground">Primary Cause:</span> <span className="ml-2">{form.cause_a || "-"}</span></div>
                <div><span className="text-muted-foreground">ICD-11 (A):</span> <span className="font-mono ml-2">{form.cause_a_icd_code || "-"}</span></div>
                <div><span className="text-muted-foreground">Attendant:</span> <span className="ml-2">{form.medical_attendant_name}</span></div>
                <div><span className="text-muted-foreground">Informant DIN:</span> <span className="font-mono ml-2">{form.informant_din}</span></div>
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
              <Button type="submit" onClick={handleSubmit} className="bg-primary hover:bg-primary/90" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Skull className="h-4 w-4 mr-2" />}
                {submitting ? "Submitting..." : "Submit MCCD"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}