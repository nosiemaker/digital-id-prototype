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
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = tokenStore.getAccess()
    const userRole = tokenStore.getRole()

    if (!token) {
      // Not logged in
      router.push(`/login?redirect=${pathname}`)
      setIsLoading(false)
      return
    }

    // Check if role is allowed (if allowedRoles is specified)
    if (allowedRoles && allowedRoles.length > 0) {
      if (!userRole || !allowedRoles.includes(userRole)) {
        // Role not authorized
        router.push("/login")
        setIsLoading(false)
        return
      }
    }

    // Token exists and role is authorized
    setIsAuthorized(true)
    setIsLoading(false)
  }, [router, pathname, allowedRoles])

  if (isLoading || !isAuthorized) {
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
