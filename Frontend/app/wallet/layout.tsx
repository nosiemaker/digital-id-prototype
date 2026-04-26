"use client"

import { ProtectedRoute } from "@/components/protected-route"

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["CITIZEN"]}>
      {children}
    </ProtectedRoute>
  )
}
