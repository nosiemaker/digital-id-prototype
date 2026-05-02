"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  Shield, 
  ClipboardList, 
  Users, 
  Baby, 
  Skull, 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  UserCog, 
  Building2, 
  TrendingUp,
  LogOut,
  ChevronRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { tokenStore } from "@/lib/axios"
import { getRoutesForRole, type UserRole } from "@/lib/config/routes"
import { Logo } from "@/components/Logo"

const iconMap: Record<string, React.ElementType> = {
  ClipboardList,
  Users,
  Baby,
  Skull,
  LayoutDashboard,
  FileText,
  BarChart3,
  UserCog,
  Building2,
  TrendingUp,
}

interface AdminSidebarProps {
  userRole: UserRole | null
  onNavigate?: () => void
}

export function AdminSidebar({ userRole, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  if (!userRole) return null

  const routes = getRoutesForRole(userRole)

  const handleLogout = () => {
    localStorage.removeItem("zdid_access_token")
    localStorage.removeItem("zdid_refresh_token")
    localStorage.removeItem("zdid_user_role")
    localStorage.removeItem("zdid_user_name")
    router.push("/login")
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <Logo width={32} height={32} />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-foreground leading-tight">ZAMREN</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            {userRole.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-auto px-3 py-4 space-y-1">
        {routes.map((route) => {
          const Icon = iconMap[route.icon] || Shield
          const isActive = pathname === route.path

          return (
            <Link
              key={route.path}
              href={route.path}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors group",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              <span className="flex-1">{route.label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 text-primary" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3 space-y-2">
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-[11px] text-muted-foreground">
            Signed in as
          </p>
          <p className="text-xs font-medium text-foreground truncate">
            {typeof window !== "undefined" ? tokenStore.getName() || "User" : "User"}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
