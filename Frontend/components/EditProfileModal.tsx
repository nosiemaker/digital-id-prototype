"use client"
import { useState, useEffect } from "react"
import { X, Loader2 } from "lucide-react"
import type { CitizenUpdate, Language, ProvinceOption, DistrictOption } from "@/utils/types"

interface EditProfileModalProps {
  open: boolean
  onClose: () => void
  currentData: {
    full_name: string
    email: string
    phone: string
    residential_address: string
    language: string
    district_id?: number
    province_id?: number
  }
  onSave: (updates: CitizenUpdate) => Promise<void>
  isSaving?: boolean
  provinces?: ProvinceOption[]
  districts?: DistrictOption[]
}

export function EditProfileModal({
  open,
  onClose,
  currentData,
  onSave,
  isSaving = false,
  provinces = [],
  districts = [],
}: EditProfileModalProps) {
  const [form, setForm] = useState(currentData)
  const [filteredDistricts, setFilteredDistricts] = useState<DistrictOption[]>([])

  // Sync form when modal opens or data changes
  useEffect(() => {
    if (open) setForm(currentData)
  }, [open, currentData])

  // Filter districts when province changes
  useEffect(() => {
    if (form.province_id) {
      setFilteredDistricts(districts.filter(d => d.province_code === provinces.find(p => p.id === form.province_id)?.code))
      // Reset district if it doesn't belong to new province
      if (!filteredDistricts.some(d => d.id === form.district_id)) {
        setForm(prev => ({ ...prev, district_id: undefined }))
      }
    } else {
      setFilteredDistricts([])
    }
  }, [form.province_id, districts, provinces])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const updates: CitizenUpdate = {
      email: form.email || undefined,
      phone: form.phone || undefined,
      residential_address: form.residential_address || undefined,
      language: form.language as Language,
      district_id: form.district_id || undefined,
    }
    await onSave(updates)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Edit Profile</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Read-Only Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Full Name</label>
            <input
              type="text"
              value={form.full_name}
              disabled
              className="w-full px-3 py-2.5 rounded-lg bg-secondary/50 border border-border text-muted-foreground cursor-not-allowed text-sm"
            />
            <p className="text-[10px] text-muted-foreground">Name changes require official verification. Contact support.</p>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
              placeholder="you@example.com"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
              placeholder="097XXXXXXX"
            />
          </div>

          {/* Province & District */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Province</label>
              <select
                value={form.province_id || ""}
                onChange={e => setForm(prev => ({ ...prev, province_id: Number(e.target.value) || undefined }))}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
              >
                <option value="">Select Province</option>
                {provinces.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">District</label>
              <select
                value={form.district_id || ""}
                onChange={e => setForm(prev => ({ ...prev, district_id: Number(e.target.value) || undefined }))}
                disabled={!form.province_id}
                className="w-full px-3 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select District</option>
                {filteredDistricts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Residential Address</label>
            <textarea
              value={form.residential_address}
              onChange={e => setForm(prev => ({ ...prev, residential_address: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm resize-none"
              placeholder="Plot 123, Street Name, Area"
            />
          </div>

          {/* Language */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Preferred Language</label>
            <select
              value={form.language}
              onChange={e => setForm(prev => ({ ...prev, language: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
            >
              <option value="en">English</option>
              <option value="bem">Bemba</option>
              <option value="nya">Nyanja</option>
              <option value="toi">Tonga</option>
              <option value="loz">Lozi</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}