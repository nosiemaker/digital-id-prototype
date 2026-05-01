'use client'
import { useState, useEffect, useCallback } from 'react'
import { Search, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { citizenApi} from '@/lib/api/citizens'
import type { CitizenLookupResult } from '@/utils/types'

interface DINLookupInputProps {
  value: string
  onChange: (din: string) => void
  onCitizenFound?: (citizen: CitizenLookupResult) => void
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
  placeholder = 'Enter DIN (e.g., 123456/01/1)',
  label = 'Citizen DIN',
  error,
  disabled,
  className,
}: DINLookupInputProps) {
  const [loading, setLoading] = useState(false)
  const [found, setFound] = useState<CitizenLookupResult | null>(null)
  const [debouncedDin, setDebouncedDin] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDin(value), 600)
    return () => clearTimeout(timer)
  }, [value])

  const lookupCitizen = useCallback(async (din: string) => {
    if (!din || din.length < 5) {
      setFound(null)
      return
    }
    setLoading(true)
    try {
      const citizen = await citizenApi.lookup(din)
      setFound(citizen)
      onCitizenFound?.(citizen)
    } catch (err: any) {
      setFound(null)
      // Only show toast on explicit 404 or network errors, not during typing
      if (err.response?.status === 404 || !err.response) {
        toast.error(err.response?.data?.detail || 'Citizen not found')
      }
    } finally {
      setLoading(false)
    }
  }, [onCitizenFound])

  useEffect(() => {
    if (debouncedDin) lookupCitizen(debouncedDin)
  }, [debouncedDin, lookupCitizen])

  return (
    <div className={cn('space-y-2', className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => { onChange(e.target.value); setFound(null) }}
          placeholder={placeholder}
          disabled={disabled || loading}
          className={cn('pl-9 pr-10', error && 'border-red-500')}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </div>
        {found && (
          <button type="button" onClick={() => { onChange(''); setFound(null) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
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