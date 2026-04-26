"use client"

/**
 * /register/identity
 *
 * Identity submission flow for citizens who already have an account and
 * verified their email. Reached via the wallet enrollment banner CTA.
 *
 * Steps (account setup step is intentionally omitted — user is logged in):
 *   1  Personal Details  (name, DOB, gender, NRC, province)
 *   2  ID Documents      (NRC front, NRC back, face photo)
 *   3  Contact Info      (phone, language)
 *   4  Review & Submit
 *
 * On success → POST /enrollments/submit-identity → router.push("/wallet")
 *
 * Guards (run once on mount via useEffect):
 *   • No access token   → redirect /login
 *   • citizen_din set   → redirect /wallet (already enrolled)
 */

import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import {
  Shield, Check, User, Phone, ClipboardCheck,
  ChevronRight, ChevronLeft, AlertCircle,
  Loader2, ImageIcon, ArrowLeft,
} from "lucide-react"
import { ImageUploadZone, handleImageUpload, emptyUpload, UploadState } from "@/components/ImageUploadZone"
import { tokenStore, enrollmentApi, authApi } from "@/lib/axios"

// ─── Schemas ──────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Personal Details", icon: User },
  { id: 2, label: "ID Documents",     icon: ImageIcon },
  { id: 3, label: "Contact Info",     icon: Phone },
  { id: 4, label: "Review & Submit",  icon: ClipboardCheck },
]

const PROVINCES = [
  { label: "Central",       value: "CENTRAL"    },
  { label: "Copperbelt",    value: "COPPERBELT"  },
  { label: "Eastern",       value: "EASTERN"     },
  { label: "Luapula",       value: "LUAPULA"     },
  { label: "Lusaka",        value: "LUSAKA"      },
  { label: "Muchinga",      value: "MUCHINGA"    },
  { label: "Northern",      value: "NORTHERN"    },
  { label: "North-Western", value: "NORTHWEST"   },
  { label: "Southern",      value: "SOUTHERN"    },
  { label: "Western",       value: "WESTERN"     },
]

const LANGUAGES = [
  { label: "English", value: "en"  },
  { label: "Bemba",   value: "bem" },
  { label: "Nyanja",  value: "nya" },
  { label: "Tonga",   value: "toi" },
  { label: "Lozi",    value: "loz" },
]

