"use client";

import { useState, useEffect } from "react";
import {
  Mail,
  Send,
  Inbox,
  FileText,
  ExternalLink,
  ArrowRight,
  Loader2,
  RefreshCw,
  Eye,
  X,
} from "lucide-react";
import { Modal } from "@/components/modal";
import { apiFetch } from "@/lib/api";

interface CampaignEmail {
  id: number;
  name: string;
  subject: string;
  day: string;
  status: string;
  description: string;
  body: string;
}

interface GmailThread {
  id?: string;
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
  snippet?: string;
  labels?: string[];
  messageCount?: number;
}

interface GmailThreadDetail {
  id?: string;
  messages?: Array<{
    id?: string;
    from?: string;
    to?: string;
    date?: string;
    subject?: string;
    body?: string;
    snippet?: string;
  }>;
}

interface GmailSentResponse {
  threads?: GmailThread[];
  nextPageToken?: string;
}

const campaignEmails: CampaignEmail[] = [
  {
    id: 1,
    name: "The Honest Ask",
    subject: "Building something for drillers — could use your eyes on it",
    day: "Day 1",
    status: "Draft",
    description:
      "Opens with flaws, admits it's rough, asks for help not a sale. Buffett method — lead with negatives.",
    body: `Hey [Name],

I'm Dylan — I work as a helper at Hardrock Diamond Drilling. I've been trying to build an app for diamond drillers on the side and I'll be honest, it's rough around the edges. The UI needs work, there are features missing, and I'm figuring it out as I go.

But the core works — tracking driller performance, shifts, and project data without spreadsheets or paper. I built it because nothing out there is made for what we actually do.

I'm not looking for customers right now. I'm looking for a few drillers willing to beat it up and tell me what's broken. No cost, no contract. If it's useful, all I'd ask is an honest testimonial down the road. If it's not useful, tell me that too — that's just as valuable.

Would you be open to taking a look?

Dylan`,
  },
  {
    id: 2,
    name: "The Gentle Follow-Up",
    subject: "No worries if not — just following up",
    day: "Day 5-7",
    status: "Draft",
    description:
      "Respects their time, 'I know what 12-hour days look like,' easy out.",
    body: `Hey [Name],

Just following up — totally get it if you're slammed. I know what 12-hour days on a drill look like.

Quick context if my last email got buried: I'm a helper at Hardrock building an app to track driller performance and shifts. No customers yet, no testimonials, no polished marketing page. Just a working tool that needs real drillers to test it.

It's free. The only thing I'd ask for is honest feedback — and if it actually helps, a testimonial down the road.

If the timing's wrong, no stress at all. Door's open whenever.

Dylan`,
  },
  {
    id: 3,
    name: "The Last Door",
    subject: "Last one from me — door's always open",
    day: "Day 12-14",
    status: "Draft",
    description:
      "Honest scarcity (10 companies), referral ask, graceful close. No follow-up after this.",
    body: `Hey [Name],

Last email from me — I promise.

I'm looking for 10 diamond drilling companies to test an app I built for tracking driller performance and shifts. I can only support 10 right now because it's just me, and I want to give each company real attention.

The deal is simple: free access to the app, your honest feedback shapes what gets built, and if it works for you, a testimonial I can use.

If this isn't for you, totally respect that. If you know someone who might be interested, I'd appreciate the intro.

Either way, thanks for reading. Door's always open.

Dylan

Reply STOP to unsubscribe.`,
  },
];

interface SheetTemplate {
  name: string;
  subject: string;
  bodyPreview: string;
  variationA: string;
  variationB: string;
  variables: string;
  notes: string;
}

interface TemplateCategory {
  name: string;
  count?: number;
  icon: string;
  sheetUrl: string;
  templates: SheetTemplate[];
}

const aliases = [
  "chuck@coreconx.group",
  "support@coreconx.group",
  "privacy@coreconx.group",
  "billing@coreconx.group",
  "sales@coreconx.group",
  "accounting@coreconx.group",
  "contracts@coreconx.group",
  "onboarding@coreconx.group",
  "operations@coreconx.group",
  "sedarplus@coreconx.group",
];

const tabs = ["Campaign", "Templates", "Sent", "Legal Docs"] as const;
type Tab = typeof tabs[number];

