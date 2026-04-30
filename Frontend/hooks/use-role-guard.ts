"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getRoutesForRole, type UserRole } from "@/lib/config/routes"

export function useRoleGuard(allowedRoles: UserRole[]) {
  const router = useRouter()

  useEffect(() => {
    // Use the same key as tokenStore for consistency
    const role = localStorage.getItem("zdid_user_role") as UserRole
    if (!role || !allowedRoles.includes(role)) {
      const fallbackRoutes = getRoutesForRole(role)
      router.replace(fallbackRoutes[0]?.path ?? "/login")
    }
  }, [router, allowedRoles])
}
