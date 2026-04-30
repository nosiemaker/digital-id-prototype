export type UserRole = 
  | "REGISTRATION_OFFICER" 
  | "HEALTH_WORKER" 
  | "REGISTRAR" 
  | "SUPERVISOR"
  | "CITIZEN"
  | "THIRD_PARTY";

export interface RouteConfig {
  path: string;
  label: string;
  icon: string; // lucide icon name
  allowedRoles: UserRole[];
  description?: string;
}

export const ROLE_ROUTES: Record<UserRole, string> = {
  REGISTRATION_OFFICER: "/admin/registrations",
  HEALTH_WORKER: "/admin/health-worker/birth-records",
  REGISTRAR: "/admin/registrar/birth-records",
  SUPERVISOR: "/admin/dashboard",
  CITIZEN: "/wallet",
  THIRD_PARTY: "/institutions/dashboard",
};

export const DEFAULT_ROUTE = "/wallet";

// Navigation items for sidebar
export const sidebarRoutes: RouteConfig[] = [
  // REGISTRATION OFFICER ONLY
  {
    path: "/admin/registrations",
    label: "Registrations",
    icon: "ClipboardList",
    allowedRoles: ["REGISTRATION_OFFICER"],
    description: "Review and process citizen enrollment applications",
  },
  {
    path: "/admin/citizens",
    label: "Citizens",
    icon: "Users",
    allowedRoles: ["REGISTRATION_OFFICER"],
    description: "View all registered citizens",
  },
  {
    path: "/admin/citizens/:id",
    label: "Citizen Details",
    icon: "Users",
    allowedRoles: ["REGISTRATION_OFFICER"],
    description: "Review and approve/reject citizen enrollment applications",
  },

  // HEALTH WORKER ONLY
  {
    path: "/admin/health-worker/birth-records",
    label: "Birth Records",
    icon: "Baby",
    allowedRoles: ["HEALTH_WORKER"],
    description: "Register and manage birth certificates",
  },
  {
    path: "/admin/health-worker/death-records",
    label: "Death Records",
    icon: "Skull",
    allowedRoles: ["HEALTH_WORKER"],
    description: "Register and manage death certificates with ICD-11 coding",
  },

  // REGISTRAR ONLY
  {
    path: "/admin/dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    allowedRoles: ["REGISTRAR", "SUPERVISOR"],
    description: "Overview and analytics",
  },
  {
    path: "/admin/registrar/birth-records",
    label: "Review Birth Records",
    icon: "Baby",
    allowedRoles: ["REGISTRAR"],
    description: "Approve or reject birth registrations",
  },
  {
    path: "/admin/registrar/death-records",
    label: "Review Death Records",
    icon: "Skull",
    allowedRoles: ["REGISTRAR"],
    description: "Approve or reject death registrations",
  },
  {
    path: "/admin/certificates",
    label: "Certificates",
    icon: "FileText",
    allowedRoles: ["REGISTRAR"],
    description: "Generate, verify, and manage digital certificates",
  },
  {
    path: "/admin/reports",
    label: "Reports",
    icon: "BarChart3",
    allowedRoles: ["REGISTRAR"],
    description: "Generate system reports and analytics",
  },
  {
    path: "/admin/staff",
    label: "Staff Management",
    icon: "UserCog",
    allowedRoles: ["REGISTRAR"],
    description: "Add and manage Registration Officers and Health Workers",
  },

  // SUPERVISOR ONLY
  {
    path: "/admin/institutions",
    label: "Institutions",
    icon: "Building2",
    allowedRoles: ["SUPERVISOR"],
    description: "Approve third-party institutions",
  },
  {
    path: "/admin/statistics",
    label: "Statistics",
    icon: "TrendingUp",
    allowedRoles: ["SUPERVISOR"],
    description: "National statistics and performance metrics",
  },
];

// Helper to get routes for a specific role
export function getRoutesForRole(role: UserRole): RouteConfig[] {
  return sidebarRoutes.filter((route) => route.allowedRoles.includes(role));
}

// Helper to check if a path is accessible by a role
export function isPathAllowed(path: string, role: UserRole): boolean {
  const route = sidebarRoutes.find((r) => {
    // Exact match
    if (r.path === path) return true;
    
    // Check if the route is dynamic (contains :id)
    if (r.path.includes(':id')) {
      const baseRoute = r.path.split('/:id')[0]; // "/admin/citizens"
      return path.startsWith(baseRoute);
    }
    return false;
  });

  if (!route) return false;
  return route.allowedRoles.includes(role);
}
