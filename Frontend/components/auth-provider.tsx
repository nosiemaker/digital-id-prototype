"use client";

import { useAuthGuard } from "@/hooks/useAuthGuard";

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  useAuthGuard();
  return <>{children}</>;
}