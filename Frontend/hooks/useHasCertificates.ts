"use client"
import { useState, useEffect } from "react"
import { birthRecordApi, deathRecordApi } from "@/lib/axios"
import { useMe } from "./useMe"

export function useHasCertificates() {
  const { me, enrollmentState, loading: meLoading } = useMe()
  const [hasCertificates, setHasCertificates] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Only check when auth is resolved & user is fully enrolled
    if (meLoading || enrollmentState !== "ACTIVE" || !me?.user_id) {
      setLoading(false)
      setHasCertificates(false)
      return
    }

    let cancelled = false
    const check = async () => {
      setLoading(true)
      try {
        const [birthData, deathData, permitData] = await Promise.all([
          birthRecordApi.getMyCertificates(),
          deathRecordApi.getMyCertificates(),
          deathRecordApi.getMyBurialPermits(),
        ])
        if (!cancelled) {
          const total =
            (birthData.certificates?.length || 0) +
            (deathData.certificates?.length || 0) +
            (permitData.permits?.length || 0)
          setHasCertificates(total > 0)
        }
      } catch {
        if (!cancelled) setHasCertificates(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    check()
    return () => { cancelled = true }
  }, [meLoading, enrollmentState, me?.user_id])

  return { hasCertificates, loading }
}