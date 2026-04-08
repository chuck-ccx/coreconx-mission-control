"use client";

import { useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  Copy,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Filter,
} from "lucide-react";

interface ErrorEntry {
  id: string;
  level: "error" | "warning" | "info" | "resolved";
  title: string;
  message: string;
  timestamp: string;
  source: string;
  stackTrace?: string;
  suggestion?: string;
  resolved?: boolean;
}

const sampleErrors: ErrorEntry[] = [
  {
    id: "e1",
    level: "resolved",
    title: "DKIM Authentication Delay",
    message:
      "Email authentication was not verified. DNS propagation took longer than expected for google._domainkey TXT record.",
    timestamp: "2026-04-08 01:06 PDT",
    source: "Google Workspace → Gmail → DKIM",
    suggestion: "Resolved after 15 min. Cloudflare DNS propagation was fast but Google's verification check needed time.",
    resolved: true,
  },
  {
    id: "e2",
    level: "error",
    title: "GitHub Repo Access — 404 Not Found",
    message:
      'Repository "wundergunder/coreconx-web" returned 404. Pending invitation cannot be accepted — PAT token missing "repo" scope.',
    timestamp: "2026-04-06 19:28 PDT",
    source: "GitHub API → gh repo clone",
    stackTrace:
      "gh api repos/wundergunder/coreconx-web → HTTP 404\ngh api user/repository_invitations → empty array\nToken scope: [read:user, user:email] — missing: [repo]",
    suggestion:
      "Need a new Personal Access Token (classic) with 'repo' scope for chuck-ccx. Generate at: GitHub → Settings → Developer settings → PAT → Tokens (classic). Check 'repo' box.",
  },
  {
    id: "e3",
    level: "warning",
    title: "Google Drive API Not Enabled",
    message:
      "OAuth tokens valid but Drive API returned 403 — API not enabled in Cloud Console project 323875627418.",
    timestamp: "2026-04-06 23:54 PDT",
    source: "gog CLI → drive ls",
    suggestion:
      "Fixed by Dylan enabling Drive + Docs + Sheets APIs in Google Cloud Console. If it happens again: console.developers.google.com → APIs → Enable.",
    resolved: true,
  },
  {
    id: "e4",
    level: "warning",
    title: "Netlify CLI Auth Timeout",
    message:
      "Multiple netlify login attempts timed out. Ticket-based auth flow expired before browser authorization was completed.",
    timestamp: "2026-04-08 02:10 PDT",
    source: "netlify-cli → netlify login",
    stackTrace:
      "Ticket: a50c750f... → polling → timeout after 300s\nTicket: c38a6905... → polling → timeout after 300s\nTicket: bf818679... → polling → timeout after 300s",
    suggestion:
      "Workaround: Deploy from Netlify web UI (app.netlify.com → Add new site → Import from GitHub). CLI auth requires the browser auth to complete within 5 minutes.",
    resolved: true,
  },
  {
    id: "e5",
    level: "error",
    title: "Nightly Research Cron — Session Bound",
    message:
      "Cron job for nightly company research (2:23 AM PDT) is session-bound and will expire after 7 days. Needs re-creation if session restarts.",
    timestamp: "2026-04-08 01:20 PDT",
    source: "OpenClaw → CronCreate",
    suggestion:
      "Re-create cron after each session restart. Consider adding to HEARTBEAT.md as a backup trigger. Long-term: use a persistent scheduler.",
  },
  {
    id: "e6",
    level: "info",
    title: "Google Sheets append — Column Alignment",
    message:
      'gog sheets append puts multi-value data into column A unless --values-json is used with a 2D array. Use "sheets update" with explicit ranges for reliable column placement.',
    timestamp: "2026-04-07 01:15 PDT",
    source: "gog CLI → sheets append",
    suggestion:
      'Always use: gog sheets update <id> "<range>" --values-json \'[["col1","col2","col3"]]\' for precise column control.',
    resolved: true,
  },
];

