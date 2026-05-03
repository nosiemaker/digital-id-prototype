"use client"

import { Building2, Link2, ShieldAlert, X } from "lucide-react"

interface LinkPartnerModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  institutionName: string
  permittedScopes: string[]
  isLinking: boolean
}

export function LinkPartnerModal({
  open,
  onClose,
  onConfirm,
  institutionName,
  permittedScopes,
  isLinking,
}: LinkPartnerModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div className="flex items-center gap-2 text-foreground font-bold">
            <Link2 className="h-5 w-5 text-primary" />
            <span>Link Account</span>
          </div>
          <button 
            onClick={onClose}
            disabled={isLinking}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="flex items-center justify-center gap-4 w-full">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <div className="h-0.5 w-8 bg-border border-dashed" />
              <div className="h-16 w-16 rounded-2xl bg-secondary border border-border flex items-center justify-center text-foreground">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground">Link to {institutionName}?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You are about to establish a secure connection with this service partner. 
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Data Access Permissions</p>
            <p className="text-xs text-muted-foreground">
              By linking your account, you authorize this partner to request the following details when you use their services:
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {permittedScopes && permittedScopes.length > 0 ? (
                permittedScopes.map((scope) => (
                  <span key={scope} className="text-xs font-medium bg-card border border-border px-2.5 py-1 rounded-lg text-foreground shadow-sm">
                    {scope.replace("_", " ")}
                  </span>
                ))
              ) : (
                <span className="text-xs font-medium bg-card border border-border px-2.5 py-1 rounded-lg text-foreground shadow-sm">
                  Basic Identity Verification
                </span>
              )}
            </div>
          </div>
          
          <p className="text-[11px] text-muted-foreground italic text-center px-4">
            An email confirmation will be sent to your registered address once linked.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-border/50 bg-secondary/20 p-6">
          <button
            onClick={onClose}
            disabled={isLinking}
            className="flex w-full items-center justify-center rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLinking}
            className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLinking ? "Linking..." : "Confirm & Link"}
          </button>
        </div>
      </div>
    </div>
  )
}
