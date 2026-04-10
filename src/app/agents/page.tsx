"use client";

import { useState, useEffect } from "react";
import { Bot, Cpu, Activity, Zap, Loader2, Wifi, WifiOff } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Agent {
  id: string;
  name: string;
  role: string;
  model: string;
  status: "active" | "idle" | "error";
  taskCount: number;
  lastActive: string | null;
  techStack: string[];
  enabled: boolean;
}

interface ApiStatus {
  status: string;
  uptime: number;
  memory: string;
  services: {
    gmail: string;
    linear: string;
    sheets: string;
  };
  timestamp: string;
}

const statusConfig = {
  active: { color: "bg-success", label: "Active", textColor: "text-success" },
  idle: { color: "bg-warning", label: "Idle", textColor: "text-warning" },
  error: { color: "bg-danger", label: "Error", textColor: "text-danger" },
};

const techStack = [
  { name: "Next.js", category: "Frontend" },
  { name: "Tailwind CSS", category: "Frontend" },
  { name: "TypeScript", category: "Frontend" },
  { name: "OpenClaw", category: "Agent Runtime" },
  { name: "Claude Opus 4", category: "Brain Model" },
  { name: "Claude Haiku", category: "Worker Model" },
  { name: "Google Workspace", category: "Tools" },
  { name: "Linear", category: "Project Tracking" },
  { name: "GitHub", category: "Version Control" },
  { name: "Supabase", category: "Database (Planned)" },
  { name: "Netlify", category: "Hosting" },
  { name: "Cloudflare", category: "DNS" },
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<ApiStatus>("/api/status"),
      apiFetch<Agent[]>("/api/agents"),
    ]).then(([statusData, agentsData]) => {
      if (statusData) setApiStatus(statusData);
      if (agentsData) setAgents(agentsData);
      setLoading(false);
    });
  }, []);

  const toggleAgent = async (id: string, currentEnabled: boolean) => {
    setToggling(id);
    const result = await apiFetch<{ id: string; enabled: boolean }>(
      `/api/agents/${id}/toggle`,
      { method: "PUT", body: JSON.stringify({ enabled: !currentEnabled }) }
    );
    if (result) {
      setAgents((prev) =>
        prev.map((a) => a.id === id ? { ...a, enabled: result.enabled } : a)
      );
    }
    setToggling(null);
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
          <Bot size={24} className="text-coreconx-light" />
          Agents & Stack
        </h1>
        <p className="text-muted text-xs sm:text-sm mt-1">
          Who&apos;s working, what they&apos;re running on, and the tools behind CoreConX
        </p>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading && agents.length === 0 ? (
          <div className="col-span-full flex items-center justify-center py-8">
            <Loader2 size={20} className="text-muted animate-spin" />
            <span className="ml-2 text-sm text-muted">Loading agents...</span>
          </div>
        ) : agents.length === 0 ? (
          <div className="col-span-full text-sm text-muted text-center py-8">
            No agents found. API may be offline.
          </div>
        ) : agents.map((agent) => {
          const cfg = statusConfig[agent.status] || statusConfig.idle;
          return (
          <div
            key={agent.id}
            className="bg-card border border-border rounded-xl p-5 hover:border-coreconx/40 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${agent.enabled ? 'bg-coreconx/20' : 'bg-muted/20'}`}>
                  <Bot size={24} className={agent.enabled ? "text-coreconx-light" : "text-muted"} />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${agent.enabled ? 'text-foreground' : 'text-muted'}`}>
                    {agent.name}
                  </h3>
                  <p className="text-xs text-muted">{agent.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${agent.enabled ? cfg.color : 'bg-muted/50'} ${agent.status === "active" && agent.enabled ? "animate-pulse" : ""}`}
                  />
                  <span
                    className={`text-xs font-medium ${agent.enabled ? cfg.textColor : 'text-muted'}`}
                  >
                    {agent.enabled ? cfg.label : "Off"}
                  </span>
                </div>
                {agent.id !== "chuck" && (
                  <button
                    onClick={() => toggleAgent(agent.id, agent.enabled)}
                    disabled={toggling === agent.id}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-coreconx/50 ${
                      agent.enabled ? 'bg-coreconx' : 'bg-border'
                    } ${toggling === agent.id ? 'opacity-50' : ''}`}
                    title={agent.enabled ? "Disable agent" : "Enable agent"}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        agent.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Cpu size={14} className="text-muted" />
                <span className="text-sm text-foreground font-mono">
                  {agent.model}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-muted" />
                <span className="text-sm text-muted">
                  {agent.taskCount} assigned task{agent.taskCount !== 1 ? "s" : ""}
                </span>
              </div>
              {agent.lastActive && (
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-muted" />
                  <span className="text-sm text-muted">
                    Last active: {new Date(agent.lastActive).toLocaleString()}
                  </span>
                </div>
              )}
              {agent.techStack.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {agent.techStack.map((tech) => (
                    <span key={tech} className="text-xs px-2 py-0.5 rounded-full bg-background border border-border text-muted">
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>

      {/* Live Service Status */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Service Status</h2>
          {loading ? (
            <Loader2 size={16} className="text-muted animate-spin" />
          ) : apiStatus ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Wifi size={14} className="text-success" />
              <span className="text-xs text-success font-medium">API Online</span>
              <span className="text-xs text-muted hidden sm:inline">— {formatUptime(apiStatus.uptime)} uptime, {apiStatus.memory}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <WifiOff size={14} className="text-danger" />
              <span className="text-xs text-danger font-medium">API Offline</span>
            </div>
          )}
        </div>
        {apiStatus && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(apiStatus.services).map(([name, status]) => (
              <div key={name} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                <div className={`w-2.5 h-2.5 rounded-full ${status === "connected" ? "bg-success" : "bg-danger"}`} />
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">{name}</p>
                  <p className="text-xs text-muted">{status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mission Statement */}
      <div className="bg-coreconx/10 border border-coreconx/30 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground">Mission</h2>
        <p className="text-sm text-foreground/80 mt-2 leading-relaxed">
          Build CoreConX into the operating system for diamond drilling — track
          performance, connect mines with contractors, and give every driller
          the tools they deserve. Start with 10 founding partners, prove the
          value, then scale.
        </p>
      </div>

      {/* Tech Stack */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground">Tech Stack</h2>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {techStack.map((tool) => (
            <div
              key={tool.name}
              className="p-3 rounded-lg border border-border bg-background"
            >
              <p className="text-sm font-medium text-foreground">{tool.name}</p>
              <p className="text-xs text-muted mt-0.5">{tool.category}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Model Tier Strategy */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground">
          Model Strategy
        </h2>
        <p className="text-xs text-muted mt-1">
          &quot;What&apos;s the cheapest model that gets this right?&quot;
        </p>
        <div className="mt-4 space-y-3">
          {[
            {
              tier: "Tier 3 — Brain",
              model: "Claude Opus 4",
              use: "Strategy, judgment, reviews, complex decisions",
              color: "bg-warning",
            },
            {
              tier: "Tier 2 — Muscle",
              model: "Claude Haiku / Flash",
              use: "Structured tasks, research, multi-step workflows",
              color: "bg-info",
            },
            {
              tier: "Tier 1 — Grunt",
              model: "DeepSeek / Llama / Gemma",
              use: "Formatting, simple lookups, repetitive tasks",
              color: "bg-success",
            },
          ].map((tier) => (
            <div key={tier.tier} className="flex items-center gap-4">
              <div className={`w-2 h-8 rounded-full ${tier.color}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {tier.tier}
                  </span>
                  <span className="text-xs font-mono text-muted">
                    {tier.model}
                  </span>
                </div>
                <p className="text-xs text-muted">{tier.use}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
