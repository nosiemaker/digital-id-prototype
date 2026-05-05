"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2, UserPlus, AlertCircle, Copy, CheckCircle2 } from "lucide-react"
import { enrollmentApi, referenceApi, type ROCitizenRegistrationRequest, type ROCitizenRegistrationResponse, type ProvinceOption, type DistrictOption } from "@/lib/axios"

// Import Image Upload components
import { 
  ImageUploadZone, 
  handleImageUpload, 
  type UploadState, 
  emptyUpload 
} from "@/components/ImageUploadZone"

interface AddCitizenModalProps {
  open: boolean
  onClose: () => void
  onCitizenAdded: () => void
}

export function AddCitizenModal({ open, onClose, onCitizenAdded }: AddCitizenModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [provinces, setProvinces] = useState<ProvinceOption[]>([])
  const [districts, setDistricts] = useState<DistrictOption[]>([])
  const [filteredDistricts, setFilteredDistricts] = useState<DistrictOption[]>([])
  const [selectedProvinceId, setSelectedProvinceId] = useState<number>(0)
  const [credentials, setCredentials] = useState<ROCitizenRegistrationResponse | null>(null)

  // Image Upload States
  const [nrcFrontState, setNrcFrontState] = useState<UploadState>(emptyUpload())
  const [nrcBackState, setNrcBackState] = useState<UploadState>(emptyUpload())
  const [faceState, setFaceState] = useState<UploadState>(emptyUpload())

  const [form, setForm] = useState<Partial<ROCitizenRegistrationRequest>>({
    nrc: "", full_name: "", dob: "", gender: "MALE", district_id: 0,
    phone: "", residential_address: "", language: "en",
    nrc_front_url: "", nrc_back_url: "", face_image_url: ""
  })

  // Load reference data
  useEffect(() => {
    if (open) {
      Promise.all([referenceApi.getProvinces(), referenceApi.getDistricts()])
        .then(([provs, dists]) => {
          setProvinces(provs)
          setDistricts(dists)
        })
        .catch(console.error)
    }
  }, [open])

  useEffect(() => {
    if (selectedProvinceId === 0) {
      setFilteredDistricts(districts)
    } else {
      const province = provinces.find(p => p.id === selectedProvinceId)
      if (province) {
        setFilteredDistricts(districts.filter(d => d.province_code === province.code))
      }
    }
  }, [selectedProvinceId, districts, provinces])

  // Upload Handlers
  const handleFileUpload = useCallback(
    (setState: React.Dispatch<React.SetStateAction<UploadState>>, setUrl: (url: string) => void, folder: string) => 
    async (file: File) => {
      const preview = URL.createObjectURL(file)
      setState({ ...emptyUpload(), preview, uploading: true })
      
      try {
        const url = await handleImageUpload(file, folder)
        setUrl(url)
        setState(prev => ({ ...prev, uploading: false, url, error: null }))
      } catch (err: any) {
        setState(prev => ({ ...prev, uploading: false, error: err.message || "Upload failed" }))
        toast.error("Image upload failed. Please try again.")
      }
    }, []
  )

  const uploadNrcFront = handleFileUpload(setNrcFrontState, (url) => setForm(p => ({ ...p, nrc_front_url: url })), "zdid/nrc/front")
  const uploadNrcBack = handleFileUpload(setNrcBackState, (url) => setForm(p => ({ ...p, nrc_back_url: url })), "zdid/nrc/back")
  const uploadFace = handleFileUpload(setFaceState, (url) => setForm(p => ({ ...p, face_image_url: url })), "zdid/face")

  const handleChange = (field: keyof ROCitizenRegistrationRequest, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const isImagesReady = nrcFrontState.url && nrcBackState.url && faceState.url

  const handleNext = () => {
    if (!form.nrc?.trim() || !form.full_name?.trim()) {
      setError("NRC and Full Name are required")
      return
    }
    setError(null)
    setStep(2)
  }

  const handleSubmit = async () => {
    if (!form.dob || !form.gender || !form.district_id) {
      setError("Please complete all required fields.")
      return
    }
    
    // Enforce image uploads
    if (!isImagesReady) {
      setError("Please upload NRC Front, NRC Back, and Face Image.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const result = await enrollmentApi.roRegisterCitizen({
        ...form as ROCitizenRegistrationRequest,
        nrc: form.nrc?.toUpperCase() || "",
        district_id: Number(form.district_id)
      })
      
      setCredentials(result)
      onCitizenAdded()
      toast.success("Citizen registered successfully")
    } catch (err: any) {
      setError(err.detail || err.message || "Registration failed")
      toast.error("Failed to register citizen")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setForm({
      nrc: "", full_name: "", dob: "", gender: "MALE", district_id: 0,
      phone: "", residential_address: "", language: "en",
      nrc_front_url: "", nrc_back_url: "", face_image_url: ""
    })
    setSelectedProvinceId(0)
    setError(null)
    setCredentials(null)
    setNrcFrontState(emptyUpload())
    setNrcBackState(emptyUpload())
    setFaceState(emptyUpload())
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {credentials ? "Registration Complete" : step === 1 ? "Step 1: Citizen Details" : "Step 2: Documents & Capture"}
          </DialogTitle>
          <DialogDescription>
            {credentials 
              ? "Provide these credentials to the citizen. They must change the password on first login." 
              : "RO-assisted enrollment. Capture images and enter citizen details."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {credentials ? (
          <div className="space-y-4 py-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary">Generated Credentials</span>
                <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">One-Time View</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Username</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={credentials.username} readOnly className="font-mono bg-background" />
                    <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(credentials.username)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Temporary Password</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={credentials.default_password} readOnly className="font-mono bg-background" />
                    <Button size="icon" variant="ghost" onClick={() => navigator.clipboard.writeText(credentials.default_password)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                <CheckCircle2 className="h-4 w-4" /> Citizen must change password on first login.
              </div>
            </div>
          </div>
        ) : step === 1 ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nrc">NRC Number *</Label>
              <Input id="nrc" placeholder="XXX/XXXXXX/X" value={form.nrc} onChange={(e) => handleChange("nrc", e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input id="full_name" value={form.full_name} onChange={(e) => handleChange("full_name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input id="phone" placeholder="+260..." value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">Email & password will be auto-generated by the system.</p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Identity & Location */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth *</Label>
                  <Input id="dob" type="date" value={form.dob} onChange={(e) => handleChange("dob", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Gender *</Label>
                  <Select value={form.gender} onValueChange={(v) => handleChange("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Province *</Label>
                  <Select value={String(selectedProvinceId)} onValueChange={(v) => {
                    setSelectedProvinceId(Number(v))
                    // Reset district when province changes
                    setForm(p => ({...p, district_id: 0}))
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                    <SelectContent>
                      {provinces.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>District *</Label>
                  <Select 
                    value={String(form.district_id)} 
                    onValueChange={(v) => handleChange("district_id", Number(v))}
                    disabled={!selectedProvinceId}
                  >
                    <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                    <SelectContent>
                      {filteredDistricts.map((d) => <SelectItem key={d.id} value={d.id.toString()}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* Image Upload Zones */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUploadZone
                label="NRC Front"
                hint="Capture front of NRC"
                state={nrcFrontState}
                onChange={uploadNrcFront}
              />
              <ImageUploadZone
                label="NRC Back"
                hint="Capture back of NRC"
                state={nrcBackState}
                onChange={uploadNrcBack}
              />
              <div className="md:col-span-2">
                <ImageUploadZone
                  label="Face Capture"
                  hint="Take a photo of the citizen"
                  state={faceState}
                  onChange={uploadFace}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={credentials ? () => { resetForm(); onClose(); } : resetForm}>
            {credentials ? "Close" : "Cancel"}
          </Button>
          
          {!credentials && step === 1 && <Button onClick={handleNext}>Next Step</Button>}
          {!credentials && step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button 
                onClick={handleSubmit} 
                disabled={loading || !isImagesReady}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Register Citizen
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}