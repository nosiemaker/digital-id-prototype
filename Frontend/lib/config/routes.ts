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
  REGISTRATION_OFFICER: "/admin/dashboard",
  HEALTH_WORKER: "/admin/health-worker/dashboard",
  REGISTRAR: "/admin/registrar",
  SUPERVISOR: "/admin/dashboard",
  CITIZEN: "/citizens/wallet",
  THIRD_PARTY: "/institutions/dashboard",
};

export const DEFAULT_ROUTE = "/citizens/wallet";

// Navigation items for sidebar
export const sidebarRoutes: RouteConfig[] = [
  // SHARED DASHBOARD
  {
    path: "/admin/dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    allowedRoles: ["SUPERVISOR", "REGISTRATION_OFFICER"],
    description: "Overview and analytics",
  },

  // REGISTRATION OFFICER ONLY
  {
    path: "/admin/registrations",
    label: "Registrations",
    icon: "ClipboardList",
    allowedRoles: ["REGISTRATION_OFFICER"],
    description: "Review and process citizen enrollment applications",
  },
  {
    path: "/admin/qr-verify",
    label: "QR Verify",
    icon: "QrCode",
    allowedRoles: ["REGISTRATION_OFFICER"],
    description: "Scan and verify citizen QR codes",
  },
  {
    path: "/admin/analytics",
    label: "Analysis",
    icon: "BarChart3",
    allowedRoles: ["REGISTRATION_OFFICER", "SUPERVISOR"],
    description: "System analytics and demographic data",
  },
  {
    path: "/citizens",
    label: "Citizens",
    icon: "Users",
    allowedRoles: ["REGISTRATION_OFFICER"],
    description: "View all registered citizens",
  },

  // HEALTH WORKER ONLY
  {
    path: "/admin/health-worker/dashboard",
    label: "Dashboard",
    icon: "LayoutDashboard",
    allowedRoles: ["HEALTH_WORKER"],
    description: "View your submission history and statistics",
  },
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
    path: "/admin/registrar",
    label: "Dashboard",
    icon: "LayoutDashboard",
    allowedRoles: ["REGISTRAR"],
    description: "Display birth and death registrations",
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
    path: "/admin/registrar/certificates",
    label: "Certificates",
    icon: "FileText",
    allowedRoles: ["REGISTRAR"],
    description: "View, search, and reissue approved birth and death certificates",
  },
  {
    path: "/admin/registrar/reports",
    label: "Reports",
    icon: "BarChart3",
    allowedRoles: ["REGISTRAR"],
    description: "Generate system reports and analytics",
  },
  {
    path: "/admin/registrar/staff",
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
    allowedRoles: ["SUPERVISOR", "REGISTRATION_OFFICER"],
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
  const normalizedPath = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
  
  const route = sidebarRoutes.find((r) => {
    // Normalize the route path as well (strip trailing slash)
    const normalizedRoute = r.path.endsWith('/') && r.path !== '/' ? r.path.slice(0, -1) : r.path;
    
    // Exact match
    if (normalizedRoute === normalizedPath) return true;
    
    // Check if the route is dynamic (contains :id)
    if (normalizedRoute.includes(':id')) {
      const baseRoute = normalizedRoute.split('/:id')[0]; // "/admin/citizens"
      return normalizedPath.startsWith(baseRoute);
    }
    return false;
  });

  if (!route) return false;
  return route.allowedRoles.includes(role);
}
