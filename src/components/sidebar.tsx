"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Mail,
  CheckSquare,
  Bot,
  Calendar,
  Shield,
  AlertTriangle,
  FileText,
  Send,
  LogOut,
  Menu,
  X,
  UserCog,
  Activity,
  BarChart3,
  Settings,
} from "lucide-react";
import { useAuth } from "@/components/auth-guard";
import type { Role } from "@/lib/rbac";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
}

const navItems: NavItem[] = [
  { href: "/",         label: "Dashboard",   icon: LayoutDashboard, roles: ["admin", "manager", "viewer"] },
  { href: "/crm",      label: "CRM",         icon: Users,           roles: ["admin", "manager"] },
  { href: "/outreach", label: "Outreach",     icon: Send,            roles: ["admin", "manager"] },
  { href: "/emails",   label: "Emails",       icon: Mail,            roles: ["admin", "manager"] },
  { href: "/tasks",    label: "Tasks",        icon: CheckSquare,     roles: ["admin", "manager"] },
  { href: "/legal",    label: "Legal Docs",   icon: FileText,        roles: ["admin", "manager"] },
  { href: "/activity", label: "Activity",     icon: Activity,        roles: ["admin", "manager"] },
  { href: "/agents",   label: "Agents",       icon: Bot,             roles: ["admin", "manager"] },
  { href: "/calendar", label: "Calendar",     icon: Calendar,        roles: ["admin", "manager", "viewer"] },
  { href: "/reports",  label: "Reports",      icon: BarChart3,       roles: ["admin", "manager"] },
  { href: "/chat",     label: "Secure Chat",  icon: Shield,          roles: ["admin", "manager", "viewer"] },
  { href: "/settings", label: "Settings",     icon: Settings,        roles: ["admin"] },
  { href: "/users",    label: "Users",        icon: UserCog,         roles: ["admin"] },
  { href: "/errors",   label: "Errors",       icon: AlertTriangle,   roles: ["admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, user, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, [pathname]);

  return (
    <>
      {/* Mobile header bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center px-4 z-50 md:hidden">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-muted hover:text-foreground transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <Link href="/" className="flex items-center gap-2 ml-3">
          <div className="w-8 h-8 rounded-lg bg-coreconx flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-foreground font-semibold">CCX MC</span>
        </Link>
      </div>

      {/* Backdrop (mobile only) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-card border-r border-border flex flex-col z-50 transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-coreconx flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <div>
              <h1 className="text-foreground font-semibold text-lg leading-tight">
                CoreConX
              </h1>
              <p className="text-muted text-xs">Mission Control</p>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-coreconx text-white"
                    : "text-muted hover:text-foreground hover:bg-card-hover"
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Status footer */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-muted">
              {user?.display_name || "Chuck"} — Online
            </span>
          </div>
          <p className="text-xs text-muted capitalize">{role} | claude-opus-4 | 24/7</p>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-xs text-muted hover:text-danger transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
