"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { authApi, tokenStore } from "@/lib/axios"

import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart2,
  Shield,
  LogOut,
  ChevronRight,
  Baby,
  Skull,
  HeartPulse,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"

const sidebarLinks = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Citizens", href: "/admin/citizens", icon: Users },
  { label: "Registrations", href: "/admin/registrations", icon: ClipboardList },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart2 },
]

const civilRegistrationLinks = [
  { label: "Birth Records", href: "/admin/civil/births", icon: Baby },
  { label: "Death Records", href: "/admin/civil/deaths", icon: Skull },
  { label: "Certificates", href: "/admin/civil/certificates", icon: FileText },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const userName = tokenStore.getName() || "Admin User"
  const userRole = tokenStore.getRole() || "RO"

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault()
    try {
      await authApi.logout()
      router.push("/login")
    } catch (err) {
      tokenStore.clear()
      router.push("/login")
    }
  }


  return (
    <aside className="flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-6 border-b border-sidebar-border">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Shield className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-sidebar-foreground">Zambia</span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">Admin Portal</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {sidebarLinks.map((link) => {
          const Icon = link.icon
          const active = pathname === link.href || (link.href !== "/admin" && pathname.startsWith(link.href) && !pathname.startsWith("/admin/civil"))
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors group",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{link.label}</span>
              {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
            </Link>
          )
        })}

        {/* Civil Registration Section */}
        <div className="pt-4 mt-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-3 py-2">
            <HeartPulse className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Civil Registration</span>
          </div>
          {civilRegistrationLinks.map((link) => {
            const Icon = link.icon
            const active = pathname === link.href || pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors group",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{link.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 mb-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
            {userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">{userName}</p>
            <p className="text-[10px] text-muted-foreground truncate font-mono uppercase tracking-tighter">{userRole}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors text-left"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>

      </div>
    </aside>
  )
}