type FormData = {
  firstName: string; lastName: string; dob: string; gender: string
  nrc: string; province: string; phone: string; language: string
  nrcFrontUrl: string; nrcBackUrl: string; faceUrl: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function IdentityRegistrationPage() {
  const router = useRouter()

  const [step, setStep]           = useState(1)
  const [guardDone, setGuardDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const [form, setForm] = useState<FormData>({
    firstName: "", lastName: "", dob: "", gender: "", nrc: "", province: "",
    phone: "", language: "en",
    nrcFrontUrl: "", nrcBackUrl: "", faceUrl: "",
  })
  const [nrcFront, setNrcFront] = useState<UploadState>(emptyUpload())
  const [nrcBack,  setNrcBack]  = useState<UploadState>(emptyUpload())
  const [face,     setFace]     = useState<UploadState>(emptyUpload())

  // Guard: must be logged in and not already enrolled
  useEffect(() => {
    if (!tokenStore.getAccess()) { router.replace("/login"); return }
    authApi.me()
      .then(me => {
        if (me.citizen_din) router.replace("/wallet")
        else setGuardDone(true)
      })
      .catch(() => setGuardDone(true))
  }, [])

  function update(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const makeUploadHandler = (
    setter: React.Dispatch<React.SetStateAction<UploadState>>,
    field: "nrcFrontUrl" | "nrcBackUrl" | "faceUrl"
  ) => async (file: File) => {
    const preview = URL.createObjectURL(file)
    setter(s => ({ ...s, uploading: true, preview, error: null }))
    try {
      const folder = field === "faceUrl" ? "zdid/faces" : "zdid/nrc"
      const url    = await handleImageUpload(file, folder)
      setter(s => ({ ...s, uploading: false, url }))
      update(field, url)
    } catch (e: any) {
      setter(s => ({ ...s, uploading: false, error: e?.message ?? "Upload failed." }))
    }
  }

  function validateStep(): string | null {
    const schemas: Record<number, z.ZodTypeAny> = { 1: step1Schema, 2: step2Schema, 3: step3Schema }
    if (!schemas[step]) return null
    const result = schemas[step].safeParse(form)
    return result.success ? null : result.error.issues[0].message
  }

  function handleNext() {
    const err = validateStep()
    if (err) { setError(err); return }
    setStep(s => Math.min(s + 1, 4))
  }

  function handleBack() {
    setError(null)
    setStep(s => Math.max(s - 1, 1))
  }

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      const kp  = await window.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]
      )
      const spki = await window.crypto.subtle.exportKey("spki", kp.publicKey)
      const b64  = btoa(String.fromCharCode(...new Uint8Array(spki)))
      const pem  = `-----BEGIN PUBLIC KEY-----\n${b64}\n-----END PUBLIC KEY-----`

      await enrollmentApi.submitIdentity({
        nrc:            form.nrc.trim(),
        full_name:      `${form.firstName.trim()} ${form.lastName.trim()}`,
        dob:            form.dob,
        phone:          form.phone.trim(),
        gender:         form.gender as any,
        province:       form.province as any,
        language:       form.language as any,
        public_key:     pem,
        nrc_front_url:  form.nrcFrontUrl,
        nrc_back_url:   form.nrcBackUrl,
        face_image_url: form.faceUrl,
      })
      router.push("/wallet")
    } catch (e: any) {
      setError(e?.detail ?? e?.message ?? "Submission failed. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const input = "w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
  const label = "block text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1.5"
  const anyUploading = nrcFront.uploading || nrcBack.uploading || face.uploading

  if (!guardDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background font-sans">

      {/* Header */}
      <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-foreground">Zambia Digital ID</span>
              <span className="text-[10px] font-medium text-muted-foreground">Identity Registration</span>
            </div>
          </Link>
          <Link href="/wallet" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to wallet
          </Link>
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

          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Personal Details</h2>
              <p className="text-sm text-muted-foreground mb-6">Enter your legal information exactly as it appears on your NRC.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div><label className={label}>First Name</label><input type="text" className={input} placeholder="e.g. Chanda" value={form.firstName} onChange={e => update("firstName", e.target.value)} /></div>
                <div><label className={label}>Last Name</label><input type="text" className={input} placeholder="e.g. Mwale" value={form.lastName} onChange={e => update("lastName", e.target.value)} /></div>
                <div><label className={label}>Date of Birth</label><input type="date" className={input} value={form.dob} onChange={e => update("dob", e.target.value)} /></div>
                <div><label className={label}>Gender</label><select className={input} value={form.gender} onChange={e => update("gender", e.target.value)}><option value="">Select gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></div>
                <div><label className={label}>NRC Number</label><input type="text" className={input} placeholder="e.g. 123456/78/9" value={form.nrc} onChange={e => update("nrc", e.target.value)} /></div>
                <div><label className={label}>Province</label><select className={input} value={form.province} onChange={e => update("province", e.target.value)}><option value="">Select province</option>{PROVINCES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">ID Documents</h2>
              <p className="text-sm text-muted-foreground mb-6">Upload clear photos of both sides of your NRC and a face photo / selfie.</p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <ImageUploadZone label="NRC — Front" hint="Ensure your name and photo are clearly visible" state={nrcFront} onChange={makeUploadHandler(setNrcFront, "nrcFrontUrl")} />
                <ImageUploadZone label="NRC — Back"  hint="Ensure the serial number and barcode are visible" state={nrcBack} onChange={makeUploadHandler(setNrcBack, "nrcBackUrl")} />
              </div>
              <div className="mt-6">
                <ImageUploadZone label="Face Photo / Selfie" hint="Look directly at the camera with good lighting" state={face} onChange={makeUploadHandler(setFace, "faceUrl")} />
              </div>
              <div className="mt-5 rounded-xl border border-border bg-secondary/30 p-4">
                <p className="text-xs text-muted-foreground leading-relaxed"><span className="font-semibold text-foreground">Privacy note:</span> Your images are uploaded to secure cloud storage and are only visible to authorised Registration Officers.</p>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Contact Information</h2>
              <p className="text-sm text-muted-foreground mb-6">We'll use your phone number to send status updates about your enrollment.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><label className={label}>Phone Number</label><input type="tel" className={input} placeholder="+260 97 123 4567" value={form.phone} onChange={e => update("phone", e.target.value)} /></div>
                <div className="sm:col-span-2"><label className={label}>Preferred Language</label><select className={input} value={form.language} onChange={e => update("language", e.target.value)}>{LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</select><p className="mt-1.5 text-xs text-muted-foreground">Notifications will be sent in this language where available.</p></div>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Review &amp; Submit</h2>
              <p className="text-sm text-muted-foreground mb-6">Confirm your details before submitting your enrollment request.</p>
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Personal Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Full Name</p><p className="text-foreground font-medium">{form.firstName} {form.lastName}</p></div>
                    <div><p className="text-xs text-muted-foreground">NRC Number</p><p className="text-foreground font-medium">{form.nrc}</p></div>
                    <div><p className="text-xs text-muted-foreground">Date of Birth</p><p className="text-foreground font-medium">{form.dob}</p></div>
                    <div><p className="text-xs text-muted-foreground">Gender</p><p className="text-foreground font-medium capitalize">{form.gender.toLowerCase()}</p></div>
                    <div><p className="text-xs text-muted-foreground">Province</p><p className="text-foreground font-medium">{PROVINCES.find(p => p.value === form.province)?.label ?? form.province}</p></div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">ID Documents</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {[{ label: "NRC Front", preview: nrcFront.preview }, { label: "NRC Back", preview: nrcBack.preview }, { label: "Face Photo", preview: face.preview }].map(({ label: l, preview }) => (
                      <div key={l} className="flex flex-col gap-1">
                        <p className="text-xs text-muted-foreground">{l}</p>
                        {preview ? <img src={preview} alt={l} className="rounded-lg max-h-20 object-cover border border-border" /> : <p className="text-sm text-destructive">Missing</p>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Contact</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-foreground font-medium">{form.phone}</p></div>
                    <div><p className="text-xs text-muted-foreground">Language</p><p className="text-foreground font-medium">{LANGUAGES.find(l => l.value === form.language)?.label ?? form.language}</p></div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">What happens next</h3>
                  <ol className="space-y-1.5 text-xs text-muted-foreground list-none">
                    {["Your enrollment request is submitted and a device key pair is generated.", "Visit a Registration Office — an officer will capture your biometrics in person.", "Once approved, your DIN is issued and your Digital ID becomes active."].map((text, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-bold text-[9px]">{i + 1}</span>
                        {text}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">By submitting, you agree to the terms of the Zambia Digital Identity Programme and consent to biometric data processing.</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-5 flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button onClick={handleBack} disabled={step === 1} className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            {step < 4 ? (
              <button onClick={handleNext} disabled={step === 2 && anyUploading} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed">
                {step === 2 && anyUploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</> : <>Next <ChevronRight className="h-4 w-4" /></>}
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</> : "Submit Enrollment"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
