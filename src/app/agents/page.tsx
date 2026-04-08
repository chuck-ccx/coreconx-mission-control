import { Bot, Cpu, Activity, Zap } from "lucide-react";

interface Agent {
  name: string;
  role: string;
  model: string;
  status: "online" | "idle" | "offline";
  currentTask: string | null;
  tasksCompleted: number;
}

const agents: Agent[] = [
  {
    name: "Chuck",
    role: "COO — Operations & Strategy",
    model: "Claude Opus 4",
    status: "online",
    currentTask: "Building Mission Control dashboard",
    tasksCompleted: 47,
  },
  {
    name: "Nightly Researcher",
    role: "CRM enrichment — 5 companies/night",
    model: "Claude Haiku",
    status: "idle",
    currentTask: null,
    tasksCompleted: 2,
  },
];

const statusConfig = {
  online: { color: "bg-success", label: "Online", textColor: "text-success" },
  idle: { color: "bg-warning", label: "Idle", textColor: "text-warning" },
  offline: { color: "bg-muted", label: "Offline", textColor: "text-muted" },
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
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bot size={24} className="text-coreconx-light" />
          Agents & Stack
        </h1>
        <p className="text-muted text-sm mt-1">
          Who&apos;s working, what they&apos;re running on, and the tools behind CoreConX
        </p>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <div
            key={agent.name}
            className="bg-card border border-border rounded-xl p-5 hover:border-coreconx/40 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-coreconx/20 flex items-center justify-center">
                  <Bot size={24} className="text-coreconx-light" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-muted">{agent.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    statusConfig[agent.status].color
                  } ${agent.status === "online" ? "animate-pulse" : ""}`}
                />
                <span
                  className={`text-xs font-medium ${
                    statusConfig[agent.status].textColor
                  }`}
                >
                  {statusConfig[agent.status].label}
                </span>
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
                <Activity size={14} className="text-muted" />
                <span className="text-sm text-foreground">
                  {agent.currentTask || "No active task"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-muted" />
                <span className="text-sm text-muted">
                  {agent.tasksCompleted} tasks completed
                </span>
              </div>
            </div>
          </div>
        ))}
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