const legalDocs = [
  { phase: "Phase 1 — MVP Launch", docs: [
    { name: "Terms of Service", url: "https://docs.google.com/document/d/1k8123ZrJiTJhrrnYHtltx5ZJmbrDPz-NEtJHyVKtu2A/edit" },
    { name: "Privacy Policy", url: "https://docs.google.com/document/d/1e4Y9yMl8QTsX1W8k3cQ6qcUWuNkVBYNeAoUc8hDskSM/edit" },
    { name: "Acceptable Use Policy", url: "https://docs.google.com/document/d/10aUm-xY3tmYVE6nr002sEWTiTjoj25AKvZAN2HLsI00/edit" },
    { name: "Cookie Policy", url: "https://docs.google.com/document/d/1jUpikcRCTqdLIiamXr7xrBnxDfyIWyfVbXdzvjKBpZY/edit" },
    { name: "Getting Started Guide", url: "https://docs.google.com/document/d/1ehRkppftE-L53QiVqNTeBL9pXZP2gHqlcFKK73vFSdc/edit" },
  ]},
  { phase: "Phase 2 — Paid Plans & Data", docs: [
    { name: "Subscription Agreement", url: "" },
    { name: "Data Processing Agreement (DPA)", url: "" },
    { name: "Service Level Agreement (SLA)", url: "" },
    { name: "Refund & Cancellation Policy", url: "" },
    { name: "End User License Agreement (EULA)", url: "" },
  ]},
  { phase: "Phase 3 — Marketplace (DRAFT)", docs: [
    { name: "Marketplace Terms", url: "" },
    { name: "Independent Contractor Agreement", url: "" },
    { name: "Commission & Fee Schedule", url: "" },
    { name: "Dispute Resolution Policy", url: "" },
    { name: "Insurance & Liability Requirements", url: "" },
    { name: "NDA Template", url: "" },
  ]},
  { phase: "General Legal", docs: [
    { name: "CASL Compliance Policy", url: "https://docs.google.com/document/d/1hxNOjpdPFZ9WK7eb1Ht32yOc8_GqXVTSTOOY0xaLOPQ/edit" },
    { name: "PIPEDA Compliance Policy", url: "https://docs.google.com/document/d/1yX1T1TMrsxFPhcAVzkerL48hGhHVNHjm3oPCbUIIbLo/edit" },
    { name: "IP Assignment Agreement", url: "https://docs.google.com/document/d/1CvJaeAZP6ihCxAgM2Ow01GdhYdLlkU-bFdd0PRq37vI/edit" },
    { name: "Employee & Contractor Agreement", url: "https://docs.google.com/document/d/1BklnEoyttFVzfIgJPgKlggWwitV1-ZYh-Lwa8JbExq0/edit" },
    { name: "Insurance Requirements (Internal)", url: "https://docs.google.com/document/d/1gM0MKa_LKJc2sVknxODg_X6p5zG5YveRBXnlOBOZLFw/edit" },
  ]},
];

