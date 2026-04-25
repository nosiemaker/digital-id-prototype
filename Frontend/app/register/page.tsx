"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import {
  Shield, Check, User, Phone, ClipboardCheck,
  ChevronRight, ChevronLeft, AlertCircle,
  Loader2, ImageIcon, X, Lock, Eye, EyeOff
} from "lucide-react"
import { useEnrollment } from "@/hooks/useEnrollment"
import { ImageUploadZone, handleImageUpload, emptyUpload, UploadState } from "@/components/ImageUploadZone"

// ─── Zod Schemas (per step) ──────────────────────────────────────────────────

const step1Schema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName:  z.string().min(1, "Last name is required."),
  dob:       z.string().min(1, "Date of birth is required."),
  gender:    z.string().min(1, "Please select a gender."),
  nrc:       z.string().min(1, "NRC number is required."),
  province:  z.string().min(1, "Please select a province."),
})

const step2Schema = z.object({
  nrcFrontUrl: z.string().url("Please upload a photo of the front of your NRC."),
  nrcBackUrl:  z.string().url("Please upload a photo of the back of your NRC."),
  faceUrl:     z.string().url("Please upload a face photo / selfie."),
})

const step3Schema = z.object({
  phone: z.string().min(1, "Phone number is required."),
})

const step4Schema = z.object({
  email:           z.string().min(1, "Email address is required.").email("Please enter a valid email address."),
  password:        z.string().min(8, "Password must be at least 8 characters.")
                     .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
                     .regex(/[0-9]/, "Password must contain at least one number."),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
})

// ─── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Personal Details", icon: User },
  { id: 2, label: "ID Documents",     icon: ImageIcon },
  { id: 3, label: "Contact Info",     icon: Phone },
  { id: 4, label: "Account Setup",    icon: Lock },
  { id: 5, label: "Review & Submit",  icon: ClipboardCheck },
]

const PROVINCES = [
  { label: "Central",       value: "CENTRAL" },
  { label: "Copperbelt",    value: "COPPERBELT" },
  { label: "Eastern",       value: "EASTERN" },
  { label: "Luapula",       value: "LUAPULA" },
  { label: "Lusaka",        value: "LUSAKA" },
  { label: "Muchinga",      value: "MUCHINGA" },
  { label: "Northern",      value: "NORTHERN" },
  { label: "North-Western", value: "NORTHWEST" },
  { label: "Southern",      value: "SOUTHERN" },
  { label: "Western",       value: "WESTERN" },
]

const LANGUAGES = [
  { label: "English", value: "en" },
  { label: "Bemba",   value: "bem" },
  { label: "Nyanja",  value: "nya" },
  { label: "Tonga",   value: "toi" },
  { label: "Lozi",    value: "loz" },
]

