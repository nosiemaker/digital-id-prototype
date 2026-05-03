"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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

function generateSubmissionRef() {
  const ts = Date.now().toString(36).toUpperCase()
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `BR-SUB-${ts}-${rnd}`
}

export default function BirthRecordsPage() {
  useRoleGuard(["HEALTH_WORKER", "REGISTRAR"])
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [motherCitizen, setMotherCitizen] = useState<CitizenLookupResult | null>(null)
  const [fatherCitizen, setFatherCitizen] = useState<CitizenLookupResult | null>(null)

  const [form, setForm] = useState({
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
  })

  function validateStep(current: number): boolean {
    const e: Record<string, string> = {}
    if (current === 1) {
      if (!form.child_surname) e.child_surname = "Surname is required"
      if (!form.child_given_name) e.child_given_name = "Given name is required"
      if (!form.date_of_birth) e.date_of_birth = "Date of birth is required"
      if (!form.birth_weight_kg) e.birth_weight_kg = "Weight is required"
      if (!form.district) e.district = "District is required"
      if (form.place_of_birth === "HEALTH_FACILITY" && !form.health_facility_name) e.health_facility_name = "Facility name is required"
      if (form.place_of_birth === "HOME" && !form.home_address) e.home_address = "Home address is required"
    }
    if (current === 2) {
      if (!form.mother_din) e.mother_din = "Mother DIN is required"
    }
    if (current === 3) {
      if (!form.attendant_at_birth) e.attendant_at_birth = "Attendant is required"
      if (form.attendant_at_birth === "OTHER" && !form.attendant_other_specified) e.attendant_other_specified = "Please specify"
      if (!form.marital_status) e.marital_status = "Marital status is required"
      if (form.marital_status === "NOT_MARRIED") {
        if (!form.father_acknowledgement_date) e.father_acknowledgement_date = "Acknowledgement date required"
        if (!form.mother_consent_date) e.mother_consent_date = "Consent date required"
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  useEffect(() => {
    const fetchDistricts = async () => {
      setLoadingDistricts(true)
      try {
        const districtsData = await referenceApi.getDistricts()
        setDistricts(districtsData)
      } catch (err) {
        toast.error("Failed to load districts")
      } finally {
        setLoadingDistricts(false)
      }
    }
    fetchDistricts()
  }, [])

  const nextStep = () => { if (validateStep(step)) { setErrors({}); setStep(s => Math.min(s + 1, 4)) } }
  const prevStep = () => { setErrors({}); setStep(s => Math.max(s - 1, 1)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep(3)) return
    setSubmitting(true)
    try {
      const payload = {
        mother_din: form.mother_din,
        father_din: form.father_din || undefined,
        district: form.district,
        date_and_time_of_birth_notification: form.date_and_time_of_birth_notification,
        date_of_birth: form.date_of_birth,
        place_of_birth: form.place_of_birth as any,
        health_facility_name: form.place_of_birth === "HEALTH_FACILITY" ? form.health_facility_name : undefined,
        home_address: form.place_of_birth === "HOME" ? form.home_address : undefined,
        other_place_specified: form.place_of_birth === "OTHER" ? form.other_place_specified : undefined,
        child_surname: form.child_surname,
        child_given_name: form.child_given_name,
        child_other_names: form.child_other_names || undefined,
        sex: form.sex as any,
        birth_weight_kg: parseFloat(form.birth_weight_kg),
        mother_village_of_origin: form.mother_village_of_origin || undefined,
        mother_chief: form.mother_chief || undefined,
        mother_district: form.mother_district || undefined,
        mother_tribe: form.mother_tribe || undefined,
        mother_usual_place_of_residence: form.mother_usual_place_of_residence || undefined,
        father_village_of_origin: form.father_village_of_origin || undefined,
        father_chief: form.father_chief || undefined,
        father_district: form.father_district || undefined,
        father_tribe: form.father_tribe || undefined,
        attendant_at_birth: form.attendant_at_birth as any,
        attendant_other_specified: form.attendant_at_birth === "OTHER" ? form.attendant_other_specified : undefined,
        marital_status: form.marital_status as any,
        father_acknowledgement_date: form.marital_status === "NOT_MARRIED" ? form.father_acknowledgement_date : undefined,
        mother_consent_date: form.marital_status === "NOT_MARRIED" ? form.mother_consent_date : undefined,
        file_number: form.file_number || undefined,
        place_of_birth_text: form.place_of_birth_text || undefined,
        time_of_birth: form.time_of_birth || undefined,
        officer_in_charge: form.officer_in_charge || undefined,
        official_stamp_ref: form.official_stamp_ref || undefined,
        date_signed: form.date_signed || undefined,
      }

      await birthRecordApi.submit(payload as any)
      toast.success("Birth record submitted. Awaiting Registrar review.")
      router.push('/admin/health-worker')
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
            <Baby className="h-6 w-6 text-primary" /> Register Birth
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Complete the multi-step form. Serial numbers are auto-generated by the system.</p>
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
                  <Label>Submission Reference</Label>
                  <Input value={form.submission_ref} disabled className="bg-muted/30" />
                  <p className="text-xs text-muted-foreground">Auto-generated for tracking. System assigns official serials on submit.</p>
                </div>
                <div className="space-y-2">
                  <Label>District *</Label>
                  <Select value={form.district} onValueChange={(value) => setForm({ ...form, district: value })}>
                    <SelectTrigger className={cn(errors.district && "border-red-500")}>
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {loadingDistricts ? (
                        <SelectItem value="loading" disabled>Loading districts...</SelectItem>
                      ) : districts.length > 0 ? (
                        districts.map((d) => (
                          <SelectItem key={d.id} value={d.id.toString()}>
                            {d.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-districts" disabled>No districts available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {errors.district && <p className="text-xs text-red-500">{errors.district}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Child Surname *</Label>
                  <Input value={form.child_surname} onChange={e => setForm({ ...form, child_surname: e.target.value })} className={cn(errors.child_surname && "border-red-500")} />
                  {errors.child_surname && <p className="text-xs text-red-500">{errors.child_surname}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Given Name *</Label>
                  <Input value={form.child_given_name} onChange={e => setForm({ ...form, child_given_name: e.target.value })} className={cn(errors.child_given_name && "border-red-500")} />
                  {errors.child_given_name && <p className="text-xs text-red-500">{errors.child_given_name}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Other Names</Label>
                  <Input value={form.child_other_names} onChange={e => setForm({ ...form, child_other_names: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Sex *</Label>
                  <Select value={form.sex} onValueChange={v => setForm({ ...form, sex: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent><SelectItem value="MALE">Male</SelectItem><SelectItem value="FEMALE">Female</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date of Birth *</Label>
                  <Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} className={cn(errors.date_of_birth && "border-red-500")} />
                  {errors.date_of_birth && <p className="text-xs text-red-500">{errors.date_of_birth}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Birth Weight (kg) *</Label>
                  <Input type="number" step="0.1" value={form.birth_weight_kg} onChange={e => setForm({ ...form, birth_weight_kg: e.target.value })} className={cn(errors.birth_weight_kg && "border-red-500")} />
                  {errors.birth_weight_kg && <p className="text-xs text-red-500">{errors.birth_weight_kg}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Place of Birth *</Label>
                  <Select value={form.place_of_birth} onValueChange={v => setForm({ ...form, place_of_birth: v, health_facility_name: "", home_address: "", other_place_specified: "" })}>
                    <SelectTrigger className={cn(errors.place_of_birth && "border-red-500")}><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HEALTH_FACILITY">Health Facility</SelectItem>
                      <SelectItem value="HOME">Home</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.place_of_birth === "HEALTH_FACILITY" && (
                  <div className="space-y-2">
                    <Label>Facility Name *</Label>
                    <Input value={form.health_facility_name} onChange={e => setForm({ ...form, health_facility_name: e.target.value })} className={cn(errors.health_facility_name && "border-red-500")} />
                    {errors.health_facility_name && <p className="text-xs text-red-500">{errors.health_facility_name}</p>}
                  </div>
                )}
                {form.place_of_birth === "HOME" && (
                  <div className="space-y-2">
                    <Label>Home Address *</Label>
                    <Input value={form.home_address} onChange={e => setForm({ ...form, home_address: e.target.value })} className={cn(errors.home_address && "border-red-500")} />
                    {errors.home_address && <p className="text-xs text-red-500">{errors.home_address}</p>}
                  </div>
                )}
                {form.place_of_birth === "OTHER" && (
                  <div className="space-y-2">
                    <Label>Specify Place *</Label>
                    <Input value={form.other_place_specified} onChange={e => setForm({ ...form, other_place_specified: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Notification Date & Time *</Label>
                <Input type="datetime-local" value={form.date_and_time_of_birth_notification.slice(0, 16)} onChange={e => setForm({ ...form, date_and_time_of_birth_notification: new Date(e.target.value).toISOString() })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DINLookupInput value={form.mother_din} onChange={din => setForm({ ...form, mother_din: din })} onCitizenFound={setMotherCitizen} label="Mother DIN *" error={errors.mother_din} />
                <DINLookupInput value={form.father_din} onChange={din => setForm({ ...form, father_din: din })} onCitizenFound={setFatherCitizen} label="Father DIN (Optional)" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/10">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mother's Tribal Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Village" value={form.mother_village_of_origin} onChange={e => setForm({ ...form, mother_village_of_origin: e.target.value })} />
                    <Input placeholder="Chief" value={form.mother_chief} onChange={e => setForm({ ...form, mother_chief: e.target.value })} />
                    <Input placeholder="District" value={form.mother_district} onChange={e => setForm({ ...form, mother_district: e.target.value })} />
                    <Input placeholder="Tribe" value={form.mother_tribe} onChange={e => setForm({ ...form, mother_tribe: e.target.value })} />
                  </div>
                  <Input placeholder="Usual Residence" value={form.mother_usual_place_of_residence} onChange={e => setForm({ ...form, mother_usual_place_of_residence: e.target.value })} />
                </div>
                <div className="space-y-3 p-4 rounded-lg border border-border bg-muted/10">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Father's Tribal Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Village" value={form.father_village_of_origin} onChange={e => setForm({ ...form, father_village_of_origin: e.target.value })} />
                    <Input placeholder="Chief" value={form.father_chief} onChange={e => setForm({ ...form, father_chief: e.target.value })} />
                    <Input placeholder="District" value={form.father_district} onChange={e => setForm({ ...form, father_district: e.target.value })} />
                    <Input placeholder="Tribe" value={form.father_tribe} onChange={e => setForm({ ...form, father_tribe: e.target.value })} />
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
                  <Select value={form.attendant_at_birth} onValueChange={v => setForm({ ...form, attendant_at_birth: v, attendant_other_specified: "" })}>
                    <SelectTrigger className={cn(errors.attendant_at_birth && "border-red-500")}><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MIDWIFE">Qualified Midwife</SelectItem>
                      <SelectItem value="TBA">Traditional Birth Attendant</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.attendant_at_birth === "OTHER" && (
                  <div className="space-y-2">
                    <Label>Specify Attendant *</Label>
                    <Input value={form.attendant_other_specified} onChange={e => setForm({ ...form, attendant_other_specified: e.target.value })} className={cn(errors.attendant_other_specified && "border-red-500")} />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Marital Status *</Label>
                <Select value={form.marital_status} onValueChange={v => setForm({ ...form, marital_status: v })}>
                  <SelectTrigger className={cn(errors.marital_status && "border-red-500")}><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="MARRIED">Married</SelectItem><SelectItem value="NOT_MARRIED">Not Married</SelectItem></SelectContent>
                </Select>
              </div>
              {form.marital_status === "NOT_MARRIED" && (
                <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20 space-y-3">
                  <p className="text-xs text-yellow-600 font-medium">⚠️ Paternity acknowledgement & mother consent required.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Father Ack. Date *</Label>
                      <Input type="date" value={form.father_acknowledgement_date} onChange={e => setForm({ ...form, father_acknowledgement_date: e.target.value })} className={cn(errors.father_acknowledgement_date && "border-red-500")} />
                    </div>
                    <div className="space-y-2">
                      <Label>Mother Consent Date *</Label>
                      <Input type="date" value={form.mother_consent_date} onChange={e => setForm({ ...form, mother_consent_date: e.target.value })} className={cn(errors.mother_consent_date && "border-red-500")} />
                    </div>
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-border space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">M.F.2 Facility Sign-off (Optional)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input placeholder="File / Case No." value={form.file_number} onChange={e => setForm({ ...form, file_number: e.target.value })} />
                  <Input placeholder="Officer In Charge" value={form.officer_in_charge} onChange={e => setForm({ ...form, officer_in_charge: e.target.value })} />
                  <Input type="date" placeholder="Date Signed" value={form.date_signed} onChange={e => setForm({ ...form, date_signed: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
              <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
                <p className="text-sm font-medium text-blue-700">Review & Submit</p>
                <p className="text-xs text-blue-600/80">Verify all details. Submission creates a PENDING birth record for Registrar review.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Ref:</span> <span className="font-mono ml-2">{form.submission_ref}</span></div>
                <div><span className="text-muted-foreground">Child:</span> <span className="ml-2">{form.child_given_name} {form.child_surname}</span></div>
                <div><span className="text-muted-foreground">DOB:</span> <span className="ml-2">{form.date_of_birth ? new Date(form.date_of_birth).toLocaleDateString() : "-"}</span></div>
                <div><span className="text-muted-foreground">Weight:</span> <span className="ml-2">{form.birth_weight_kg} kg</span></div>
                <div><span className="text-muted-foreground">Mother DIN:</span> <span className="font-mono ml-2">{form.mother_din}</span></div>
                <div><span className="text-muted-foreground">Father DIN:</span> <span className="font-mono ml-2">{form.father_din || "—"}</span></div>
              </div>
              <div className="p-4 rounded-lg border border-border bg-muted/20 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Declaration</p>
                <p className="text-xs text-muted-foreground">I declare that the information provided is true and correct. False statements may result in rejection.</p>
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
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Baby className="h-4 w-4 mr-2" />}
                {submitting ? "Submitting..." : "Submit Birth Record"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}