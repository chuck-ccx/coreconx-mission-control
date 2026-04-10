"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Brain,
  AlertTriangle,
  Calendar,
  Bot,
  BookOpen,
  Zap,
  Shield,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3100";
const TOKEN = process.env.NEXT_PUBLIC_MC_API_TOKEN || "";

interface Mistake { title: string; body: string }
interface DailyLog { date: string; content: string }
interface MemorySection { title: string; content: string }
interface AgentInfo { id: string; name: string; purpose: string; tier: string }

async function fetchBrain(endpoint: string) {
  const res = await fetch(`${API}/api/brain/${endpoint}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function Section({ title, icon: Icon, children, defaultOpen = false }: {
  title: string;
  icon: typeof Brain;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
      >
        <Icon size={20} className="text-coreconx shrink-0" />
        <span className="font-semibold text-foreground flex-1">{title}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-border pt-3">{children}</div>}
    </div>
  );
}

export default function BrainPage() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [workingCtx, setWorkingCtx] = useState("");
  const [memory, setMemory] = useState<MemorySection[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [rules, setRules] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [m, d, w, mem, ag, r] = await Promise.all([
      fetchBrain("mistakes"),
      fetchBrain("daily"),
      fetchBrain("working-context"),
      fetchBrain("memory"),
      fetchBrain("agents"),
      fetchBrain("cross-agent-rules"),
    ]);
    if (m) setMistakes(m);
    if (d) setDailyLogs(d);
    if (w) setWorkingCtx(w.content || "");
    if (mem) setMemory(mem);
    if (ag) setAgents(ag.agents || []);
    if (r) setRules(r.content || "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-coreconx" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Brain size={28} className="text-coreconx" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chuck&apos;s Brain</h1>
            <p className="text-sm text-muted">Memory, mistakes, agents, and active context</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 bg-coreconx text-white rounded-lg hover:bg-coreconx/90 transition-colors text-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Working Context — always visible */}
      <div className="bg-gradient-to-r from-coreconx/10 to-transparent border border-coreconx/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={18} className="text-coreconx" />
          <h2 className="font-semibold text-foreground">Live Working Context</h2>
        </div>
        <pre className="text-sm text-muted whitespace-pre-wrap font-mono leading-relaxed">
          {workingCtx || "No active working context."}
        </pre>
      </div>

      <div className="grid gap-4">
        <Section title={`Mistakes (${mistakes.length})`} icon={AlertTriangle} defaultOpen>
          {mistakes.length === 0 ? (
            <p className="text-muted text-sm">No mistakes logged yet.</p>
          ) : (
            <div className="space-y-3">
              {mistakes.map((m, i) => (
                <div key={i} className="border-l-2 border-red-500/50 pl-3">
                  <h3 className="text-sm font-medium text-foreground">{m.title}</h3>
                  <pre className="text-xs text-muted whitespace-pre-wrap mt-1">{m.body}</pre>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={`Daily Logs (${dailyLogs.length} days)`} icon={Calendar}>
          {dailyLogs.length === 0 ? (
            <p className="text-muted text-sm">No daily logs found.</p>
          ) : (
            <div className="space-y-4">
              {dailyLogs.map((log) => (
                <div key={log.date}>
                  <h3 className="text-sm font-semibold text-coreconx mb-1">{log.date}</h3>
                  <pre className="text-xs text-muted whitespace-pre-wrap font-mono bg-muted/20 rounded p-2 max-h-48 overflow-y-auto">
                    {log.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={`Long-Term Memory (${memory.length} sections)`} icon={BookOpen}>
          {memory.length === 0 ? (
            <p className="text-muted text-sm">No memory sections found.</p>
          ) : (
            <div className="space-y-3">
              {memory.map((s, i) => (
                <div key={i} className="border-l-2 border-coreconx/50 pl-3">
                  <h3 className="text-sm font-medium text-foreground">{s.title}</h3>
                  <pre className="text-xs text-muted whitespace-pre-wrap mt-1">{s.content}</pre>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={`Agents (${agents.length})`} icon={Bot}>
          {agents.length === 0 ? (
            <p className="text-muted text-sm">No agents registered.</p>
          ) : (
            <div className="grid gap-2">
              {agents.map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-2 rounded bg-muted/20">
                  <Bot size={16} className="text-coreconx mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{a.name}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{a.tier}</span>
                    </div>
                    <p className="text-xs text-muted truncate">{a.purpose}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Cross-Agent Rules" icon={Shield}>
          <pre className="text-xs text-muted whitespace-pre-wrap font-mono bg-muted/20 rounded p-2">
            {rules || "No cross-agent rules defined."}
          </pre>
        </Section>
      </div>
    </div>
  );
}
