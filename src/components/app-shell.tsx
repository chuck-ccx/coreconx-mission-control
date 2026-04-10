"use client";

import { type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard, useAuth } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";
import { canAccessRoute } from "@/lib/rbac";
import { ShieldX } from "lucide-react";

function RouteGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role } = useAuth();

  if (!canAccessRoute(role, pathname)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldX size={48} className="text-muted mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
        <p className="text-muted text-sm max-w-md">
          Your role does not have access to this page. Contact an administrator to request access.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-64 pt-14 md:pt-0 p-4 md:p-6 overflow-auto">
        <RouteGuard>{children}</RouteGuard>
      </main>
    </AuthGuard>
  );
}
