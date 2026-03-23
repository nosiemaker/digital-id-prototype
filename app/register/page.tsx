"use client"

import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, Check, User, Phone, Camera, Fingerprint, ClipboardCheck, ChevronRight, ChevronLeft } from "lucide-react"

const STEPS = [
  { id: 1, label: "Personal Details", icon: User },
  { id: 2, label: "Contact Info", icon: Phone },
  { id: 3, label: "Biometrics", icon: Fingerprint },
  { id: 4, label: "Review", icon: ClipboardCheck },
]

type FormData = {
  firstName: string
  lastName: string
  dob: string
  gender: string
  nrc: string
  province: string
  email: string
  phone: string
  address: string
  city: string
}

const provinces = ["Lusaka", "Copperbelt", "Central", "Eastern", "Northern", "Southern", "Western", "North-Western", "Luapula", "Muchinga"]

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [faceScanned, setFaceScanned] = useState(false)
  const [fingerprintScanned, setFingerprintScanned] = useState(false)
  const [form, setForm] = useState<FormData>({
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    nrc: "",
    province: "",
    email: "",
    phone: "",
    address: "",
    city: "",
  })

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleNext() {
    if (step < 4) setStep(step + 1)
  }

  function handleBack() {
    if (step > 1) setStep(step - 1)
  }

  function handleSubmit() {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      router.push("/id-created")
    }, 1500)
  }

  function scanFace() {
    setTimeout(() => setFaceScanned(true), 2000)
  }

  function scanFingerprint() {
    setTimeout(() => setFingerprintScanned(true), 2000)
  }

  const inputClass = "w-full rounded-lg border border-border bg-input px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
  const labelClass = "block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5"

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
              const Icon = s.icon
              const done = step > s.id
              const active = step === s.id
              return (
                <div key={s.id} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${done ? "bg-primary border-primary" : active ? "border-primary bg-primary/10" : "border-border bg-secondary"}`}>
                      {done ? <Check className="h-4 w-4 text-primary-foreground" /> : <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />}
                    </div>
                    <span className={`text-[10px] font-medium hidden sm:block ${active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 transition-colors ${step > s.id ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-4">Step {step} of {STEPS.length}</p>
        </div>

        {/* Step card */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xl">

          {/* Step 1: Personal Details */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Personal Details</h2>
              <p className="text-sm text-muted-foreground mb-6">Enter your official personal information as it appears on your NRC.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>First Name</label>
                  <input className={inputClass} placeholder="Mwamba" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Last Name</label>
                  <input className={inputClass} placeholder="Kalinda" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Date of Birth</label>
                  <input type="date" className={inputClass} value={form.dob} onChange={(e) => update("dob", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Gender</label>
                  <select className={inputClass} value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                    <option value="">Select gender</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>NRC Number</label>
                  <input className={inputClass} placeholder="123456/78/9" value={form.nrc} onChange={(e) => update("nrc", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Province</label>
                  <select className={inputClass} value={form.province} onChange={(e) => update("province", e.target.value)}>
                    <option value="">Select province</option>
                    {provinces.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Info */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Contact Information</h2>
              <p className="text-sm text-muted-foreground mb-6">Provide your current contact details for ID verification and notifications.</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input type="email" className={inputClass} placeholder="yourname@email.com" value={form.email} onChange={(e) => update("email", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input type="tel" className={inputClass} placeholder="+260 97 123 4567" value={form.phone} onChange={(e) => update("phone", e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Residential Address</label>
                  <input className={inputClass} placeholder="Plot 45, Cairo Road" value={form.address} onChange={(e) => update("address", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>City / Town</label>
                  <input className={inputClass} placeholder="Lusaka" value={form.city} onChange={(e) => update("city", e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Postal Code</label>
                  <input className={inputClass} placeholder="10101" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Biometrics */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Biometric Capture</h2>
              <p className="text-sm text-muted-foreground mb-6">We need to capture your face and fingerprint for identity verification.</p>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {/* Face */}
                <div className="rounded-xl border border-border bg-secondary/40 p-5 text-center">
                  <div className={`mx-auto mb-4 h-40 w-40 rounded-full border-2 ${faceScanned ? "border-primary bg-primary/10" : "border-dashed border-border bg-secondary"} flex items-center justify-center relative overflow-hidden`}>
                    {faceScanned ? (
                      <div className="flex flex-col items-center gap-2">
                        <Check className="h-10 w-10 text-primary" />
                        <span className="text-xs text-primary font-medium">Captured</span>
                      </div>
                    ) : (
                      <Camera className="h-10 w-10 text-muted-foreground" />
                    )}
                    {/* Scanning lines */}
                    {!faceScanned && (
                      <div className="absolute inset-0 flex flex-col justify-around opacity-20">
                        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-px bg-primary" />)}
                      </div>
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">Face Scan</h3>
                  <p className="text-xs text-muted-foreground mb-4">Look directly at the camera in a well-lit area.</p>
                  <button
                    onClick={scanFace}
                    disabled={faceScanned}
                    className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-all ${faceScanned ? "bg-primary/20 text-primary cursor-default" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                  >
                    {faceScanned ? "Face Captured" : "Start Face Scan"}
                  </button>
                </div>

                {/* Fingerprint */}
                <div className="rounded-xl border border-border bg-secondary/40 p-5 text-center">
                  <div className={`mx-auto mb-4 h-40 w-40 rounded-xl border-2 ${fingerprintScanned ? "border-primary bg-primary/10" : "border-dashed border-border bg-secondary"} flex items-center justify-center`}>
                    {fingerprintScanned ? (
                      <div className="flex flex-col items-center gap-2">
                        <Check className="h-10 w-10 text-primary" />
                        <span className="text-xs text-primary font-medium">Captured</span>
                      </div>
                    ) : (
                      <Fingerprint className="h-16 w-16 text-muted-foreground" />
                    )}
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-1">Fingerprint Scan</h3>
                  <p className="text-xs text-muted-foreground mb-4">Place your right index finger on the scanner.</p>
                  <button
                    onClick={scanFingerprint}
                    disabled={fingerprintScanned}
                    className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-all ${fingerprintScanned ? "bg-primary/20 text-primary cursor-default" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                  >
                    {fingerprintScanned ? "Fingerprint Captured" : "Scan Fingerprint"}
                  </button>
                </div>
              </div>
              {(faceScanned || fingerprintScanned) && !faceScanned || (faceScanned && !fingerprintScanned) ? (
                <p className="mt-4 text-xs text-center text-muted-foreground">Both biometrics are required to continue.</p>
              ) : null}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Review &amp; Submit</h2>
              <p className="text-sm text-muted-foreground mb-6">Please review your information before submitting your registration.</p>
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Personal Details</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Full Name</p><p className="text-foreground font-medium">{form.firstName || "Mwamba"} {form.lastName || "Kalinda"}</p></div>
                    <div><p className="text-xs text-muted-foreground">NRC Number</p><p className="text-foreground font-medium">{form.nrc || "123456/78/9"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Date of Birth</p><p className="text-foreground font-medium">{form.dob || "14 March 1990"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Province</p><p className="text-foreground font-medium">{form.province || "Lusaka"}</p></div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><p className="text-xs text-muted-foreground">Email</p><p className="text-foreground font-medium">{form.email || "mwamba@email.com"}</p></div>
                    <div><p className="text-xs text-muted-foreground">Phone</p><p className="text-foreground font-medium">{form.phone || "+260 97 123 4567"}</p></div>
                    <div className="col-span-2"><p className="text-xs text-muted-foreground">Address</p><p className="text-foreground font-medium">{form.address || "Plot 45, Cairo Road, Lusaka"}</p></div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-secondary/40 p-4">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Biometrics</h3>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /><span className="text-foreground">Face Scan</span></div>
                    <div className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /><span className="text-foreground">Fingerprint</span></div>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">By submitting, you agree to the terms of the Zambia Digital Identity Programme and consent to biometric data processing.</p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            {step < 4 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 000 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  "Submit Registration"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
