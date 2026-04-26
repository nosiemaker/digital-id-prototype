"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { tokenStore } from "@/lib/axios"

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    const token = tokenStore.getAccess()

    if (!token) {
      // Not logged in
      router.push(`/login?redirect=${pathname}`)
      return
    }

    // Token exists - user is authenticated
    setIsAuthorized(true)
  }, [router, pathname])

  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Verifying access…</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