export default function EmailsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Campaign");
  const [selectedEmail, setSelectedEmail] = useState<CampaignEmail | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [sentEmails, setSentEmails] = useState<GmailThread[]>([]);
  const [inboxEmails, setInboxEmails] = useState<GmailThread[]>([]);
  const [templateCategories, setTemplateCategories] = useState<TemplateCategory[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [sentAliasFilter, setSentAliasFilter] = useState<string>("all");
  const [selectedThread, setSelectedThread] = useState<GmailThreadDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [refreshingSent, setRefreshingSent] = useState(false);

  const fetchSent = async () => {
    setLoadingSent(true);
    const data = await apiFetch<GmailSentResponse>("/api/emails/sent");
    if (data?.threads && Array.isArray(data.threads)) setSentEmails(data.threads);
    else if (data && Array.isArray(data)) setSentEmails(data as unknown as GmailThread[]);
    setLoadingSent(false);
  };

  const fetchInbox = async () => {
    setLoadingInbox(true);
    const data = await apiFetch<GmailSentResponse>("/api/emails/inbox");
    if (data?.threads && Array.isArray(data.threads)) setInboxEmails(data.threads);
    else if (data && Array.isArray(data)) setInboxEmails(data as unknown as GmailThread[]);
    setLoadingInbox(false);
  };

  const refreshSent = async () => {
    setRefreshingSent(true);
    await fetchSent();
    setRefreshingSent(false);
  };

  const openThread = async (threadId: string) => {
    setLoadingThread(true);
    setSelectedThread(null);
    const data = await apiFetch<GmailThreadDetail>(`/api/emails/thread/${threadId}`);
    if (data) setSelectedThread(data);
    setLoadingThread(false);
  };

  useEffect(() => {
    fetchSent();
    fetchInbox();
    setLoadingTemplates(true);
    apiFetch<TemplateCategory[]>("/api/templates").then((data) => {
      if (data && Array.isArray(data)) setTemplateCategories(data);
      setLoadingTemplates(false);
    });
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail size={24} className="text-coreconx-light" />
            Email Hub
          </h1>
          <p className="text-muted text-sm mt-1">
            Campaigns, templates, sent emails, and legal documents
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="https://docs.google.com/spreadsheets/d/1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-lg text-sm hover:bg-card-hover transition-colors"
          >
            <ExternalLink size={14} />
            CRM Sheet
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Emails Sent",
            value: loadingSent ? "..." : String(sentEmails.length),
            icon: <Send size={16} />,
            sub: sentEmails.length === 0 ? "No emails sent yet" : "From Gmail",
          },
          {
            label: "Inbox (Unread)",
            value: loadingInbox ? "..." : String(inboxEmails.length),
            icon: <Inbox size={16} />,
            sub: "Monitoring 10 aliases",
          },
          {
            label: "Templates",
            value: loadingTemplates ? "..." : String(templateCategories.reduce((sum, c) => sum + (c.count || c.templates.length), 0)),
            icon: <FileText size={16} />,
            sub: loadingTemplates ? "Loading..." : `${templateCategories.length} categories`,
          },
          {
            label: "Domain Auth",
            value: "3/3",
            icon: <Mail size={16} />,
            sub: "SPF + DKIM + DMARC",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 text-muted">
              {stat.icon}
              <span className="text-xs">{stat.label}</span>
            </div>
            <p className="text-2xl font-semibold text-foreground mt-2">
              {stat.value}
            </p>
            <p className="text-xs text-muted mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-coreconx text-white"
                : "text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Campaign Tab */}
      {activeTab === "Campaign" && (
        <>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Founding Partner Campaign
              </h2>
              <span className="text-xs px-3 py-1 rounded-full bg-warning/20 text-warning font-medium">
                Ready to Launch
              </span>
            </div>
            <p className="text-sm text-muted mt-2">
              3-email sequence — Buffett method (lead with negatives), Hormozi
              frameworks, testimonial exchange. Click any email to view the full body.
            </p>

            <div className="mt-4 space-y-3">
              {campaignEmails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className="w-full text-left flex items-start gap-4 p-4 rounded-lg border border-border bg-background hover:border-coreconx/40 transition-colors cursor-pointer"
                >
                  <div className="flex-shrink-0 w-16 text-center">
                    <span className="text-xs font-mono text-muted">
                      {email.day}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-foreground">
                        {email.name}
                      </h3>
                      <ArrowRight size={12} className="text-muted" />
                      <span className="text-xs text-muted italic">
                        &quot;{email.subject}&quot;
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">{email.description}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-card-hover text-muted">
                    {email.status}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Aliases */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-lg font-semibold text-foreground">
              Email Aliases
            </h2>
            <p className="text-xs text-muted mt-1">
              All routed to chuck@coreconx.group
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {aliases.map((alias) => (
                <span
                  key={alias}
                  className="text-xs px-3 py-1.5 rounded-full bg-coreconx/10 text-coreconx-light font-mono"
                >
                  {alias}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Templates Tab */}
      {activeTab === "Templates" && (
        <div className="space-y-4">
          {loadingTemplates ? (
            <div className="text-center py-12">
              <Loader2 size={32} className="mx-auto text-muted animate-spin" />
              <p className="text-muted mt-4">Loading templates from Google Sheets...</p>
            </div>
          ) : templateCategories.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={40} className="mx-auto text-muted/30" />
              <p className="text-muted mt-4">No templates found</p>
            </div>
          ) : (
            templateCategories.map((cat) => (
              <div key={cat.name} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                  className="w-full text-left flex items-center justify-between p-5 hover:bg-card-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{cat.name}</h3>
                      <p className="text-xs text-muted">{cat.count || cat.templates.length} templates</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={cat.sheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs px-2.5 py-1 rounded-full bg-coreconx/10 text-coreconx-light hover:bg-coreconx/20 transition-colors flex items-center gap-1"
                    >
                      <ExternalLink size={10} />
                      Sheet
                    </a>
                    <span className="text-muted text-lg">{expandedCategory === cat.name ? "▼" : "▶"}</span>
                  </div>
                </button>
                {expandedCategory === cat.name && (
                  <div className="border-t border-border">
                    {cat.templates.map((tpl) => {
                      const tplKey = `${cat.name}-${tpl.name}`;
                      const isExpanded = expandedTemplate === tplKey;
                      return (
                        <div key={tpl.name} className="border-b border-border last:border-b-0">
                          <button
                            onClick={() => setExpandedTemplate(isExpanded ? null : tplKey)}
                            className="w-full text-left flex items-center justify-between px-5 py-3 hover:bg-card-hover transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-foreground">{tpl.name}</h4>
                              <p className="text-xs text-muted truncate">Subject: &quot;{tpl.subject}&quot;</p>
                            </div>
                            <span className="text-xs px-2.5 py-1 rounded-full bg-coreconx/10 text-coreconx-light flex-shrink-0">
                              {isExpanded ? "Close" : "View"}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="px-5 pb-5 space-y-3">
                              {/* Subject & Body Preview */}
                              <div className="bg-background rounded-lg border border-border overflow-hidden">
                                <div className="px-4 py-3 border-b border-border bg-card-hover/50">
                                  <div className="text-xs text-muted space-y-1">
                                    <p><span className="font-medium text-foreground">Subject:</span> {tpl.subject}</p>
                                    {tpl.notes && (
                                      <p><span className="font-medium text-foreground">Used for:</span> {tpl.notes}</p>
                                    )}
                                    {tpl.variables && (
                                      <p><span className="font-medium text-foreground">Variables:</span> <code className="text-coreconx-light">{tpl.variables}</code></p>
                                    )}
                                  </div>
                                </div>
                                <div className="p-4">
                                  <p className="text-sm text-foreground leading-relaxed">{tpl.bodyPreview}</p>
                                </div>
                              </div>

                              {/* A/B Variations */}
                              {(tpl.variationA || tpl.variationB) && (
                                <div className="grid grid-cols-2 gap-3">
                                  {tpl.variationA && (
                                    <div className="bg-background rounded-lg border border-border p-3">
                                      <p className="text-xs font-medium text-coreconx-light mb-1">Variation A</p>
                                      <p className="text-xs text-muted">{tpl.variationA}</p>
                                    </div>
                                  )}
                                  {tpl.variationB && (
                                    <div className="bg-background rounded-lg border border-border p-3">
                                      <p className="text-xs font-medium text-coreconx-light mb-1">Variation B</p>
                                      <p className="text-xs text-muted">{tpl.variationB}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Sent Tab */}
      {activeTab === "Sent" && (
        <div className="space-y-4">
          {/* Alias filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSentAliasFilter("all")}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                sentAliasFilter === "all"
                  ? "bg-coreconx text-white"
                  : "bg-card border border-border text-muted hover:text-foreground"
              }`}
            >
              All ({sentEmails.length})
            </button>
            {aliases.map((alias) => {
              const count = sentEmails.filter((e) => e.from?.includes(alias.split("@")[0])).length;
              if (count === 0) return null;
              return (
                <button
                  key={alias}
                  onClick={() => setSentAliasFilter(alias)}
                  className={`text-xs px-3 py-1.5 rounded-full font-mono transition-colors ${
                    sentAliasFilter === alias
                      ? "bg-coreconx text-white"
                      : "bg-card border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {alias.split("@")[0]} ({count})
                </button>
              );
            })}
            <button
              onClick={refreshSent}
              disabled={refreshingSent}
              className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-card border border-border text-muted hover:text-foreground transition-colors"
            >
              <RefreshCw size={12} className={refreshingSent ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-lg font-semibold text-foreground">Sent Emails</h2>
            <p className="text-xs text-muted mt-1">Live from Gmail — all outgoing emails from CoreConX</p>
            {loadingSent ? (
              <div className="mt-8 text-center py-12">
                <Loader2 size={32} className="mx-auto text-muted animate-spin" />
                <p className="text-muted mt-4">Loading sent emails...</p>
              </div>
            ) : sentEmails.length === 0 ? (
              <div className="mt-8 text-center py-12">
                <Send size={40} className="mx-auto text-muted/30" />
                <p className="text-muted mt-4">No emails sent yet</p>
                <p className="text-xs text-muted mt-1">Emails will appear here once the founding partner campaign launches</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {sentEmails
                  .filter((e) => sentAliasFilter === "all" || e.from?.includes(sentAliasFilter.split("@")[0]))
                  .map((email, i) => (
                  <button
                    key={email.id || i}
                    onClick={() => email.id && openThread(email.id)}
                    className="w-full text-left flex items-center gap-4 p-3 rounded-lg border border-border bg-background hover:border-coreconx/40 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{email.subject || "(no subject)"}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted truncate">From: {email.from || "—"}</p>
                        {email.messageCount && email.messageCount > 1 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-card-hover text-muted">{email.messageCount} msgs</span>
                        )}
                      </div>
                      {email.snippet && (
                        <p className="text-xs text-muted/70 mt-1 truncate">{email.snippet}</p>
                      )}
                    </div>
                    <span className="text-xs text-muted whitespace-nowrap">{email.date || "—"}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-success/20 text-success">Sent</span>
                      <Eye size={14} className="text-muted" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Thread Detail Modal */}
      <Modal
        open={!!selectedThread || loadingThread}
        onClose={() => { setSelectedThread(null); setLoadingThread(false); }}
        title={selectedThread?.messages?.[0]?.subject || "Email Thread"}
        subtitle={selectedThread?.messages?.[0]?.from ? `From: ${selectedThread.messages[0].from}` : ""}
      >
        {loadingThread ? (
          <div className="text-center py-8">
            <Loader2 size={24} className="mx-auto text-muted animate-spin" />
            <p className="text-muted mt-3 text-sm">Loading thread...</p>
          </div>
        ) : selectedThread?.messages ? (
          <div className="space-y-4">
            {selectedThread.messages.map((msg, i) => (
              <div key={msg.id || i} className="bg-background rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-card-hover/50">
                  <div className="text-xs text-muted space-y-1">
                    <p><span className="font-medium text-foreground">From:</span> {msg.from || "—"}</p>
                    <p><span className="font-medium text-foreground">To:</span> {msg.to || "—"}</p>
                    <p><span className="font-medium text-foreground">Date:</span> {msg.date || "—"}</p>
                    {msg.subject && <p><span className="font-medium text-foreground">Subject:</span> {msg.subject}</p>}
                  </div>
                </div>
                <div className="p-4">
                  <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                    {msg.body || msg.snippet || "(no content)"}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted text-sm">No messages found in this thread.</p>
        )}
      </Modal>

      {/* Legal Docs Tab */}
      {activeTab === "Legal Docs" && (
        <div className="space-y-4">
          {legalDocs.map((section) => (
            <div key={section.phase} className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-lg font-semibold text-foreground">{section.phase}</h2>
              <div className="mt-3 space-y-2">
                {section.docs.map((doc) => (
                  <a
                    key={doc.name}
                    href={doc.url || "#"}
                    target={doc.url ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between p-3 rounded-lg border border-border bg-background transition-colors ${
                      doc.url ? "hover:border-coreconx/40 cursor-pointer" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-coreconx-light" />
                      <span className="text-sm font-medium text-foreground">{doc.name}</span>
                    </div>
                    {doc.url ? (
                      <ExternalLink size={14} className="text-muted" />
                    ) : (
                      <span className="text-xs text-muted">In Drive — link pending</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign Email Modal */}
      <Modal
        open={!!selectedEmail}
        onClose={() => setSelectedEmail(null)}
        title={selectedEmail?.name || ""}
        subtitle={selectedEmail ? `Subject: "${selectedEmail.subject}"` : ""}
      >
        {selectedEmail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded-full bg-warning/20 text-warning font-medium">
                {selectedEmail.status}
              </span>
              <span className="text-xs text-muted">Send on {selectedEmail.day}</span>
            </div>
            <div className="bg-background rounded-lg p-4 border border-border">
              <h4 className="text-xs font-medium text-muted mb-2">Strategy</h4>
              <p className="text-sm text-foreground">{selectedEmail.description}</p>
            </div>
            <div className="bg-background rounded-lg p-4 border border-border">
              <h4 className="text-xs font-medium text-muted mb-2">Email Body</h4>
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{selectedEmail.body}</pre>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
