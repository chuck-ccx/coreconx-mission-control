"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, UserPlus, Shield, ShieldCheck, Eye, MoreVertical, X } from "lucide-react";
import { RequireRole } from "@/components/require-role";
import { useAuth } from "@/components/auth-guard";
import type { UserProfile, Role } from "@/lib/rbac";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.ccxmc.ca";
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || "";

const ROLE_LABELS: Record<Role, { label: string; color: string; icon: typeof Shield }> = {
  admin:   { label: "Admin",   color: "text-danger",  icon: ShieldCheck },
  manager: { label: "Manager", color: "text-warning",  icon: Shield },
  viewer:  { label: "Viewer",  color: "text-info",     icon: Eye },
};

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-success/20 text-success",
  invited:  "bg-warning/20 text-warning",
  disabled: "bg-muted/20 text-muted",
};

function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const headers = {
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "application/json",
  };

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/users`, { headers });
      if (res.ok) setUsers(await res.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setInviteLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/users/invite`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          invited_by: currentUser?.email || null,
        }),
      });
      if (res.ok) {
        setShowInvite(false);
        setInviteEmail("");
        setInviteRole("viewer");
        fetchUsers();
      } else {
        const data = await res.json();
        setInviteError(data.error || "Failed to send invite");
      }
    } catch {
      setInviteError("Failed to reach server");
    } finally {
      setInviteLoading(false);
    }
  };

  const updateRole = async (id: string, role: Role) => {
    try {
      await fetch(`${API_BASE}/api/users/${id}/role`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ role }),
      });
      fetchUsers();
    } catch { /* ignore */ }
    setMenuOpen(null);
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "disabled" : "active";
    try {
      await fetch(`${API_BASE}/api/users/${id}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: newStatus }),
      });
      fetchUsers();
    } catch { /* ignore */ }
    setMenuOpen(null);
  };

  const deleteUser = async (id: string) => {
    if (!confirm("Are you sure you want to remove this user?")) return;
    try {
      await fetch(`${API_BASE}/api/users/${id}`, { method: "DELETE", headers });
      fetchUsers();
    } catch { /* ignore */ }
    setMenuOpen(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Users size={28} />
            User Management
          </h1>
          <p className="text-muted text-sm mt-1">
            Manage team members and their access roles
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-coreconx text-white rounded-lg text-sm font-medium hover:bg-coreconx-light transition-colors"
        >
          <UserPlus size={16} />
          Invite User
        </button>
      </div>

      {/* Role legend */}
      <div className="flex gap-4 text-xs text-muted">
        {(Object.entries(ROLE_LABELS) as [Role, typeof ROLE_LABELS[Role]][]).map(([key, { label, color, icon: Icon }]) => (
          <span key={key} className={`flex items-center gap-1 ${color}`}>
            <Icon size={14} /> {label}
          </span>
        ))}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Invite User</h2>
              <button onClick={() => setShowInvite(false)} className="text-muted hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-xs text-muted font-medium block mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted text-sm focus:outline-none focus:ring-2 focus:ring-coreconx-light"
                />
              </div>
              <div>
                <label className="text-xs text-muted font-medium block mb-1.5">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="w-full px-4 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-coreconx-light"
                >
                  <option value="viewer">Viewer — Dashboard &amp; reports only</option>
                  <option value="manager">Manager — CRM, tasks, emails</option>
                  <option value="admin">Admin — Full access</option>
                </select>
              </div>
              {inviteError && <p className="text-danger text-xs">{inviteError}</p>}
              <button
                type="submit"
                disabled={inviteLoading}
                className="w-full px-4 py-2.5 bg-coreconx text-white rounded-lg text-sm font-medium hover:bg-coreconx-light transition-colors disabled:opacity-50"
              >
                {inviteLoading ? "Sending Invite..." : "Send Invite"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted text-sm">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">
            No users found. Invite your first team member to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const roleInfo = ROLE_LABELS[u.role] || ROLE_LABELS.viewer;
                const RoleIcon = roleInfo.icon;
                const isCurrentUser = currentUser?.id === u.id;
                return (
                  <tr key={u.id} className="border-b border-border last:border-0 hover:bg-background/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-foreground font-medium">
                          {u.display_name || u.email.split("@")[0]}
                          {isCurrentUser && <span className="text-xs text-muted ml-2">(you)</span>}
                        </p>
                        <p className="text-xs text-muted">{u.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 ${roleInfo.color}`}>
                        <RoleIcon size={14} />
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[u.status] || STATUS_COLORS.disabled}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 relative">
                      {!isCurrentUser && (
                        <>
                          <button
                            onClick={() => setMenuOpen(menuOpen === u.id ? null : u.id)}
                            className="text-muted hover:text-foreground p-1 rounded"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {menuOpen === u.id && (
                            <div className="absolute right-4 top-10 bg-card border border-border rounded-lg shadow-lg z-10 min-w-[160px] py-1">
                              <p className="px-3 py-1.5 text-xs text-muted font-medium">Change Role</p>
                              {(["admin", "manager", "viewer"] as Role[]).map((r) => (
                                <button
                                  key={r}
                                  onClick={() => updateRole(u.id, r)}
                                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-background transition-colors ${u.role === r ? "text-coreconx-light font-medium" : "text-foreground"}`}
                                >
                                  {ROLE_LABELS[r].label}
                                </button>
                              ))}
                              <div className="border-t border-border my-1" />
                              <button
                                onClick={() => toggleStatus(u.id, u.status)}
                                className="w-full text-left px-3 py-1.5 text-sm text-foreground hover:bg-background transition-colors"
                              >
                                {u.status === "active" ? "Disable" : "Enable"} User
                              </button>
                              <button
                                onClick={() => deleteUser(u.id)}
                                className="w-full text-left px-3 py-1.5 text-sm text-danger hover:bg-background transition-colors"
                              >
                                Remove User
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function UsersPage() {
  return (
    <RequireRole allowed={["admin"]}>
      <UserManagement />
    </RequireRole>
  );
}
