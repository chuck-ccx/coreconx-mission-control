"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, Repeat, Bell, Loader2, RefreshCw, CheckCircle2, Circle } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ScheduledTask {
  id: string;
  name: string;
  schedule: string;
  nextRun: string;
  type: "cron" | "one-time" | "recurring";
  status: "active" | "paused" | "expired";
  description: string;
}

interface CalendarEvent {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  description?: string;
  status?: string;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  dueDate: string | null;
  state: { id: string; name: string; color: string; type: string } | null;
  assignee: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string } | null;
  labels: { nodes: { name: string; color: string }[] } | null;
}

const scheduledTasks: ScheduledTask[] = [
  {
    id: "cron-001",
    name: "Nightly Company Research",
    schedule: "Every day at 2:23 AM PDT",
    nextRun: "Tonight",
    type: "cron",
    status: "active",
    description:
      "Research 5 new diamond drilling companies. Find decision makers with direct emails. Add recent intel for personalized outreach.",
  },
  {
    id: "cron-002",
    name: "Email Inbox Check",
    schedule: "Every 4 hours",
    nextRun: "Pending setup",
    type: "recurring",
    status: "paused",
    description:
      "Check chuck@coreconx.group and all aliases for incoming emails. Flag anything important to Dylan via Discord.",
  },
  {
    id: "cron-003",
    name: "CRM Data Enrichment",
    schedule: "Weekly — Sundays at 10 PM",
    nextRun: "Pending setup",
    type: "cron",
    status: "paused",
    description:
      "Review all CRM entries. Update company info, check for news, verify emails still work, update lead scores.",
  },
];

const typeIcons = {
  cron: Repeat,
  "one-time": Bell,
  recurring: Clock,
};

const statusColors = {
  active: "bg-success/20 text-success",
  paused: "bg-warning/20 text-warning",
  expired: "bg-danger/20 text-danger",
};

const milestoneStatusColors: Record<string, string> = {
  completed: "text-success",
  started: "text-warning",
  unstarted: "text-foreground",
  backlog: "text-muted",
};

const milestoneStatusLabels: Record<string, string> = {
  completed: "Done",
  started: "In Progress",
  unstarted: "Todo",
  backlog: "Backlog",
};

