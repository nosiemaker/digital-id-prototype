"use client"

import { useState, useEffect } from "react"
import { X, User, Phone, Globe, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { authApi } from "@/lib/axios"

interface EditProfileModalProps {
  open: boolean
  onClose: () => void
  currentData: {
    name: string
    phone?: string
    language?: string
  }
  onSuccess: (newData: any) => void
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "bem", name: "Bemba" },
  { code: "nya", name: "Nyanja" },
  { code: "toi", name: "Tonga" },
  { code: "loz", name: "Lozi" },
]

export function EditProfileModal({ open, onClose, currentData, onSuccess }: EditProfileModalProps) {
  const [name, setName] = useState(currentData.name)
  const [phone, setPhone] = useState(currentData.phone || "")
  const [language, setLanguage] = useState(currentData.language || "en")
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      setName(currentData.name)
      setPhone(currentData.phone || "")
      setLanguage(currentData.language || "en")
      setError(null)
      setSuccess(false)
    }
  }, [open, currentData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await authApi.updateMe({ name, phone, language })
      setSuccess(true)
      setTimeout(() => {
        onSuccess(response)
        onClose()
      }, 1500)
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to update profile. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = 
    name !== currentData.name || 
    phone !== (currentData.phone || "") || 
    language !== (currentData.language || "en")

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-300 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/60 to-transparent" />
        
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Edit Profile</h2>
              <p className="text-xs text-muted-foreground">Update your personal preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive animate-in shake duration-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/20 p-3 text-xs text-primary animate-in zoom-in duration-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <p>Profile updated successfully!</p>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-2">
            <label htmlFor="name" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
              Full Name
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <User className="h-4 w-4" />
              </div>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-secondary/50 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                placeholder="Enter your full name"
                disabled={loading || success}
              />
            </div>
          </div>

          {/* Phone Number */}
          <div className="space-y-2">
            <label htmlFor="phone" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
              Phone Number
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                <Phone className="h-4 w-4" />
              </div>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary/50 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                placeholder="e.g. +260 97..."
                disabled={loading || success}
              />
            </div>
          </div>

          {/* Preferred Language */}
          <div className="space-y-2">
            <label htmlFor="language" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">
              Preferred Language
            </label>
            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none">
                <Globe className="h-4 w-4" />
              </div>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary/50 py-3 pl-10 pr-4 text-sm text-foreground appearance-none focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/10 transition-all outline-none cursor-pointer"
                disabled={loading || success}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none border-l border-border pl-2">
                <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading || success}
              className="flex-1 rounded-xl bg-secondary border border-border py-3 text-sm font-bold text-foreground hover:bg-secondary/80 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success || !hasChanges}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-all active:scale-[0.98] shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
