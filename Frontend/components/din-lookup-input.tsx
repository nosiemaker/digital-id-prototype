'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { citizenApi } from '@/lib/api/citizens'
import type { CitizenLookupResult } from '@/utils/types'

interface DINLookupInputProps {
  value: string
  onChange: (din: string) => void
  onCitizenFound?: (citizen: CitizenLookupResult) => void
  onLookupError?: (error: string | null) => void
  placeholder?: string
  label?: string
  error?: string
  disabled?: boolean
  className?: string
}

export function DINLookupInput({
  value,
  onChange,
  onCitizenFound,
  onLookupError,
  placeholder = 'Enter DIN (e.g., ZM-BOTK2TLMCEIP5)',
  label = 'Citizen DIN',
  error,
  disabled,
  className,
}: DINLookupInputProps) {
  const [loading, setLoading] = useState(false)
  const [found, setFound] = useState<CitizenLookupResult | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const activeRequestRef = useRef<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const resetState = useCallback(() => {
    setFound(null)
    setLookupError(null)
    onLookupError?.(null)
  }, [onLookupError])

  const lookupCitizen = useCallback(async (din: string) => {
    // 🛡️ Ignore incomplete DINs (Zambian DINs are ~17 chars)
    if (!din || din.length < 12) {
      resetState()
      return
    }

    if (activeRequestRef.current === din) return
    activeRequestRef.current = din

    setLoading(true)
    resetState()

    try {
      const citizen = await citizenApi.lookup(din)
      if (activeRequestRef.current === din) {
        setFound(citizen)
        onCitizenFound?.(citizen)
      }
    } catch (err: any) {
      if (activeRequestRef.current === din) {
        const msg = err.response?.data?.detail || 'Citizen not found or invalid DIN'
        setLookupError(msg)
        onLookupError?.(msg)
      }
    } finally {
      if (activeRequestRef.current === din) {
        setLoading(false)
      }
    }
  }, [onCitizenFound, onLookupError, resetState])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => lookupCitizen(value), 800) // 800ms pause
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [value, lookupCitizen])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      activeRequestRef.current = null
    }
  }, [])

  const displayError = error || lookupError

  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            resetState()
            activeRequestRef.current = null
          }}
          placeholder={placeholder}
          disabled={disabled || loading}
          className={cn('pl-9 pr-10', displayError && 'border-red-500')}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </div>
        {found && (
          <button
            type="button"
            onClick={() => {
              onChange('')
              resetState()
              activeRequestRef.current = null
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {displayError && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />{displayError}
        </p>
      )}
      {found && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/5 border border-green-500/20 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-700 truncate">{found.full_name}</p>
            <p className="text-xs text-green-600/80 truncate">{found.phone || found.residential_address || 'Citizen verified'}</p>
          </div>
          <Badge variant="outline" className="text-[10px] h-5 bg-green-500/10 text-green-600 border-green-500/30">Verified</Badge>
        </div>
      )}
    </div>
  )
}