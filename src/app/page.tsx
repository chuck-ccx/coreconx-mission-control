"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Mail,
  CheckSquare,
  Bot,
  TrendingUp,
  Clock,
  Target,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/stat-card";
import { apiFetch } from "@/lib/api";

interface Company {
  "Company Name": string;
  "Lead Status": string;
  [key: string]: string;
}

export default function Dashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [apiOnline, setApiOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await apiFetch<Company[]>("/api/crm/companies");
      if (data) {
        setCompanies(data);
        setApiOnline(true);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Count pipeline stages from live data
  const pipelineCounts = {
    Research: 0,
    "Cold Outreach": 0,
    Warm: 0,
    Demo: 0,
    Customer: 0,
  };
  companies.forEach((c) => {
    const status = c["Lead Status"] || "Research";
    if (status in pipelineCounts) {
      pipelineCounts[status as keyof typeof pipelineCounts]++;
    } else {
      pipelineCounts.Research++;
    }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted text-sm mt-1">
            CoreConX Mission Control — overview of everything happening
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              apiOnline ? "bg-success" : "bg-danger"
            }`}
          />
          <span className="text-xs text-muted">
            {loading ? "Connecting..." : apiOnline ? "API Live" : "API Offline"}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="CRM Contacts"
          value={apiOnline ? companies.length : "—"}
          subtitle={apiOnline ? "Verified direct emails" : "Connecting..."}
          icon={<Users size={20} />}
          trend={
            apiOnline
              ? { value: `${companies.length} companies loaded`, positive: true }
              : undefined
          }
          href="/crm"
        />
        <StatCard
          title="Emails Sent"
          value={0}
          subtitle="Campaign not started"
          icon={<Mail size={20} />}
          href="/emails"
        />
        <StatCard
          title="Active Tasks"
          value={3}
          subtitle="Doc updates, research, dashboard"
          icon={<CheckSquare size={20} />}
          href="/tasks"
        />
        <StatCard
          title="Agents Online"
          value={1}
          subtitle="Chuck (Opus 4)"
          icon={<Bot size={20} />}
          href="/agents"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline */}
        <Link
          href="/crm"
          className="bg-card border border-border rounded-xl p-5 block hover:border-coreconx/40 transition-colors"
        >
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Target size={18} className="text-coreconx-light" />
            Pipeline
          </h2>
          <div className="mt-4 space-y-3">
            {[
              { stage: "Research", count: pipelineCounts.Research, color: "bg-info" },
              { stage: "Cold Outreach", count: pipelineCounts["Cold Outreach"], color: "bg-warning" },
              { stage: "Warm", count: pipelineCounts.Warm, color: "bg-coreconx-light" },
              { stage: "Demo", count: pipelineCounts.Demo, color: "bg-accent-light" },
              { stage: "Customer", count: pipelineCounts.Customer, color: "bg-success" },
            ].map((item) => (
              <div key={item.stage} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-sm text-foreground flex-1">
                  {item.stage}
                </span>
                <span className="text-sm font-mono text-muted">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </Link>

        {/* Recent Activity */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock size={18} className="text-coreconx-light" />
            Recent Activity
          </h2>
          <div className="mt-4 space-y-3">
            {[
              { action: "API server live on Tailscale", time: "Just now" },
              { action: "Mission Control deployed to Netlify", time: "30m ago" },
              { action: "Updated 21 legal docs", time: "1h ago" },
              { action: "DKIM authentication verified", time: "2h ago" },
              { action: "Email aliases configured", time: "2h ago" },
              { action: "Founding partner campaign drafted", time: "3h ago" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-coreconx-light mt-2" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{item.action}</p>
                  <p className="text-xs text-muted">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Zap size={18} className="text-coreconx-light" />
          Priorities
        </h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              title: "GitHub Repo Access",
              desc: "Need PAT with repo scope to accept Marty's invite to coreconx-web",
              status: "Blocked",
              statusColor: "text-danger",
              href: "/tasks",
            },
            {
              title: "Launch Outreach Campaign",
              desc: "3-email founding partner sequence ready to send",
              status: "Ready",
              statusColor: "text-success",
              href: "/emails",
            },
            {
              title: "Wire Live APIs",
              desc: "CRM, Gmail, Linear, Calendar connected via Tailscale",
              status: "In Progress",
              statusColor: "text-warning",
              href: "/tasks",
            },
          ].map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="p-4 rounded-lg border border-border bg-background block hover:border-coreconx/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">
                  {item.title}
                </h3>
                <span className={`text-xs font-medium ${item.statusColor}`}>
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-muted mt-2">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Legal Docs"
          value={21}
          subtitle="All phases complete"
          icon={<TrendingUp size={20} />}
          trend={{ value: "Corrected & pushed to Drive", positive: true }}
          href="https://drive.google.com/drive/folders/"
        />
        <StatCard
          title="Email Templates"
          value={28}
          subtitle="6 categories"
          icon={<Mail size={20} />}
          trend={{ value: "Hormozi-aligned", positive: true }}
          href="/emails"
        />
        <StatCard
          title="Domain Auth"
          value="3/3"
          subtitle="SPF + DKIM + DMARC"
          icon={<Zap size={20} />}
          trend={{ value: "Fully authenticated", positive: true }}
        />
      </div>
    </div>
  );
}
