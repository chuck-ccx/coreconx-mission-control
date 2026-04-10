"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  GitPullRequest,
  GitCommit,
  CheckSquare,
  Loader2,
  RefreshCw,
  ExternalLink,
  Clock,
  GitMerge,
  XCircle,
  AlertCircle,
  Bot,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface PR {
  number: number;
  title: string;
  state: string;
  author: { login: string };
  createdAt: string;
  updatedAt: string;
  url: string;
  headRefName: string;
  isDraft: boolean;
  additions: number;
  deletions: number;
  reviewDecision: string;
  repo: string;
}

interface FeedEvent {
  type: "task" | "commit";
  id: string;
  title: string;
  status?: string;
  assignee?: string;
  labels?: string[];
  author?: string;
  repo?: string;
  timestamp: string;
}

interface AgentLog {
  id: string;
  summary: string;
  date: string;
  raw: string;
}

type Tab = "all" | "prs" | "tasks" | "commits" | "agents";

const prStateConfig: Record<string, { icon: typeof GitPullRequest; color: string; label: string }> = {
  OPEN: { icon: GitPullRequest, color: "text-success", label: "Open" },
  MERGED: { icon: GitMerge, color: "text-purple-400", label: "Merged" },
  CLOSED: { icon: XCircle, color: "text-danger", label: "Closed" },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function repoShort(repo: string): string {
  return repo.split("/").pop() || repo;
}

export default function ActivityPage() {
  const [prs, setPrs] = useState<PR[]>([]);
  const [feed, setFeed] = useState<FeedEvent[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [prData, feedData, agentData] = await Promise.all([
      apiFetch<PR[]>("/api/activity/prs"),
      apiFetch<FeedEvent[]>("/api/activity/feed"),
      apiFetch<AgentLog[]>("/api/activity/agents"),
    ]);
    if (prData) setPrs(prData);
    if (feedData) setFeed(feedData);
    if (agentData) setAgentLogs(agentData);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    const interval = setInterval(() => void fetchAll(), 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const openPRs = prs.filter((pr) => pr.state === "OPEN");
  const mergedPRs = prs.filter((pr) => pr.state === "MERGED");
  const taskEvents = feed.filter((e) => e.type === "task");
  const commitEvents = feed.filter((e) => e.type === "commit");

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "all", label: "All Activity" },
    { key: "prs", label: "Pull Requests", count: openPRs.length },
    { key: "tasks", label: "Tasks", count: taskEvents.length },
    { key: "commits", label: "Commits", count: commitEvents.length },
    { key: "agents", label: "Agent Logs", count: agentLogs.length },
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
        <Loader2 size={24} className="text-muted animate-spin" />
        <span className="ml-3 text-sm text-muted">Loading activity...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Activity size={24} className="text-coreconx-light" />
            Activity
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-1">
            Real-time view of PRs, tasks, commits, and agent work
          </p>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-foreground border border-border rounded-lg transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1">
            <GitPullRequest size={14} />
            Open PRs
          </div>
          <p className="text-2xl font-bold text-foreground">{openPRs.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1">
            <GitMerge size={14} />
            Merged
          </div>
          <p className="text-2xl font-bold text-foreground">{mergedPRs.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1">
            <CheckSquare size={14} />
            Tasks Updated
          </div>
          <p className="text-2xl font-bold text-foreground">{taskEvents.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted text-xs mb-1">
            <GitCommit size={14} />
            Commits
          </div>
          <p className="text-2xl font-bold text-foreground">{commitEvents.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-coreconx text-foreground font-medium"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs bg-background border border-border rounded-full px-1.5 py-0.5">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* PR Cards */}
      {(activeTab === "all" || activeTab === "prs") && openPRs.length > 0 && (
        <div className="space-y-3">
          {activeTab === "all" && (
            <h2 className="text-sm font-semibold text-foreground">Open Pull Requests</h2>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {(activeTab === "prs" ? prs : openPRs).map((pr) => {
              const cfg = prStateConfig[pr.state] || prStateConfig.OPEN;
              const Icon = cfg.icon;
              return (
                <div
                  key={`${pr.repo}-${pr.number}`}
                  className="bg-card border border-border rounded-xl p-4 hover:border-coreconx/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <Icon size={18} className={`${cfg.color} mt-0.5 shrink-0`} />
                      <div className="min-w-0">
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-foreground hover:text-coreconx-light transition-colors flex items-center gap-1"
                        >
                          <span className="truncate">{pr.title}</span>
                          <ExternalLink size={12} className="shrink-0 opacity-50" />
                        </a>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                          <span className="font-mono">{repoShort(pr.repo)}#{pr.number}</span>
                          <span>&middot;</span>
                          <span>{pr.headRefName}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-medium ${cfg.color} whitespace-nowrap`}>
                      {pr.isDraft ? "Draft" : cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted">
                    <span>{pr.author?.login}</span>
                    <span className="text-success">+{pr.additions}</span>
                    <span className="text-danger">-{pr.deletions}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      {timeAgo(pr.updatedAt)}
                    </span>
                    {pr.reviewDecision && (
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        pr.reviewDecision === "APPROVED"
                          ? "bg-success/20 text-success"
                          : pr.reviewDecision === "CHANGES_REQUESTED"
                          ? "bg-danger/20 text-danger"
                          : "bg-warning/20 text-warning"
                      }`}>
                        {pr.reviewDecision.replace("_", " ").toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unified Feed */}
      {(activeTab === "all" || activeTab === "tasks" || activeTab === "commits") && (
        <div className="space-y-3">
          {activeTab === "all" && (
            <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          )}
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {(activeTab === "tasks" ? taskEvents : activeTab === "commits" ? commitEvents : feed)
              .slice(0, activeTab === "all" ? 15 : 50)
              .map((event, i) => (
                <div key={`${event.type}-${event.id}-${i}`} className="px-4 py-3 flex items-start gap-3">
                  {event.type === "task" ? (
                    <CheckSquare size={16} className="text-coreconx-light mt-0.5 shrink-0" />
                  ) : (
                    <GitCommit size={16} className="text-muted mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted">{event.id}</span>
                      {event.type === "task" && event.status && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          event.status === "Done" ? "bg-success/20 text-success" :
                          event.status === "In Progress" ? "bg-coreconx/20 text-coreconx-light" :
                          event.status === "Canceled" ? "bg-danger/20 text-danger" :
                          "bg-background text-muted"
                        }`}>
                          {event.status}
                        </span>
                      )}
                      {event.type === "commit" && event.repo && (
                        <span className="text-xs text-muted">{repoShort(event.repo)}</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground mt-0.5 truncate">{event.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted">
                      {event.assignee && <span>{event.assignee}</span>}
                      {event.author && <span>{event.author}</span>}
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {timeAgo(event.timestamp)}
                      </span>
                      {event.labels && event.labels.length > 0 && (
                        <div className="flex gap-1">
                          {event.labels.map((label) => (
                            <span
                              key={label}
                              className="px-1.5 py-0.5 rounded text-xs bg-background border border-border"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            {feed.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted">
                <AlertCircle size={20} className="mx-auto mb-2 opacity-50" />
                No activity data available. API may be offline.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agent Logs */}
      {(activeTab === "all" || activeTab === "agents") && agentLogs.length > 0 && (
        <div className="space-y-3">
          {activeTab === "all" && (
            <h2 className="text-sm font-semibold text-foreground">Agent Work Log</h2>
          )}
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {agentLogs.map((log, i) => (
              <div key={`${log.id}-${i}`} className="px-4 py-3 flex items-start gap-3">
                <Bot size={16} className="text-coreconx-light mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted">{log.id}</span>
                    <span className="text-xs text-muted">{log.date}</span>
                  </div>
                  <p className="text-sm text-foreground mt-0.5">{log.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
