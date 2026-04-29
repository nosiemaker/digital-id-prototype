"use client"

import { AdminSidebar } from "@/components/admin-sidebar"
import { useState, useEffect } from "react"
import { Menu, X, ShieldAlert } from "lucide-react"
import { ProtectedRoute } from "@/components/protected-route"
import { useRouter, usePathname } from "next/navigation"
import { getRoutesForRole, isPathAllowed, type UserRole } from "@/lib/config/routes"

function getUserRole(): UserRole | null {
  if (typeof window === "undefined") return null
  // Use the same key as tokenStore for consistency
  const role = localStorage.getItem("zdid_user_role") as UserRole
  return role || null
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const role = getUserRole()
    setUserRole(role)

    // Redirect if trying to access unauthorized path
    if (role && pathname && !isPathAllowed(pathname, role)) {
      const allowedRoutes = getRoutesForRole(role)
      if (allowedRoutes.length > 0) {
        router.replace(allowedRoutes[0].path)
      }
    }
  }, [pathname, router])

  return (
    <ProtectedRoute allowedRoles={["REGISTRATION_OFFICER", "HEALTH_WORKER", "SUPERVISOR", "REGISTRAR"]}>
      <div className="flex h-screen bg-background font-sans overflow-hidden">
        {/* Desktop sidebar - role-aware */}
        <div className="hidden lg:flex">
          <AdminSidebar userRole={userRole} />
        </div>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
              onClick={() => setSidebarOpen(false)} 
            />
            <div className="relative z-10 flex h-full">
              <AdminSidebar userRole={userRole} onNavigate={() => setSidebarOpen(false)} />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto flex flex-col min-w-0">
          {/* Mobile top bar */}
          <div className="lg:hidden flex items-center gap-3 border-b border-border bg-card px-4 h-14 shrink-0">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" 
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold text-foreground">Admin Portal</span>
            {userRole && (
              <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                {userRole.replace("_", " ")}
              </span>
            )}
          </div>
          
          {/* Unauthorized access fallback */}
          {userRole && pathname && !isPathAllowed(pathname, userRole) ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center space-y-4 max-w-md">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
                  <ShieldAlert className="h-8 w-8 text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
                <p className="text-sm text-muted-foreground">
                  You don't have permission to access this page. Your role ({userRole.replace("_", " ")}) 
                  doesn't have access to this section.
                </p>
                <button
                  onClick={() => {
                    const routes = getRoutesForRole(userRole)
                    if (routes.length > 0) router.push(routes[0].path)
                  }}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  Go to My Dashboard
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
