"use client"

import { User, X, ShieldCheck, Mail, Phone, MapPin, Calendar, Briefcase, GraduationCap, Globe } from "lucide-react"

interface CitizenProfileModalProps {
  open: boolean
  onClose: () => void
  profileData: Record<string, any> | null
  loading: boolean
}

export function CitizenProfileModal({ open, onClose, profileData, loading }: CitizenProfileModalProps) {
  if (!open) return null

  // Function to nicely format keys
  const formatKey = (key: string) => {
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  // Function to get icon for key
  const getIconForKey = (key: string) => {
    switch(key) {
      case 'full_name': return <User className="h-4 w-4 text-primary" />
      case 'dob': return <Calendar className="h-4 w-4 text-primary" />
      case 'phone': return <Phone className="h-4 w-4 text-primary" />
      case 'residential_address': return <MapPin className="h-4 w-4 text-primary" />
      case 'nationality': return <Globe className="h-4 w-4 text-primary" />
      case 'occupation': return <Briefcase className="h-4 w-4 text-primary" />
      case 'education_level': return <GraduationCap className="h-4 w-4 text-primary" />
      default: return <ShieldCheck className="h-4 w-4 text-primary" />
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4 shrink-0">
          <div className="flex items-center gap-2 text-foreground font-bold">
            <User className="h-5 w-5 text-primary" />
            <span>Citizen Profile Data</span>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Fetching permitted profile data...</p>
            </div>
          ) : profileData ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Verified Data Source</p>
                  <p className="text-[10px] text-muted-foreground">This data is strictly limited to your approved Institutional Data Access Scope.</p>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(profileData).map(([key, value]) => {
                  // Skip face image url in standard display, handle separately if needed
                  if (key === 'face_image_url') return null;
                  
                  return (
                    <div key={key} className="flex flex-col p-3 rounded-xl border border-border bg-secondary/10">
                      <div className="flex items-center gap-2 mb-1">
                        {getIconForKey(key)}
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{formatKey(key)}</span>
                      </div>
                      <p className="text-sm font-medium text-foreground pl-6">
                        {value ? String(value) : <span className="text-muted-foreground italic">Not provided</span>}
                      </p>
                    </div>
                  )
                })}
                
                {Object.keys(profileData).length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No data fields are permitted under your current scope.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-red-400">
              Failed to load profile data.
            </div>
          )}
        </div>

        <div className="border-t border-border/50 bg-secondary/20 p-4 shrink-0">
          <button
            onClick={onClose}
            className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