type FormData = {
  firstName: string; lastName: string; dob: string; gender: string
  nrc: string; province: string; phone: string; language: string
  nrcFrontUrl: string; nrcBackUrl: string; faceUrl: string
  email: string; password: string; confirmPassword: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter()
  const { ready, hasKey, enrolling, startEnrollment } = useEnrollment()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [form, setForm] = useState<FormData>({
    firstName: "", lastName: "", dob: "", gender: "", nrc: "", province: "",
    phone: "", language: "en", nrcFrontUrl: "", nrcBackUrl: "", faceUrl: "",
    email: "", password: "", confirmPassword: "",
  })

  const [nrcFront, setNrcFront] = useState<UploadState>(emptyUpload())
  const [nrcBack, setNrcBack] = useState<UploadState>(emptyUpload())
  const [face, setFace] = useState<UploadState>(emptyUpload())

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  const makeUploadHandler = (
    setter: React.Dispatch<React.SetStateAction<UploadState>>,
    formField: "nrcFrontUrl" | "nrcBackUrl" | "faceUrl"
  ) => async (file: File) => {
    const preview = URL.createObjectURL(file)
    setter((s) => ({ ...s, uploading: true, preview, error: null }))
    try {
      const folder = formField === "faceUrl" ? "zdid/faces" : "zdid/nrc"
      const url = await handleImageUpload(file, folder)
      setter((s) => ({ ...s, uploading: false, url }))
      update(formField, url)
    } catch (e: any) {
      setter((s) => ({ ...s, uploading: false, error: e?.message ?? "Upload failed." }))
    }
  }

  // ── Zod validation per step ────────────────────────────────────────────────

  function validateStep(): string | null {
    let result: z.SafeParseReturnType<any, any>
    if (step === 1) result = step1Schema.safeParse(form)
    else if (step === 2) result = step2Schema.safeParse(form)
    else if (step === 3) result = step3Schema.safeParse(form)
    else if (step === 4) result = step4Schema.safeParse(form)
    else return null

    if (!result!.success) {
      return result!.error.issues[0].message
    }
    return null
  }

  function handleNext() {
    const err = validateStep()
    if (err) { setError(err); return }
    if (step < STEPS.length) setStep(step + 1)
  }

  function handleBack() {
    setError(null)
    if (step > 1) setStep(step - 1)
  }

  async function handleSubmit() {
    setError(null)
    try {
      const result = await startEnrollment({
        nrc: form.nrc.trim(),
        full_name: `${form.firstName.trim()} ${form.lastName.trim()}`,
        dob: form.dob,
        phone: form.phone.trim(),
        language: form.language as any,
        nrc_front_url: form.nrcFrontUrl,
        nrc_back_url: form.nrcBackUrl,
        face_url: form.faceUrl,
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      router.push(`/admin/citizens`)
    } catch (e: any) {
      setError(e?.message ?? "Enrollment failed. Please try again.")
    }
  }

  const inputClass = "w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
  const labelClass = "block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5"

  const anyUploading = nrcFront.uploading || nrcBack.uploading || face.uploading

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-foreground">Zambia Digital ID</span>
              <span className="text-[10px] font-medium text-muted-foreground">Citizen Registration</span>
            </div>
          </Link>
          <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Already registered? Sign in</Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {/* Stepper */}
        <div className="mb-10">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => {
              const Icon = s.icon; const done = step > s.id; const active = step === s.id
              return (
                <div key={s.id} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${done ? "bg-primary border-primary" : active ? "border-primary bg-primary/10" : "border-border bg-secondary"}`}>
                      {done ? <Check className="h-4 w-4 text-primary-foreground" /> : <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />}
                    </div>
                    <span className={`text-[10px] font-medium hidden sm:block ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 transition-colors ${step > s.id ? "bg-primary" : "bg-border"}`} />}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">Step {step} of {STEPS.length}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">

          {/* Step 1: Personal Details */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Personal Details</h2>
              <p className="text-sm text-muted-foreground mb-6">Enter your legal information exactly as it appears on your NRC.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={labelClass}>First Name</label><input type="text" className={inputClass} placeholder="e.g. Chanda" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} /></div>
                <div><label className={labelClass}>Last Name</label><input type="text" className={inputClass} placeholder="e.g. Mwale" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} /></div>
                <div><label className={labelClass}>Date of Birth</label><input type="date" className={inputClass} value={form.dob} onChange={(e) => update("dob", e.target.value)} /></div>
                <div><label className={labelClass}>Gender</label><select className={inputClass} value={form.gender} onChange={(e) => update("gender", e.target.value)}><option value="">Select gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></div>
                <div><label className={labelClass}>NRC Number</label><input type="text" className={inputClass} placeholder="e.g. 123456/78/9" value={form.nrc} onChange={(e) => update("nrc", e.target.value)} /></div>
                <div><label className={labelClass}>Province</label><select className={inputClass} value={form.province} onChange={(e) => update("province", e.target.value)}><option value="">Select province</option>{PROVINCES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}</select></div>
              </div>
            </div>
          )}

          {/* Step 2: ID Documents + Face Photo */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">ID Documents</h2>
              <p className="text-sm text-muted-foreground mb-6">Upload clear photos of both sides of your NRC and a face photo / selfie.</p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <ImageUploadZone label="NRC — Front" hint="Ensure your name and photo are clearly visible" state={nrcFront} onChange={makeUploadHandler(setNrcFront, "nrcFrontUrl")} />
                <ImageUploadZone label="NRC — Back" hint="Ensure the serial number and barcode are visible" state={nrcBack} onChange={makeUploadHandler(setNrcBack, "nrcBackUrl")} />
              </div>
              <div className="mt-6">
                <ImageUploadZone label="Face Photo / Selfie" hint="Look directly at the camera with good lighting" state={face} onChange={makeUploadHandler(setFace, "faceUrl")} />
              </div>
              <div className="mt-5 rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-xs text-muted-foreground leading-relaxed"><span className="font-semibold text-foreground">Privacy note:</span> Your images are uploaded directly to our secure cloud storage and are only visible to authorized Registration Officers during verification.</p>
              </div>
            </div>
          )}

          {/* Step 3: Contact Info */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Contact Information</h2>
              <p className="text-sm text-muted-foreground mb-6">We'll use your phone number to send status updates about your enrollment.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className={labelClass}>Phone Number</label><input type="tel" className={inputClass} placeholder="+260 97 123 4567" value={form.phone} onChange={(e) => update("phone", e.target.value)} /></div>
                <div className="sm:col-span-2"><label className={labelClass}>Preferred Language</label><select className={inputClass} value={form.language} onChange={(e) => update("language", e.target.value)}>{LANGUAGES.map((l) => (<option key={l.value} value={l.value}>{l.label}</option>))}</select><p className="mt-1.5 text-xs text-muted-foreground">Notifications will be sent in this language where available.</p></div>
              </div>
            </div>
          )}

          {/* Step 4: Account Setup */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Account Setup</h2>
              <p className="text-sm text-muted-foreground mb-6">Create credentials for the ZDID citizen portal and mobile app.</p>
              <div className="grid grid-cols-1 gap-5">
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input type="email" className={inputClass} placeholder="e.g. chanda.mwale@example.com" autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
                  <p className="mt-1.5 text-xs text-muted-foreground">This will be your login username.</p>
                </div>
                <div>
                  <label className={labelClass}>Password</label>
                  <div className="relative">
                    <input type={showPassword ? "text" : "password"} className={`${inputClass} pr-10`} placeholder="Min. 8 chars, 1 uppercase, 1 number" autoComplete="new-password" value={form.password} onChange={(e) => update("password", e.target.value)} />
                    <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                  {form.password && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[{ label: "8+ chars", ok: form.password.length >= 8 }, { label: "Uppercase", ok: /[A-Z]/.test(form.password) }, { label: "Number", ok: /[0-9]/.test(form.password) }].map(({ label, ok }) => (
                        <span key={label} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${ok ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>{ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}{label}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirm ? "text" : "password"} className={`${inputClass} pr-10 ${form.confirmPassword && form.confirmPassword !== form.password ? "border-destructive focus:ring-destructive" : ""}`} placeholder="Re-enter your password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} />
                    <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>{showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
                  </div>
                  {form.confirmPassword && form.confirmPassword !== form.password && <p className="mt-1.5 text-xs text-destructive flex items-center gap-1"><X className="h-3 w-3" /> Passwords do not match</p>}
                  {form.confirmPassword && form.confirmPassword === form.password && <p className="mt-1.5 text-xs text-primary flex items-center gap-1"><Check className="h-3 w-3" /> Passwords match</p>}
                </div>
                <div className="rounded-xl border border-border bg-secondary/20 p-4">
                  <p className="text-xs text-muted-foreground leading-relaxed"><span className="font-semibold text-foreground">Security note:</span> Your password is hashed before storage and never transmitted in plaintext.</p>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Review & Submit */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Review &amp; Submit</h2>
              <p className="text-sm text-muted-foreground mb-6">Confirm your details before submitting.</p>
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Personal Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Full Name</p><p className="text-foreground font-medium">{form.firstName} {form.lastName}</p></div>
                    <div><p className="text-xs text-muted-foreground">NRC Number</p><p className="text-foreground font-medium">{form.nrc}</p></div>
                    <div><p className="text-xs text-muted-foreground">Date of Birth</p><p className="text-foreground font-medium">{form.dob}</p></div>
                    <div><p className="text-xs text-muted-foreground">Gender</p><p className="text-foreground font-medium capitalize">{form.gender.toLowerCase()}</p></div>
                    <div><p className="text-xs text-muted-foreground">Province</p><p className="text-foreground font-medium">{PROVINCES.find((p) => p.value === form.province)?.label ?? form.province}</p></div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">ID Documents</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[{ label: "NRC Front", preview: nrcFront.preview }, { label: "NRC Back", preview: nrcBack.preview }, { label: "Face Photo", preview: face.preview }].map(({ label, preview }) => (
                      <div key={label} className="flex flex-col gap-1">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        {preview ? <img src={preview} alt={label} className="rounded-lg max-h-20 object-cover border border-border" /> : <p className="text-sm text-destructive">Missing</p>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Contact</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-foreground font-medium">{form.phone}</p></div>
                    <div><p className="text-xs text-muted-foreground">Language</p><p className="text-foreground font-medium">{LANGUAGES.find((l) => l.value === form.language)?.label ?? form.language}</p></div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Account</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2"><p className="text-xs text-muted-foreground">Email</p><p className="text-foreground font-medium">{form.email}</p></div>
                    <div className="col-span-2"><p className="text-xs text-muted-foreground">Password</p><p className="text-foreground font-medium tracking-widest">{"•".repeat(Math.min(form.password.length, 12))}</p></div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">What happens next</h3>
                  <ol className="space-y-1.5 text-xs text-muted-foreground list-none">
                    {["Your enrollment request is submitted and a device key pair is generated.", "Visit a Registration Office — an officer will capture your biometrics in-person.", "Once approved, your DIN is issued and your digital ID becomes active."].map((text, i) => (
                      <li key={i} className="flex items-start gap-2"><span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-[9px]">{i + 1}</span>{text}</li>
                    ))}
                  </ol>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">By submitting, you agree to the terms of the Zambia Digital Identity Programme and consent to biometric data processing.</p>
            </div>
          )}

          {error && (
            <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button onClick={handleBack} disabled={step === 1} className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            {step < STEPS.length ? (
              <button onClick={handleNext} disabled={step === 2 && anyUploading} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed">
                {step === 2 && anyUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <>Next <ChevronRight className="h-4 w-4" /></>}
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={!!enrolling || !ready} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed">
                {enrolling ? <><Loader2 className="h-4 w-4 animate-spin" />{hasKey ? "Submitting…" : "Generating key…"}</> : "Submit Enrollment"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}