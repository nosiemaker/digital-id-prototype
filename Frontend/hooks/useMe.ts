/**
 * useMe
 * Fetches GET /auth/me once on mount and derives enrollment state.
 *
 * Banner trigger logic:
 *   enrollmentState === "NOT_STARTED"  →  citizen_din is null; user has never
 *                                         submitted identity docs → show CTA banner
 *   enrollmentState === "PENDING"      →  docs submitted, awaiting RO review
 *                                         → show a softer "in review" banner
 *   enrollmentState === "ACTIVE"       →  fully enrolled, no banner needed
 */

import { useEffect, useState } from "react"
import { authApi, tokenStore, type MeResponse } from "@/lib/axios"

export type EnrollmentState =
  | "NOT_STARTED"
  | "PENDING"
  | "ACTIVE"
  | "SUSPENDED"
  | "DECEASED"
  | "UNKNOWN"

export interface UseMeResult {
  me:              MeResponse | null
  enrollmentState: EnrollmentState
  loading:         boolean
  error:           string | null
  /** Re-fetch after the user completes a registration step */
  refresh:         () => void
}

export function useMe(): UseMeResult {
  const [me, setMe]           = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [tick, setTick]       = useState(0)

  useEffect(() => {
    if (!tokenStore.getAccess()) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await authApi.me()
        if (!cancelled) setMe(data)
      } catch (e: any) {
        if (!cancelled) setError(e?.detail ?? "Failed to load session.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tick])

  function deriveState(m: MeResponse | null): EnrollmentState {
    if (!m) return "UNKNOWN"
    // No citizen_din means the user has never submitted identity docs.
    // citizen_status is null until a Citizen record is created.
    if (!m.citizen_din && !m.citizen_status) return "NOT_STARTED"
    switch (m.citizen_status) {
      case "PENDING":   return "PENDING"
      case "ACTIVE":    return "ACTIVE"
      case "SUSPENDED": return "SUSPENDED"
      case "DECEASED":  return "DECEASED"
      default:          return "UNKNOWN"
    }
  }

  return {
    me,
    enrollmentState: deriveState(me),
    loading,
    error,
    refresh: () => setTick(t => t + 1),
  }
}