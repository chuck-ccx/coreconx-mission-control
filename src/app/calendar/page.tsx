"use client";

import { useState, useEffect } from "react";
import { Calendar, Clock, Repeat, Bell, Loader2 } from "lucide-react";
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

const upcomingMilestones = [
  {
    date: "Apr 2026",
    title: "Launch Founding Partner Outreach",
    description: "Send 3-email campaign to 6 verified contacts",
    status: "Ready",
  },
  {
    date: "Apr 2026",
    title: "Web App Repo Access",
    description: "Accept GitHub invite, start reviewing coreconx-web codebase",
    status: "Blocked",
  },
  {
    date: "May 2026",
    title: "First 10 Founding Partners",
    description: "Onboard companies, collect feedback, build testimonials",
    status: "Upcoming",
  },
  {
    date: "Q3 2026",
    title: "App Store Launch",
    description: "Mobile app published on App Store and Google Play",
    status: "Planned",
  },
  {
    date: "Q4 2026",
    title: "Marketplace MVP",
    description: "Connect mines with drill contractors — $1/meter model",
    status: "Planned",
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
  Ready: "text-success",
  Blocked: "text-danger",
  Upcoming: "text-warning",
  Planned: "text-muted",
};

export default function CalendarPage() {
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loadingCal, setLoadingCal] = useState(true);

  useEffect(() => {
    apiFetch<CalendarEvent[]>("/api/calendar/events").then((data) => {
      if (data && Array.isArray(data)) setCalendarEvents(data);
      setLoadingCal(false);
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar size={24} className="text-coreconx-light" />
          Calendar & Schedule
        </h1>
        <p className="text-muted text-sm mt-1">
          Cron jobs, scheduled tasks, and upcoming milestones
        </p>
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

      {/* Roadmap / Milestones */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground">Roadmap</h2>
        <div className="mt-4 space-y-0">
          {upcomingMilestones.map((milestone, i) => (
            <div key={milestone.title} className="flex gap-4">
              {/* Timeline line */}
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full bg-coreconx-light border-2 border-coreconx-dark" />
                {i < upcomingMilestones.length - 1 && (
                  <div className="w-0.5 flex-1 bg-border" />
                )}
              </div>
              {/* Content */}
              <div className="pb-6">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted">
                    {milestone.date}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      milestoneStatusColors[milestone.status]
                    }`}
                  >
                    {milestone.status}
                  </span>
                </div>
                <h3 className="text-sm font-medium text-foreground mt-1">
                  {milestone.title}
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  {milestone.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
