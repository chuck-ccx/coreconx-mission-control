"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Settings,
  Globe,
  Palette,
  Bell,
  Database,
  GitBranch,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  RefreshCw,
  UserPlus,
  Send,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";

/* ---------- types ---------- */
interface ServiceStatus {
  name: string;
  key: string;
  connected: boolean;
  checking: boolean;
  detail: string;
}

/* ---------- component ---------- */
export default function SettingsPage() {
  // App config
  const [apiUrl, setApiUrl] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(60);
  const [saved, setSaved] = useState(false);

  // Team invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteCompany, setInviteCompany] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Services
  const [services, setServices] = useState<ServiceStatus[]>([
    { name: "Supabase", key: "supabase", connected: false, checking: true, detail: "" },
    { name: "Linear (Tasks)", key: "linear", connected: false, checking: true, detail: "" },
    { name: "Express API", key: "api", connected: false, checking: true, detail: "" },
  ]);

  // Load persisted settings
  const loadSettings = useCallback(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("ccx-settings");
    if (stored) {
      try {
        const s = JSON.parse(stored) as {
          apiUrl?: string;
          theme?: "dark" | "light";
          autoRefresh?: boolean;
          refreshInterval?: number;
        };
        if (s.apiUrl) setApiUrl(s.apiUrl);
        if (s.theme) setTheme(s.theme);
        if (s.autoRefresh !== undefined) setAutoRefresh(s.autoRefresh);
        if (s.refreshInterval) setRefreshInterval(s.refreshInterval);
      } catch { /* ignore corrupt data */ }
    } else {
      setApiUrl(process.env.NEXT_PUBLIC_API_URL || "https://api.ccxmc.ca");
    }
  }, []);

  useEffect(() => { void loadSettings(); }, [loadSettings]); // eslint-disable-line react-hooks/set-state-in-effect

  // Check services
  const checkServices = useCallback(async () => {
    setServices((prev) => prev.map((s) => ({ ...s, checking: true })));

    // Supabase
    const sbStart = Date.now();
    const { error: sbErr } = await supabase.from("companies").select("id").limit(1);
    const sbMs = Date.now() - sbStart;
    setServices((prev) =>
      prev.map((s) =>
        s.key === "supabase"
          ? { ...s, connected: !sbErr, checking: false, detail: sbErr ? sbErr.message : `${sbMs}ms` }
          : s,
      ),
    );

    // Linear via API
    const linStart = Date.now();
    const linData = await apiFetch<unknown[]>("/api/tasks/states");
    const linMs = Date.now() - linStart;
    setServices((prev) =>
      prev.map((s) =>
        s.key === "linear"
          ? { ...s, connected: !!linData, checking: false, detail: linData ? `${linMs}ms` : "unreachable" }
          : s,
      ),
    );

    // Express API health
    const apiStart = Date.now();
    const apiData = await apiFetch<{ status?: string }>("/health");
    const apiMs = Date.now() - apiStart;
    setServices((prev) =>
      prev.map((s) =>
        s.key === "api"
          ? { ...s, connected: !!apiData, checking: false, detail: apiData ? `${apiMs}ms` : "unreachable" }
          : s,
      ),
    );
  }, []);

  useEffect(() => { void checkServices(); }, [checkServices]); // eslint-disable-line react-hooks/set-state-in-effect

  const saveSettings = () => {
    localStorage.setItem(
      "ccx-settings",
      JSON.stringify({ apiUrl, theme, autoRefresh, refreshInterval }),
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings size={24} className="text-coreconx-light" />
          Settings
        </h1>
        <p className="text-muted text-sm mt-1">App configuration and connected services</p>
      </div>

      {/* App Configuration */}
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Globe size={16} className="text-coreconx-light" />
            App Configuration
          </h2>
        </div>
        <div className="p-4 space-y-4">
          {/* API URL */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">API URL</label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx/60"
              placeholder="https://api.ccxmc.ca"
            />
          </div>

          {/* Theme */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Theme</label>
            <div className="flex gap-2">
              {(["dark", "light"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors ${
                    theme === t
                      ? "bg-coreconx/20 border-coreconx/40 text-coreconx-light font-medium"
                      : "border-border text-muted hover:border-coreconx/40 hover:text-foreground"
                  }`}
                >
                  <Palette size={14} />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Auto-refresh */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-medium text-foreground">Auto-refresh</label>
              <p className="text-[10px] text-muted mt-0.5">Automatically refresh data on pages</p>
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative w-11 h-6 rounded-full transition-colors ${autoRefresh ? "bg-coreconx-light" : "bg-border"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${autoRefresh ? "translate-x-5" : ""}`}
              />
            </button>
          </div>

          {/* Refresh interval */}
          {autoRefresh && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Refresh Interval (seconds)</label>
              <input
                type="number"
                min={10}
                max={300}
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="w-32 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx/60"
              />
            </div>
          )}
        </div>
      </div>

      {/* Team Invite (COR-77) */}
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <UserPlus size={16} className="text-success" />
            Invite Teammate
          </h2>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Email Address</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@company.com"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx/60"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Company ID</label>
              <input
                type="text"
                value={inviteCompany}
                onChange={(e) => setInviteCompany(e.target.value)}
                placeholder="company-uuid"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx/60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx/60"
              >
                <option value="viewer">Viewer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          {inviteResult && (
            <p className={`text-xs ${inviteResult.ok ? "text-success" : "text-danger"}`}>
              {inviteResult.msg}
            </p>
          )}
          <button
            disabled={inviteSending || !inviteEmail || !inviteCompany}
            onClick={async () => {
              setInviteSending(true);
              setInviteResult(null);
              try {
                const res = await apiFetch<{ sent?: boolean; error?: string }>("/api/team/invite", {
                  method: "POST",
                  body: JSON.stringify({ email: inviteEmail, company_id: inviteCompany, role: inviteRole }),
                });
                if (res?.sent) {
                  setInviteResult({ ok: true, msg: `Invite sent to ${inviteEmail}` });
                  setInviteEmail("");
                } else {
                  setInviteResult({ ok: false, msg: res?.error || "Failed to send invite" });
                }
              } catch {
                setInviteResult({ ok: false, msg: "Failed to reach server" });
              } finally {
                setInviteSending(false);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-coreconx text-white rounded-lg hover:bg-coreconx-light transition-colors disabled:opacity-50"
          >
            <Send size={14} />
            {inviteSending ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </div>

      {/* User Preferences */}
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Bell size={16} className="text-warning" />
            User Preferences
          </h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-medium text-foreground">Desktop Notifications</label>
              <p className="text-[10px] text-muted mt-0.5">Show browser notifications for updates</p>
            </div>
            <button
              onClick={() => {
                if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
                  void Notification.requestPermission();
                }
              }}
              className="px-3 py-1.5 text-xs bg-card border border-border rounded-lg hover:border-coreconx/40 text-muted hover:text-foreground transition-colors"
            >
              {typeof Notification !== "undefined" && Notification.permission === "granted"
                ? "Enabled"
                : "Enable"}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="block text-xs font-medium text-foreground">Compact Mode</label>
              <p className="text-[10px] text-muted mt-0.5">Reduce padding and font sizes</p>
            </div>
            <button className="relative w-11 h-6 rounded-full bg-border transition-colors">
              <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Connected Services */}
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Database size={16} className="text-info" />
            Connected Services
          </h2>
          <button
            onClick={checkServices}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-card border border-border rounded-lg hover:border-coreconx/40 text-muted hover:text-foreground transition-colors"
          >
            <RefreshCw size={12} />
            Re-check
          </button>
        </div>
        <div className="divide-y divide-border">
          {services.map((svc) => (
            <div key={svc.key} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {svc.key === "supabase" && <Database size={18} className="text-info" />}
                {svc.key === "linear" && <CheckCircle2 size={18} className="text-warning" />}
                {svc.key === "api" && <GitBranch size={18} className="text-success" />}
                <div>
                  <p className="text-sm font-medium text-foreground">{svc.name}</p>
                  <p className="text-[10px] text-muted mt-0.5">
                    {svc.checking ? "Checking..." : svc.detail}
                  </p>
                </div>
              </div>
              <div>
                {svc.checking ? (
                  <Loader2 size={16} className="animate-spin text-muted" />
                ) : svc.connected ? (
                  <span className="flex items-center gap-1.5 text-xs text-success font-medium">
                    <CheckCircle2 size={14} />
                    Connected
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-danger font-medium">
                    <XCircle size={14} />
                    Disconnected
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Environment Info */}
      <div className="bg-card border border-border rounded-xl">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-medium text-foreground">Environment</h2>
        </div>
        <div className="p-4 space-y-2 font-mono text-xs">
          <div className="flex justify-between">
            <span className="text-muted">NEXT_PUBLIC_API_URL</span>
            <span className="text-foreground">{process.env.NEXT_PUBLIC_API_URL || "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">NEXT_PUBLIC_SUPABASE_URL</span>
            <span className="text-foreground">{process.env.NEXT_PUBLIC_SUPABASE_URL ? "set" : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
            <span className="text-foreground">{process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "set" : "—"}</span>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-coreconx text-white rounded-lg hover:bg-coreconx-light transition-colors"
        >
          {saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
