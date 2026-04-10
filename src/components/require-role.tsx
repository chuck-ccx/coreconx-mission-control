"use client";

import type { ReactNode } from "react";
import { ShieldX } from "lucide-react";
import { useAuth } from "@/components/auth-guard";
import type { Role } from "@/lib/rbac";
import { hasRole } from "@/lib/rbac";

interface RequireRoleProps {
  allowed: Role[];
  children: ReactNode;
  fallback?: ReactNode;
}

function DefaultFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <ShieldX size={48} className="text-muted mb-4" />
      <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
      <p className="text-muted text-sm max-w-md">
        You don&apos;t have permission to view this page. Contact an administrator if you believe this is an error.
      </p>
    </div>
  );
}

export function RequireRole({ allowed, children, fallback }: RequireRoleProps) {
  const { role } = useAuth();

  if (!hasRole(role, allowed)) {
    return fallback ?? <DefaultFallback />;
  }

  return <>{children}</>;
}
