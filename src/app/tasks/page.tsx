"use client";

import { useState, useEffect } from "react";
import { CheckSquare, Circle, Clock, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Modal } from "@/components/modal";
import { apiFetch } from "@/lib/api";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "backlog" | "in-progress" | "review" | "done";
  assignee: "Chuck" | "Dylan" | "Marty";
  priority: "low" | "medium" | "high" | "urgent";
  created: string;
  details?: string;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  state: { name: string; color: string } | null;
  assignee: { name: string } | null;
  createdAt: string;
  updatedAt: string;
  project: { name: string } | null;
  labels: { nodes: { name: string; color: string }[] } | null;
}

function mapLinearPriority(p: number): Task["priority"] {
  if (p <= 1) return "urgent";
  if (p === 2) return "high";
  if (p === 3) return "medium";
  return "low";
}

function mapLinearStatus(stateName: string): Task["status"] {
  const lower = stateName.toLowerCase();
  if (lower.includes("done") || lower.includes("completed") || lower.includes("cancelled")) return "done";
  if (lower.includes("review")) return "review";
  if (lower.includes("progress") || lower.includes("started")) return "in-progress";
  return "backlog";
}

function linearToTask(issue: LinearIssue): Task {
  return {
    id: issue.identifier,
    title: issue.title,
    description: issue.description || "",
    status: issue.state ? mapLinearStatus(issue.state.name) : "backlog",
    assignee: (issue.assignee?.name as Task["assignee"]) || "Chuck",
    priority: mapLinearPriority(issue.priority),
    created: new Date(issue.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    details: [
      issue.description,
      issue.project ? `Project: ${issue.project.name}` : null,
      issue.state ? `Status: ${issue.state.name}` : null,
      `Updated: ${new Date(issue.updatedAt).toLocaleDateString()}`,
    ].filter(Boolean).join("\n\n"),
  };
}

const fallbackTasks: Task[] = [
  {
    id: "T-001",
    title: "GitHub repo access",
    description: "Need PAT with repo scope for chuck-ccx to accept Marty's invite to coreconx-web",
    status: "backlog",
    assignee: "Dylan",
    priority: "urgent",
    created: "Apr 7",
    details: "Marty (wundergunder) sent an invite to chuck-ccx on the coreconx-web repo. The invite is pending but Chuck's current GitHub token (fine-grained PAT) doesn't have the 'repository invitations' permission to accept it.\n\nAction needed: Dylan needs to create a new classic PAT on GitHub for chuck-ccx with 'repo' scope, then send it to Chuck via secure channel. Once Chuck has the token, he can accept the invite and start working on the web app.\n\nBlocked: All web app development work.",
  },
  {
    id: "T-002",
    title: "Build Mission Control dashboard",
    description: "Next.js app on Netlify — CRM, tasks, emails, agents, calendar, community",
    status: "in-progress",
    assignee: "Chuck",
    priority: "high",
    created: "Apr 8",
    details: "CoreConX Mission Control — a custom dashboard for Dylan to see everything in one place.\n\nPages built:\n• Dashboard (overview stats, pipeline, activity feed, priorities)\n• CRM (6 verified companies with direct emails)\n• Email Hub (28 templates, founding partner campaign)\n• Task Board (kanban — backlog, in progress, review, done)\n• Legal Docs (21 docs across all phases with modals)\n• Agents (Chuck status, sub-agent registry)\n• Calendar (cron jobs, scheduled tasks)\n• Community (founding partner feature requests)\n• Secure Chat (passphrase-locked)\n• Errors & Diagnostics\n\nDeployed at: coreconx-mission-control.netlify.app\nRepo: github.com/chuck-ccx/coreconx-mission-control\n\nNext: Wire to real data (CRM sheet, Gmail API, Linear).",
  },
  {
    id: "T-003",
    title: "Nightly company research",
    description: "5 companies/night via cron — direct emails for decision makers only",
    status: "in-progress",
    assignee: "Chuck",
    priority: "medium",
    created: "Apr 7",
    details: "Automated nightly research cron job:\n• Runs at 2:23 AM PDT\n• Researches 5 new diamond drilling companies per night\n• Finds decision maker (owner for small companies, ops manager for large)\n• Only adds to CRM if we have a named person + direct email (no info@)\n• Checks for recent intel (projects, hires, events) for personalized outreach\n\nCurrent CRM: 6 companies with verified direct emails.\n\nNote: Cron is session-bound and expires after 7 days. Needs to be re-created if session restarts.",
  },
  {
    id: "T-004",
    title: "Launch founding partner outreach",
    description: "3-email campaign — Buffett method, Hormozi frameworks, testimonial exchange",
    status: "review",
    assignee: "Chuck",
    priority: "high",
    created: "Apr 8",
    details: "3-email founding partner campaign:\n\nEmail 1 (Day 1) — 'The Honest Ask': Opens with flaws, admits it's rough, asks for help. Buffett method.\nEmail 2 (Day 5-7) — 'The Gentle Follow-Up': Respects their time, easy out.\nEmail 3 (Day 12-14) — 'The Last Door': Honest scarcity (10 companies), referral ask, graceful close.\n\nAll emails:\n• No fake social proof\n• No price anchoring (it's free)\n• Testimonial exchange: free app for honest feedback + testimonial\n• CASL compliant (Reply STOP to unsubscribe)\n• Hormozi-aligned (Value Equation, Grand Slam Offer)\n\nReady to send — waiting for Dylan's approval.",
  },
  {
    id: "T-005",
    title: "Legal docs updated",
    description: "21 docs corrected — entity name, pricing, data retention, removed false claims",
    status: "done",
    assignee: "Chuck",
    priority: "high",
    created: "Apr 7",
    details: "21 legal/onboarding documents audited and corrected:\n\n• Entity name: 'CoreConX' (not incorporated)\n• Pricing: Free during early access, $150/mo per user after\n• Data retention: 30 days after termination (consistent everywhere)\n• Removed: SOC 2 claims, security assessment claims, employee training claims\n• Privacy Officer: Dylan Fader\n• Phase 3 docs marked as NOT FOR PUBLICATION\n• All pushed to Google Drive under 'CoreConX Legal & Onboarding' folder",
  },
  {
    id: "T-006",
    title: "Email auth setup",
    description: "SPF + DKIM + DMARC verified. Email aliases routed to chuck@coreconx.group",
    status: "done",
    assignee: "Dylan",
    priority: "high",
    created: "Apr 8",
    details: "Full email authentication stack:\n\n• SPF: ✅ (includes Google via custom SPFM record)\n• DKIM: ✅ (2048-bit key, google._domainkey TXT record in Cloudflare)\n• DMARC: ✅ (p=quarantine)\n\nEmail aliases routed to chuck@coreconx.group:\nsupport@, privacy@, billing@, sales@, accounting@, contracts@, onboarding@, operations@, sedarplus@\n\nDylan's aliases: accounting@, sales@, contracts@, onboarding@, operations@, sedarplus@\n\nDNS managed in Cloudflare.",
  },
  {
    id: "T-007",
    title: "CRM built & populated",
    description: "Google Sheets CRM with 6 verified companies, pipeline, templates, branded",
    status: "done",
    assignee: "Chuck",
    priority: "high",
    created: "Apr 7",
    details: "Google Sheets CRM:\nhttps://docs.google.com/spreadsheets/d/1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak/edit\n\nTabs: Companies, Contacts, Outreach Log, Pipeline, Settings, Email Templates (6 category tabs), Founding Partner Campaign\n\nBranding: CoreConX dark green (#083820) headers, alternating green rows, frozen headers.\n\nRule: No generic emails (info@, admin@). Only named decision makers with direct emails.",
  },
  {
    id: "T-008",
    title: "28 email templates",
    description: "Onboarding, transactional, engagement, marketplace, support, outreach",
    status: "done",
    assignee: "Chuck",
    priority: "medium",
    created: "Apr 7",
    details: "28 email templates across 6 categories:\n\n• Onboarding (6): Welcome, Verification, Password Reset, Trial Started, Trial Expiring (7d + 1d)\n• Transactional (5): Subscription, Invoice, Payment Failed, Cancelled, Plan Change\n• Engagement (4): First Drill, Weekly Summary, Product Update, Inactivity Nudge\n• Marketplace (5): Job Match, Profile Approved, Job Request, Match Intro, Review Request\n• Support (4): Ticket Received, Resolved, Maintenance, Data Export\n• Outreach (4): Cold, Warm Follow-Up, Partnership, Demo Invite\n\nAll Hormozi-aligned. No fake social proof. Testimonial exchange model.",
  },
];

const columns = [
  { id: "backlog" as const, label: "Backlog", icon: Circle, color: "text-muted" },
  { id: "in-progress" as const, label: "In Progress", icon: Clock, color: "text-warning" },
  { id: "review" as const, label: "Review", icon: AlertCircle, color: "text-info" },
  { id: "done" as const, label: "Done", icon: CheckCircle2, color: "text-success" },
];

const priorityColors: Record<string, string> = {
  urgent: "bg-danger/20 text-danger",
  high: "bg-warning/20 text-warning",
  medium: "bg-info/20 text-info",
  low: "bg-border text-muted",
};

const assigneeColors: Record<string, string> = {
  Chuck: "bg-coreconx/20 text-coreconx-light",
  Dylan: "bg-info/20 text-info",
  Marty: "bg-accent-light/20 text-accent-light",
};

export default function TasksPage() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>(fallbackTasks);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"linear" | "fallback">("fallback");

  useEffect(() => {
    apiFetch<LinearIssue[]>("/api/tasks").then((data) => {
      if (data && Array.isArray(data) && data.length > 0) {
        setTasks(data.map(linearToTask));
        setSource("linear");
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CheckSquare size={24} className="text-coreconx-light" />
          Task Board
        </h1>
        <p className="text-muted text-sm mt-1">
          {loading ? (
            <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading from Linear...</span>
          ) : (
            <span>Click any task for details {source === "linear" ? "— Live from Linear" : "— Offline mode"}</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4 min-h-[600px]">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <col.icon size={16} className={col.color} />
                <h3 className="text-sm font-medium text-foreground">
                  {col.label}
                </h3>
                <span className="text-xs text-muted bg-border/50 px-1.5 py-0.5 rounded">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="w-full text-left bg-card border border-border rounded-lg p-4 hover:border-coreconx/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-mono text-muted">
                        {task.id}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          priorityColors[task.priority]
                        }`}
                      >
                        {task.priority}
                      </span>
                    </div>
                    <h4 className="text-sm font-medium text-foreground mt-2">
                      {task.title}
                    </h4>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      {task.description}
                    </p>
                    <div className="flex items-center justify-between mt-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          assigneeColors[task.assignee]
                        }`}
                      >
                        {task.assignee}
                      </span>
                      <span className="text-[10px] text-muted">
                        {task.created}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Detail Modal */}
      <Modal
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        title={selectedTask ? `${selectedTask.id} — ${selectedTask.title}` : ""}
        subtitle={selectedTask?.description}
      >
        {selectedTask && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${priorityColors[selectedTask.priority]}`}>
                {selectedTask.priority}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${assigneeColors[selectedTask.assignee]}`}>
                {selectedTask.assignee}
              </span>
              <span className="text-xs text-muted">Created {selectedTask.created}</span>
            </div>
            <div className="bg-background rounded-lg p-4 border border-border">
              <h4 className="text-xs font-medium text-muted mb-2">Details</h4>
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{selectedTask.details || selectedTask.description}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
