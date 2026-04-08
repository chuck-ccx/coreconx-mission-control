"use client";

import { type ReactNode } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Sidebar } from "@/components/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <Sidebar />
      <main className="flex-1 ml-0 md:ml-64 pt-14 md:pt-0 p-4 md:p-6 overflow-auto">{children}</main>
    </AuthGuard>
  );
}
