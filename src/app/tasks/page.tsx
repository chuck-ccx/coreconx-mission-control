import { CheckSquare, Circle, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

interface Task {
  id: string;
  title: string;
  description: string;
  status: "backlog" | "in-progress" | "review" | "done";
  assignee: "Chuck" | "Dylan" | "Marty";
  priority: "low" | "medium" | "high" | "urgent";
  created: string;
}

const tasks: Task[] = [
  {
    id: "T-001",
    title: "GitHub repo access",
    description: "Need PAT with repo scope for chuck-ccx to accept Marty's invite to coreconx-web",
    status: "backlog",
    assignee: "Dylan",
    priority: "urgent",
    created: "Apr 7",
  },
  {
    id: "T-002",
    title: "Build Mission Control dashboard",
    description: "Next.js app on Netlify — CRM, tasks, emails, agents, calendar, community",
    status: "in-progress",
    assignee: "Chuck",
    priority: "high",
    created: "Apr 8",
  },
  {
    id: "T-003",
    title: "Nightly company research",
    description: "5 companies/night via cron — direct emails for decision makers only",
    status: "in-progress",
    assignee: "Chuck",
    priority: "medium",
    created: "Apr 7",
  },
  {
    id: "T-004",
    title: "Launch founding partner outreach",
    description: "3-email campaign — Buffett method, Hormozi frameworks, testimonial exchange",
    status: "review",
    assignee: "Chuck",
    priority: "high",
    created: "Apr 8",
  },
  {
    id: "T-005",
    title: "Legal docs updated",
    description: "21 docs corrected — entity name, pricing, data retention, removed false claims",
    status: "done",
    assignee: "Chuck",
    priority: "high",
    created: "Apr 7",
  },
  {
    id: "T-006",
    title: "Email auth setup",
    description: "SPF + DKIM + DMARC verified. Email aliases routed to chuck@coreconx.group",
    status: "done",
    assignee: "Dylan",
    priority: "high",
    created: "Apr 8",
  },
  {
    id: "T-007",
    title: "CRM built & populated",
    description: "Google Sheets CRM with 6 verified companies, pipeline, templates, branded",
    status: "done",
    assignee: "Chuck",
    priority: "high",
    created: "Apr 7",
  },
  {
    id: "T-008",
    title: "28 email templates",
    description: "Onboarding, transactional, engagement, marketplace, support, outreach",
    status: "done",
    assignee: "Chuck",
    priority: "medium",
    created: "Apr 7",
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
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CheckSquare size={24} className="text-coreconx-light" />
          Task Board
        </h1>
        <p className="text-muted text-sm mt-1">
          What&apos;s being worked on, what&apos;s blocked, what&apos;s done
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
                  <div
                    key={task.id}
                    className="bg-card border border-border rounded-lg p-4 hover:border-coreconx/40 transition-colors"
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
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