const levelConfig = {
  error: {
    icon: AlertCircle,
    color: "text-danger",
    bg: "bg-danger/10",
    border: "border-danger/20",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/20",
    label: "Warning",
  },
  info: {
    icon: Info,
    color: "text-info",
    bg: "bg-info/10",
    border: "border-info/20",
    label: "Info",
  },
  resolved: {
    icon: CheckCircle,
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/20",
    label: "Resolved",
  },
};

export default function ErrorsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered =
    filter === "all"
      ? sampleErrors
      : filter === "active"
        ? sampleErrors.filter((e) => !e.resolved)
        : sampleErrors.filter((e) => e.level === filter);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeErrors = sampleErrors.filter((e) => !e.resolved && e.level === "error").length;
  const activeWarnings = sampleErrors.filter((e) => !e.resolved && e.level === "warning").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Errors & Diagnostics
          </h1>
          <p className="text-muted text-sm mt-1">
            Track issues, failed commands, and fixes. Copy errors to help debug.
          </p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm text-muted hover:text-foreground transition-colors">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted">Active Errors</p>
          <p className={`text-2xl font-bold mt-1 ${activeErrors > 0 ? "text-danger" : "text-success"}`}>
            {activeErrors}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted">Warnings</p>
          <p className={`text-2xl font-bold mt-1 ${activeWarnings > 0 ? "text-warning" : "text-success"}`}>
            {activeWarnings}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted">Resolved</p>
          <p className="text-2xl font-bold mt-1 text-success">
            {sampleErrors.filter((e) => e.resolved).length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted">Total Logged</p>
          <p className="text-2xl font-bold mt-1 text-foreground">
            {sampleErrors.length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-muted" />
        {["all", "active", "error", "warning", "info", "resolved"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f
                ? "bg-coreconx text-white"
                : "bg-card border border-border text-muted hover:text-foreground"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Error list */}
      <div className="space-y-3">
        {filtered.map((error) => {
          const config = levelConfig[error.level];
          const Icon = config.icon;
          const isExpanded = expandedId === error.id;

          return (
            <div
              key={error.id}
              className={`rounded-xl border ${config.border} ${config.bg} overflow-hidden`}
            >
              {/* Header row */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : error.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                <Icon size={18} className={config.color} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {error.title}
                    </h3>
                    {error.resolved && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/20 text-success font-medium">
                        RESOLVED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">{error.source} · {error.timestamp}</p>
                </div>
                {isExpanded ? (
                  <ChevronDown size={16} className="text-muted shrink-0" />
                ) : (
                  <ChevronRight size={16} className="text-muted shrink-0" />
                )}
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/30">
                  {/* Message */}
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted mb-1">Message</p>
                    <p className="text-sm text-foreground">{error.message}</p>
                  </div>

                  {/* Stack trace */}
                  {error.stackTrace && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-medium text-muted">Stack Trace / Details</p>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              `${error.title}\n${error.message}\n\n${error.stackTrace}`,
                              error.id
                            )
                          }
                          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-muted hover:text-foreground bg-background/50 border border-border/50 transition-colors"
                        >
                          <Copy size={10} />
                          {copiedId === error.id ? "Copied!" : "Copy for Claude Code"}
                        </button>
                      </div>
                      <pre className="text-xs text-muted bg-background/50 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap">
                        {error.stackTrace}
                      </pre>
                    </div>
                  )}

                  {/* Suggestion */}
                  {error.suggestion && (
                    <div className="rounded-lg bg-background/50 border border-border/30 p-3">
                      <p className="text-xs font-medium text-coreconx-light mb-1">
                        Fix / Suggestion
                      </p>
                      <p className="text-sm text-foreground">{error.suggestion}</p>
                    </div>
                  )}

                  {/* Copy full error */}
                  {!error.stackTrace && (
                    <button
                      onClick={() =>
                        copyToClipboard(
                          `Error: ${error.title}\nSource: ${error.source}\nMessage: ${error.message}\nSuggestion: ${error.suggestion || "N/A"}`,
                          error.id
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-muted hover:text-foreground bg-background/50 border border-border/50 transition-colors"
                    >
                      <Copy size={12} />
                      {copiedId === error.id ? "Copied!" : "Copy error for Claude Code"}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
