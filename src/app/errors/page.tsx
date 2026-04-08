"use client";

import { useState, useEffect, useCallback } from "react";
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
  Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ErrorEntry {
  id: string;
  level: "error" | "warning" | "info" | "resolved";
  title: string;
  message: string;
  timestamp: string;
  source: string;
  suggestion?: string;
  resolved?: boolean;
}

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
  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchErrors = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const data = await apiFetch<ErrorEntry[]>("/api/errors");
    if (data) {
      setErrors(data);
      setLastUpdated(new Date());
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchErrors();
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => fetchErrors(), 60000);
    return () => clearInterval(interval);
  }, [fetchErrors]);

  const resolveError = async (id: string) => {
    await apiFetch(`/api/errors/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ resolved: true }),
    });
    fetchErrors(true);
  };

  const filtered =
    filter === "all"
      ? errors
      : filter === "active"
        ? errors.filter((e) => !e.resolved)
        : errors.filter((e) => e.level === filter);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeErrors = errors.filter((e) => !e.resolved && e.level === "error").length;
  const activeWarnings = errors.filter((e) => !e.resolved && e.level === "warning").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Errors & Diagnostics
          </h1>
          <p className="text-muted text-sm mt-1">
            Live error tracking from Google Sheets.
            {lastUpdated && (
              <span className="ml-2 text-xs opacity-60">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchErrors(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border text-sm text-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted">Active Errors</p>
          <p className={`text-2xl font-bold mt-1 ${activeErrors > 0 ? "text-danger" : "text-success"}`}>
            {loading ? "..." : activeErrors}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted">Warnings</p>
          <p className={`text-2xl font-bold mt-1 ${activeWarnings > 0 ? "text-warning" : "text-success"}`}>
            {loading ? "..." : activeWarnings}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted">Resolved</p>
          <p className="text-2xl font-bold mt-1 text-success">
            {loading ? "..." : errors.filter((e) => e.resolved).length}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted">Total Logged</p>
          <p className="text-2xl font-bold mt-1 text-foreground">
            {loading ? "..." : errors.length}
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

      {/* Loading state */}
      {loading && (
        <div className="text-center py-12 text-muted">
          <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
          <p className="text-sm">Loading errors...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted">
          <CheckCircle size={32} className="mx-auto mb-2 text-success" />
          <p className="text-sm">No errors found. All clear!</p>
        </div>
      )}

      {/* Error list */}
      <div className="space-y-3">
        {filtered.map((error) => {
          const config = levelConfig[error.level] || levelConfig.info;
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

                  {/* Suggestion */}
                  {error.suggestion && (
                    <div className="rounded-lg bg-background/50 border border-border/30 p-3">
                      <p className="text-xs font-medium text-coreconx-light mb-1">
                        Fix / Suggestion
                      </p>
                      <p className="text-sm text-foreground">{error.suggestion}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
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
                      {copiedId === error.id ? "Copied!" : "Copy error"}
                    </button>
                    {!error.resolved && (
                      <button
                        onClick={() => resolveError(error.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-success hover:bg-success/10 bg-background/50 border border-border/50 transition-colors"
                      >
                        <Check size={12} />
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