export default function CalendarPage() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingCal, setLoadingCal] = useState(true);
  const [tasks, setTasks] = useState<LinearIssue[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    const [calData, tasksData] = await Promise.all([
      apiFetch<CalendarEvent[]>("/api/calendar/events"),
      apiFetch<LinearIssue[]>("/api/tasks"),
    ]);

    if (calData && Array.isArray(calData)) setCalendarEvents(calData);
    setLoadingCal(false);

    if (tasksData && Array.isArray(tasksData)) setTasks(tasksData);
    setLoadingTasks(false);

    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchAll(true), 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Tasks with due dates, sorted by due date
  const tasksWithDueDates = tasks
    .filter((t) => t.dueDate && t.state?.type !== "completed")
    .sort((a, b) => (a.dueDate! > b.dueDate! ? 1 : -1));

  // Milestones: tasks tagged "Milestone" or from a project, sorted by due date then creation date
  const milestones = tasks
    .filter(
      (t) =>
        t.labels?.nodes?.some((l) => l.name.toLowerCase().includes("milestone")) ||
        t.project != null
    )
    .sort((a, b) => {
      const aDate = a.dueDate || a.createdAt;
      const bDate = b.dueDate || b.createdAt;
      return aDate > bDate ? 1 : -1;
    });

  const formatDueDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    const now = new Date();
    const diffDays = Math.ceil(
      (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const formatted = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
    if (diffDays < 0) return { text: formatted, urgent: true, label: "Overdue" };
    if (diffDays === 0) return { text: formatted, urgent: true, label: "Today" };
    if (diffDays === 1) return { text: formatted, urgent: false, label: "Tomorrow" };
    if (diffDays <= 7) return { text: formatted, urgent: false, label: `${diffDays}d` };
    return { text: formatted, urgent: false, label: "" };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar size={24} className="text-coreconx-light" />
            Calendar & Schedule
          </h1>
          <p className="text-muted text-sm mt-1">
            Cron jobs, scheduled tasks, and upcoming milestones
          </p>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-card border border-border rounded-lg hover:border-coreconx/40 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Scheduled Tasks */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground">
          Scheduled Tasks
        </h2>
        <div className="mt-4 space-y-3">
          {scheduledTasks.map((task) => {
            const Icon = typeIcons[task.type];
            return (
              <div
                key={task.id}
                className="flex items-start gap-4 p-4 rounded-lg border border-border bg-background hover:border-coreconx/40 transition-colors"
              >
                <div className="p-2 rounded-lg bg-coreconx/10">
                  <Icon size={18} className="text-coreconx-light" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-foreground">
                      {task.name}
                    </h3>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        statusColors[task.status]
                      }`}
                    >
                      {task.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">{task.description}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs font-mono text-muted">
                      {task.schedule}
                    </span>
                    <span className="text-xs text-muted">
                      Next: {task.nextRun}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Google Calendar Events */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground">
          Upcoming Events
        </h2>
        <p className="text-xs text-muted mt-1">Live from Google Calendar</p>
        {loadingCal ? (
          <div className="mt-4 flex items-center gap-2 text-muted">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading calendar...</span>
          </div>
        ) : calendarEvents.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No upcoming events</p>
        ) : (
          <div className="mt-4 space-y-3">
            {calendarEvents.map((event, i) => {
              const startStr = event.start?.dateTime || event.start?.date || "";
              const startDate = startStr ? new Date(startStr) : null;
              return (
                <div
                  key={event.id || i}
                  className="flex items-start gap-4 p-4 rounded-lg border border-border bg-background"
                >
                  <div className="flex-shrink-0 text-center min-w-[50px]">
                    {startDate && (
                      <>
                        <p className="text-xs font-mono text-muted">
                          {startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </p>
                        <p className="text-xs font-mono text-muted">
                          {startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-foreground">
                      {event.summary || "(no title)"}
                    </h3>
                    {event.location && (
                      <p className="text-xs text-muted mt-0.5">{event.location}</p>
                    )}
                    {event.description && (
                      <p className="text-xs text-muted/70 mt-1 line-clamp-2">{event.description}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tasks with Due Dates */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground">
          Task Deadlines
        </h2>
        <p className="text-xs text-muted mt-1">Tasks with due dates from Linear</p>
        {loadingTasks ? (
          <div className="mt-4 flex items-center gap-2 text-muted">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading tasks...</span>
          </div>
        ) : tasksWithDueDates.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No tasks with upcoming due dates</p>
        ) : (
          <div className="mt-4 space-y-3">
            {tasksWithDueDates.map((task) => {
              const due = formatDueDate(task.dueDate!);
              return (
                <div
                  key={task.id}
                  className="flex items-start gap-4 p-4 rounded-lg border border-border bg-background hover:border-coreconx/40 transition-colors"
                >
                  <div className="flex-shrink-0 text-center min-w-[50px]">
                    <p className={`text-xs font-mono ${due.urgent ? "text-danger font-bold" : "text-muted"}`}>
                      {due.text}
                    </p>
                    {due.label && (
                      <p className={`text-[10px] font-medium mt-0.5 ${due.urgent ? "text-danger" : "text-warning"}`}>
                        {due.label}
                      </p>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted">{task.identifier}</span>
                      {task.state && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: task.state.color + "20", color: task.state.color }}
                        >
                          {task.state.name}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-foreground mt-1">
                      {task.title}
                    </h3>
                    {task.assignee && (
                      <p className="text-[10px] text-muted mt-1">
                        Assigned to {task.assignee.name}
                      </p>
                    )}
                    {task.project && (
                      <p className="text-[10px] text-muted mt-0.5">
                        Project: {task.project.name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Roadmap / Milestones — from Linear */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground">Roadmap</h2>
        <p className="text-xs text-muted mt-1">Milestones and project tasks from Linear</p>
        {loadingTasks ? (
          <div className="mt-4 flex items-center gap-2 text-muted">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading milestones...</span>
          </div>
        ) : milestones.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            No milestones found. Tag tasks with &quot;Milestone&quot; in Linear or assign them to a project.
          </p>
        ) : (
          <div className="mt-4 space-y-0">
            {milestones.map((milestone, i) => {
              const stateType = milestone.state?.type || "backlog";
              const statusColor = milestoneStatusColors[stateType] || "text-muted";
              const statusLabel = milestoneStatusLabels[stateType] || stateType;
              const dateStr = milestone.dueDate
                ? new Date(milestone.dueDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : milestone.project?.name || "No date";

              return (
                <div key={milestone.id} className="flex gap-4">
                  {/* Timeline line */}
                  <div className="flex flex-col items-center">
                    {stateType === "completed" ? (
                      <CheckCircle2 size={14} className="text-success mt-0.5" />
                    ) : stateType === "started" ? (
                      <Clock size={14} className="text-warning mt-0.5" />
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-coreconx-light border-2 border-coreconx-dark mt-0.5" />
                    )}
                    {i < milestones.length - 1 && (
                      <div className="w-0.5 flex-1 bg-border" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-6">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-muted">
                        {dateStr}
                      </span>
                      <span className={`text-xs font-medium ${statusColor}`}>
                        {statusLabel}
                      </span>
                      <span className="text-[10px] font-mono text-muted">
                        {milestone.identifier}
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-foreground mt-1">
                      {milestone.title}
                    </h3>
                    {milestone.description && (
                      <p className="text-xs text-muted mt-0.5 line-clamp-2">
                        {milestone.description}
                      </p>
                    )}
                    {milestone.labels?.nodes && milestone.labels.nodes.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {milestone.labels.nodes.map((l) => (
                          <span
                            key={l.name}
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: l.color + "20", color: l.color }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
