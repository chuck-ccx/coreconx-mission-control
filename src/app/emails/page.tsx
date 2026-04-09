"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Send,
  Inbox,
  FileText,
  Loader2,
  RefreshCw,
  Eye,
  X,
  Archive,
  Trash2,
  CheckCheck,
  Reply,
  Clock,
  Edit3,
  ChevronDown,
  Megaphone,
  LayoutTemplate,
  Plus,
  Copy,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  ExternalLink,
} from "lucide-react";
import { Modal } from "@/components/modal";
import { apiFetch } from "@/lib/api";

// --- Types ---

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

interface Draft {
  id: string;
  to: string;
  subject: string;
  body: string;
  from?: string;
}

type ColumnId = "inbox" | "drafts" | "review" | "sent";

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

const columnConfig: {
  id: ColumnId;
  label: string;
  icon: typeof Inbox;
  color: string;
  description: string;
}[] = [
  { id: "inbox", label: "Inbox", icon: Inbox, color: "text-info", description: "Needs reply" },
  { id: "drafts", label: "Drafts", icon: Edit3, color: "text-warning", description: "Being written" },
  { id: "review", label: "Review", icon: Clock, color: "text-coreconx-light", description: "Approve to send" },
  { id: "sent", label: "Sent", icon: Send, color: "text-success", description: "Delivered" },
];

export default function EmailsPage() {
  // Data
  const [inboxEmails, setInboxEmails] = useState<GmailThread[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sentEmails, setSentEmails] = useState<GmailThread[]>([]);

  // Loading
  const [loadingInbox, setLoadingInbox] = useState(true);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [loadingSent, setLoadingSent] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Actions
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [draftActionLoading, setDraftActionLoading] = useState<Record<string, string>>({});

  // Thread detail
  const [selectedThread, setSelectedThread] = useState<GmailThreadDetail | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);

  // Reply form
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyTo, setReplyTo] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyFrom, setReplyFrom] = useState("chuck@coreconx.group");
  const [replyMessageId, setReplyMessageId] = useState<string | undefined>();
  const [savingDraft, setSavingDraft] = useState(false);

  // Edit draft
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [editTo, setEditTo] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editFrom, setEditFrom] = useState("chuck@coreconx.group");

  // Top-level tab: pipeline vs campaigns/templates
  type TopTab = "pipeline" | "campaigns";
  const [topTab, setTopTab] = useState<TopTab>("pipeline");

  // Alias filter
  const [aliasFilter, setAliasFilter] = useState<string>("all");

  // Campaigns & Templates
  type SubTab = "campaigns" | "templates";
  const [subTab, setSubTab] = useState<SubTab>("campaigns");

  // Campaign expand & sequence email viewer
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [viewingSequenceEmail, setViewingSequenceEmail] = useState<SequenceEmail | null>(null);

  // Template edit modal
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editTemplateSubject, setEditTemplateSubject] = useState("");
  const [editTemplateBody, setEditTemplateBody] = useState("");

  const openTemplateEditor = (t: Template) => {
    setEditingTemplate(t);
    setEditTemplateSubject(t.subject);
    setEditTemplateBody(t.body);
  };

  const saveTemplate = () => {
    if (!editingTemplate) return;
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === editingTemplate.id
          ? { ...t, subject: editTemplateSubject, body: editTemplateBody }
          : t
      )
    );
    setEditingTemplate(null);
  };

  interface SequenceEmail {
    day: number;
    label: string;
    subject: string;
    body: string;
  }

  interface Campaign {
    id: string;
    name: string;
    status: "draft" | "active" | "paused" | "completed";
    sent: number;
    opened: number;
    replied: number;
    description: string;
    sequence: SequenceEmail[];
  }

  interface Template {
    id: string;
    name: string;
    subject: string;
    body: string;
    category: string;
    usedCount: number;
    variables: string[];
    description: string;
  }

  const [campaigns] = useState<Campaign[]>([
    {
      id: "1",
      name: "Founding Partner Outreach",
      status: "active",
      sent: 0,
      opened: 0,
      replied: 0,
      description: "Honest, early-stage outreach to diamond drilling companies. Hormozi-aligned \u2014 lead with flaws, ask for help not a sale.",
      sequence: [
        {
          day: 1,
          label: "The Honest Ask",
          subject: "Building something for drillers \u2014 could use your eyes on it",
          body: "Hey {{name}},\n\nI\u2019m Dylan \u2014 I work as a helper at Hardrock Diamond Drilling. I\u2019ve been trying to build an app for diamond drillers on the side and I\u2019ll be honest, it\u2019s rough around the edges. The UI needs work, there are features missing, and I\u2019m figuring it out as I go.\n\nBut the core works \u2014 tracking driller performance, shifts, and project data without spreadsheets or paper. I built it because nothing out there is made for what we actually do.\n\nI\u2019m not looking for customers right now. I\u2019m looking for a few drillers willing to beat it up and tell me what\u2019s broken. No cost, no contract. If it\u2019s useful, all I\u2019d ask is an honest testimonial down the road. If it\u2019s not useful, tell me that too \u2014 that\u2019s just as valuable.\n\nWould you be open to taking a look?\n\nDylan",
        },
        {
          day: 5,
          label: "The Gentle Follow-Up",
          subject: "No worries if not \u2014 just following up",
          body: "Hey {{name}},\n\nJust following up \u2014 totally get it if you\u2019re slammed. I know what 12-hour days on a drill look like.\n\nQuick context if my last email got buried: I\u2019m a helper at Hardrock building an app to track driller performance and shifts. No customers yet, no testimonials, no polished marketing page. Just a working tool that needs real drillers to test it.\n\nIt\u2019s free. The only thing I\u2019d ask for is honest feedback \u2014 and if it actually helps, a testimonial down the road.\n\nIf the timing\u2019s wrong, no stress at all. Door\u2019s open whenever.\n\nDylan",
        },
        {
          day: 14,
          label: "The Last Door",
          subject: "Last one from me \u2014 door\u2019s always open",
          body: "Hey {{name}},\n\nLast email from me \u2014 I promise.\n\nI\u2019m looking for 10 diamond drilling companies to test an app I built for tracking driller performance and shifts. I can only support 10 right now because it\u2019s just me, and I want to give each company real attention.\n\nThe deal is simple: free access to the app, your honest feedback shapes what gets built, and if it works for you, a testimonial I can use.\n\nIf this isn\u2019t for you, totally respect that. If you know someone who might be interested, I\u2019d appreciate the intro.\n\nEither way, thanks for reading. Door\u2019s always open.\n\nDylan\n\nReply STOP to unsubscribe.",
        },
      ],
    },
  ]);

  const [templates, setTemplates] = useState<Template[]>([
    // Outreach
    { id: "1", name: "Cold Intro", subject: "Streamline your drilling operations", body: "Hi {{name}},\n\nI noticed {{company}} runs operations in {{industry_detail}}. We built CoreConX to help drill owners like you track performance, manage shifts, and reduce downtime.\n\nWould you be open to a quick 10-minute call this week?\n\nBest,\nDylan", category: "Outreach", usedCount: 0, variables: ["{{name}}", "{{company}}", "{{industry_detail}}"], description: "First-touch email for new leads." },
    { id: "2", name: "Warm Intro", subject: "{{referrer}} suggested I reach out", body: "Hi {{name}},\n\n{{referrer}} mentioned that {{company}} might be a great fit for what we\u2019re building at CoreConX. We help diamond drilling companies track driller performance, shifts, and project data \u2014 no more spreadsheets.\n\nWould love to show you a quick demo. No pressure, just a conversation.\n\nBest,\nDylan", category: "Outreach", usedCount: 0, variables: ["{{name}}", "{{company}}", "{{referrer}}"], description: "For referrals or mutual connections." },
    { id: "3", name: "Partnership Proposal", subject: "Potential {{partnership_type}} partnership", body: "Hi {{name}},\n\nI\u2019m reaching out from CoreConX \u2014 we\u2019re building tools for diamond drilling companies to manage performance and operations data.\n\nI think there could be a strong {{partnership_type}} opportunity between us and {{company}}. Would you be open to a quick call to explore it?\n\nBest,\nDylan", category: "Outreach", usedCount: 0, variables: ["{{name}}", "{{company}}", "{{partnership_type}}"], description: "For potential integrations or partnerships." },
    // Follow-Up
    { id: "4", name: "Gentle Follow-Up", subject: "Quick follow-up", body: "Hi {{name}},\n\nJust wanted to follow up on my last email. I know things get busy on the rig \u2014 no rush at all.\n\nIf you\u2019re interested in seeing what CoreConX can do for your crew, I\u2019m happy to walk you through it whenever works.\n\nCheers,\nDylan", category: "Follow-Up", usedCount: 0, variables: ["{{name}}"], description: "Day 5-7 after first contact." },
    { id: "5", name: "Value-Add Follow-Up", subject: "Thought this might be useful", body: "Hi {{name}},\n\nI came across this and thought of you: {{resource_link}}\n\nWe\u2019ve been working on CoreConX to solve a lot of these same challenges. Would love to chat if you\u2019re curious.\n\nCheers,\nDylan", category: "Follow-Up", usedCount: 0, variables: ["{{name}}", "{{resource_link}}"], description: "Share something useful, re-engage." },
    { id: "6", name: "Break-Up Email", subject: "Closing the loop", body: "Hi {{name}},\n\nI\u2019ve reached out a couple of times and haven\u2019t heard back \u2014 totally understand. I\u2019ll close the loop on my end, but the door\u2019s always open if you want to revisit.\n\nWishing you and the crew all the best.\n\nDylan", category: "Follow-Up", usedCount: 0, variables: ["{{name}}"], description: "Final touch, graceful close." },
    // Support
    { id: "7", name: "Welcome Email", subject: "Welcome to CoreConX!", body: "Hi {{name}},\n\nWelcome aboard! We\u2019re excited to have {{company}} on CoreConX.\n\nHere\u2019s what to do next:\n1. Log in and set up your first project\n2. Add your drillers and helpers\n3. Start tracking shifts\n\nIf you need anything at all, just reply to this email.\n\nCheers,\nThe CoreConX Team", category: "Support", usedCount: 0, variables: ["{{name}}", "{{company}}"], description: "New user onboarding." },
    { id: "8", name: "Bug Report Response", subject: "Re: Bug Report \u2014 We\u2019re on it", body: "Hi {{name}},\n\nThanks for flagging this. We\u2019ve logged the issue:\n\n\"{{issue_summary}}\"\n\nOur team is looking into it and we\u2019ll follow up once it\u2019s resolved. Appreciate your patience.\n\nBest,\nChuck\nCoreConX Support", category: "Support", usedCount: 0, variables: ["{{name}}", "{{issue_summary}}"], description: "Acknowledging a reported issue." },
    { id: "9", name: "Feature Request Response", subject: "Re: Feature Request \u2014 {{feature}}", body: "Hi {{name}},\n\nThanks for the suggestion! We\u2019ve added \"{{feature}}\" to our roadmap for review.\n\nWe can\u2019t promise a timeline, but feedback like yours directly shapes what gets built. We\u2019ll keep you posted.\n\nBest,\nChuck\nCoreConX Support", category: "Support", usedCount: 0, variables: ["{{name}}", "{{feature}}"], description: "Acknowledging a feature ask." },
    // Sales
    { id: "10", name: "Pricing Quote", subject: "Your CoreConX pricing quote", body: "Hi {{name}},\n\nThanks for your interest in CoreConX! Here\u2019s the custom pricing we put together for {{company}}:\n\nPlan: {{features}}\nPrice: {{price}}/month\n\nThis includes onboarding support and priority access to new features. Let me know if you\u2019d like to move forward or if you have questions.\n\nBest,\nDylan", category: "Sales", usedCount: 0, variables: ["{{name}}", "{{company}}", "{{price}}", "{{features}}"], description: "Custom pricing for enterprise." },
    { id: "11", name: "Trial Extension", subject: "Your trial has been extended", body: "Hi {{name}},\n\nGood news \u2014 we\u2019ve extended your CoreConX trial. Your new end date is {{new_end_date}}.\n\nTake the extra time to explore everything. If you have questions or want a walkthrough, just reply here.\n\nCheers,\nDylan", category: "Sales", usedCount: 0, variables: ["{{name}}", "{{new_end_date}}"], description: "Extending a trial period." },
  ]);

  // --- Fetchers ---

  const fetchInbox = useCallback(async () => {
    setLoadingInbox(true);
    const data = await apiFetch<{ threads?: GmailThread[] }>("/api/emails/inbox");
    if (data?.threads && Array.isArray(data.threads)) setInboxEmails(data.threads);
    else if (data && Array.isArray(data)) setInboxEmails(data as unknown as GmailThread[]);
    setLoadingInbox(false);
  }, []);

  const fetchDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    const data = await apiFetch<{ drafts?: Draft[] }>("/api/emails/drafts");
    if (data?.drafts && Array.isArray(data.drafts)) setDrafts(data.drafts);
    else if (data && Array.isArray(data)) setDrafts(data as unknown as Draft[]);
    setLoadingDrafts(false);
  }, []);

  const fetchSent = useCallback(async () => {
    setLoadingSent(true);
    const data = await apiFetch<{ threads?: GmailThread[] }>("/api/emails/sent");
    if (data?.threads && Array.isArray(data.threads)) setSentEmails(data.threads);
    else if (data && Array.isArray(data)) setSentEmails(data as unknown as GmailThread[]);
    setLoadingSent(false);
  }, []);

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([fetchInbox(), fetchDrafts(), fetchSent()]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchInbox();
    fetchDrafts();
    fetchSent();
  }, [fetchInbox, fetchDrafts, fetchSent]);

  // --- Actions ---

  const openThread = async (threadId: string) => {
    setLoadingThread(true);
    setSelectedThread(null);
    const data = await apiFetch<GmailThreadDetail>(`/api/emails/thread/${threadId}`);
    if (data) setSelectedThread(data);
    setLoadingThread(false);
  };

  const emailAction = async (messageId: string, action: "archive" | "mark-read" | "trash") => {
    setActionLoading((prev) => ({ ...prev, [messageId]: action }));
    await apiFetch(`/api/emails/${action}/${messageId}`, { method: "POST" });
    setInboxEmails((prev) => prev.filter((e) => e.id !== messageId));
    setActionLoading((prev) => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  };

  const approveDraft = async (draftId: string) => {
    setDraftActionLoading((prev) => ({ ...prev, [draftId]: "approve" }));
    await apiFetch(`/api/emails/draft/${draftId}/send`, { method: "POST" });
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    setDraftActionLoading((prev) => {
      const next = { ...prev };
      delete next[draftId];
      return next;
    });
    await fetchSent();
  };

  const deleteDraft = async (draftId: string) => {
    setDraftActionLoading((prev) => ({ ...prev, [draftId]: "delete" }));
    await apiFetch(`/api/emails/draft/${draftId}`, { method: "DELETE" });
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    setDraftActionLoading((prev) => {
      const next = { ...prev };
      delete next[draftId];
      return next;
    });
  };

  const openReplyForm = (msg: { from?: string; subject?: string; id?: string }) => {
    setReplyTo(msg.from || "");
    setReplySubject(msg.subject?.startsWith("Re:") ? msg.subject : `Re: ${msg.subject || ""}`);
    setReplyBody("");
    setReplyMessageId(msg.id);
    setShowReplyForm(true);
  };

  const saveDraftReply = async () => {
    if (!replyTo || !replySubject || !replyBody) return;
    setSavingDraft(true);
    await apiFetch("/api/emails/draft", {
      method: "POST",
      body: JSON.stringify({
        to: replyTo,
        subject: replySubject,
        body: replyBody,
        from: replyFrom,
        replyToMessageId: replyMessageId,
      }),
    });
    setSavingDraft(false);
    setShowReplyForm(false);
    setReplyTo("");
    setReplySubject("");
    setReplyBody("");
    setReplyMessageId(undefined);
    await fetchDrafts();
  };

  const openEditDraft = (draft: Draft) => {
    setEditingDraft(draft);
    setEditTo(draft.to);
    setEditSubject(draft.subject);
    setEditBody(draft.body);
    setEditFrom(draft.from || "chuck@coreconx.group");
  };

  const saveEditedDraft = async () => {
    if (!editingDraft || !editTo || !editSubject || !editBody) return;
    setSavingDraft(true);
    // Delete old draft and create new one with updated content
    await apiFetch(`/api/emails/draft/${editingDraft.id}`, { method: "DELETE" });
    await apiFetch("/api/emails/draft", {
      method: "POST",
      body: JSON.stringify({
        to: editTo,
        subject: editSubject,
        body: editBody,
        from: editFrom,
      }),
    });
    setSavingDraft(false);
    setEditingDraft(null);
    await fetchDrafts();
  };

  // Split drafts into "drafts" (being written) and "review" (ready for approval)
  const reviewDrafts = drafts;
  const inProgressDrafts: Draft[] = [];

  // --- Alias filtering ---
  const filterByAlias = <T extends { from?: string; to?: string }>(items: T[]): T[] => {
    if (aliasFilter === "all") return items;
    return items.filter(
      (item) =>
        item.to?.toLowerCase().includes(aliasFilter.toLowerCase()) ||
        item.from?.toLowerCase().includes(aliasFilter.toLowerCase())
    );
  };

  const filteredInbox = filterByAlias(inboxEmails);
  const filteredReview = filterByAlias(reviewDrafts);
  const filteredSent = filterByAlias(sentEmails);

  // --- Counts ---
  const counts: Record<ColumnId, number> = {
    inbox: filteredInbox.length,
    drafts: inProgressDrafts.length,
    review: filteredReview.length,
    sent: filteredSent.length,
  };

  // --- Mobile column selector ---
  const [activeColumn, setActiveColumn] = useState<ColumnId>("inbox");

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail size={24} className="text-coreconx-light" />
            Email Hub
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-1">
            Response pipeline, campaigns &amp; templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          {topTab === "pipeline" && (
            <button
              onClick={refreshAll}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-lg text-sm hover:bg-card-hover transition-colors"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Top-level tabs: Pipeline | Campaigns & Templates */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
        <button
          onClick={() => setTopTab("pipeline")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            topTab === "pipeline"
              ? "bg-coreconx text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          <Inbox size={14} />
          Pipeline
        </button>
        <button
          onClick={() => setTopTab("campaigns")}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            topTab === "campaigns"
              ? "bg-coreconx text-white"
              : "text-muted hover:text-foreground"
          }`}
        >
          <Megaphone size={14} />
          Campaigns &amp; Templates
        </button>
      </div>

      {/* ===== PIPELINE TAB ===== */}
      {topTab === "pipeline" && (
        <>
          {/* Alias filter bar */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setAliasFilter("all")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                aliasFilter === "all"
                  ? "bg-coreconx text-white"
                  : "bg-card border border-border text-muted hover:text-foreground hover:border-border/80"
              }`}
            >
              All
            </button>
            {aliases.map((alias) => {
              const shortName = alias.split("@")[0];
              return (
                <button
                  key={alias}
                  onClick={() => setAliasFilter(aliasFilter === alias ? "all" : alias)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    aliasFilter === alias
                      ? "bg-coreconx text-white"
                      : "bg-card border border-border text-muted hover:text-foreground hover:border-border/80"
                  }`}
                >
                  {shortName}@
                </button>
              );
            })}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {columnConfig.map((col) => {
              const Icon = col.icon;
              const loading = col.id === "inbox" ? loadingInbox : col.id === "drafts" ? loadingDrafts : col.id === "review" ? loadingDrafts : loadingSent;
              return (
                <button
                  key={col.id}
                  onClick={() => setActiveColumn(col.id)}
                  className={`bg-card border rounded-xl p-3 sm:p-4 text-left transition-colors ${
                    activeColumn === col.id ? "border-coreconx/50 bg-coreconx/5" : "border-border hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={14} className={col.color} />
                    <span className="text-xs text-muted">{col.label}</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-semibold text-foreground mt-1">
                    {loading ? "..." : counts[col.id]}
                  </p>
                  <p className="text-xs text-muted mt-0.5 hidden sm:block">{col.description}</p>
                </button>
              );
            })}
          </div>

          {/* Mobile column selector */}
          <div className="flex gap-1 bg-card border border-border rounded-xl p-1 sm:hidden">
            {columnConfig.map((col) => (
              <button
                key={col.id}
                onClick={() => setActiveColumn(col.id)}
                className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activeColumn === col.id
                    ? "bg-coreconx text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {col.label} ({counts[col.id]})
              </button>
            ))}
          </div>

          {/* Kanban Board — desktop: 4 cols, mobile: single column via selector */}
          <div className="hidden sm:grid sm:grid-cols-4 gap-4">
            {columnConfig.map((col) => (
              <KanbanColumn key={col.id} col={col} counts={counts}>
                <ColumnContent
                  colId={col.id}
                  inboxEmails={filteredInbox}
                  inProgressDrafts={inProgressDrafts}
                  reviewDrafts={filteredReview}
                  sentEmails={filteredSent}
                  loadingInbox={loadingInbox}
                  loadingDrafts={loadingDrafts}
                  loadingSent={loadingSent}
                  actionLoading={actionLoading}
                  draftActionLoading={draftActionLoading}
                  onOpenThread={openThread}
                  onEmailAction={emailAction}
                  onApproveDraft={approveDraft}
                  onDeleteDraft={deleteDraft}
                  onEditDraft={openEditDraft}
                />
              </KanbanColumn>
            ))}
          </div>

          {/* Mobile: single column view */}
          <div className="sm:hidden">
            <ColumnContent
              colId={activeColumn}
              inboxEmails={filteredInbox}
              inProgressDrafts={inProgressDrafts}
              reviewDrafts={filteredReview}
              sentEmails={filteredSent}
              loadingInbox={loadingInbox}
              loadingDrafts={loadingDrafts}
              loadingSent={loadingSent}
              actionLoading={actionLoading}
              draftActionLoading={draftActionLoading}
              onOpenThread={openThread}
              onEmailAction={emailAction}
              onApproveDraft={approveDraft}
              onDeleteDraft={deleteDraft}
              onEditDraft={openEditDraft}
            />
          </div>
        </>
      )}

      {/* ===== CAMPAIGNS & TEMPLATES TAB ===== */}
      {topTab === "campaigns" && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-card border border-border rounded-xl p-1 max-w-xs">
            <button
              onClick={() => setSubTab("campaigns")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                subTab === "campaigns"
                  ? "bg-coreconx text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Megaphone size={13} />
              Campaigns
            </button>
            <button
              onClick={() => setSubTab("templates")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                subTab === "templates"
                  ? "bg-coreconx text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <LayoutTemplate size={13} />
              Templates
            </button>
          </div>

          {/* Campaigns list */}
          {subTab === "campaigns" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">Email sequences for outreach &amp; follow-ups</p>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-coreconx text-white text-xs font-medium hover:bg-coreconx/90 transition-colors">
                  <Plus size={12} />
                  New Campaign
                </button>
              </div>
              {campaigns.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <Megaphone size={32} className="mx-auto text-muted/30" />
                  <p className="text-sm text-muted mt-3">No campaigns yet</p>
                  <p className="text-xs text-muted/60 mt-1">Create your first outreach sequence</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {campaigns.map((c) => {
                    const isExpanded = expandedCampaignId === c.id;
                    return (
                      <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedCampaignId(isExpanded ? null : c.id)}
                          className="w-full text-left p-4 hover:bg-card-hover/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-semibold text-foreground">{c.name}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                  c.status === "active" ? "bg-success/20 text-success" :
                                  c.status === "paused" ? "bg-warning/20 text-warning" :
                                  c.status === "completed" ? "bg-info/20 text-info" :
                                  "bg-card-hover text-muted"
                                }`}>
                                  {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                                </span>
                                <span className="text-[10px] text-muted">{c.sequence.length}-email sequence</span>
                              </div>
                            </div>
                            <ChevronDown size={16} className={`text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </div>
                          <p className="text-xs text-muted/70 mt-2">{c.description}</p>
                          <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border/50">
                            <div>
                              <p className="text-lg font-semibold text-foreground">{c.sent}</p>
                              <p className="text-[10px] text-muted">Sent</p>
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-foreground">{c.opened}</p>
                              <p className="text-[10px] text-muted">Opened</p>
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-foreground">{c.replied}</p>
                              <p className="text-[10px] text-muted">Replied</p>
                            </div>
                          </div>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Sequence Timeline</p>
                            {c.sequence.map((email, idx) => (
                              <div key={idx} className="relative pl-6 border-l-2 border-coreconx/30 ml-2">
                                <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-coreconx border-2 border-card" />
                                <div className="bg-background border border-border rounded-lg p-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-coreconx/15 text-coreconx-light font-medium shrink-0">Day {email.day}</span>
                                        <span className="text-xs font-semibold text-foreground truncate">{email.label}</span>
                                      </div>
                                      <p className="text-xs text-muted mt-1 truncate">Subject: {email.subject}</p>
                                      <p className="text-xs text-muted/60 mt-0.5 line-clamp-1">{email.body.slice(0, 100)}...</p>
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setViewingSequenceEmail(email); }}
                                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-coreconx-light border border-coreconx/30 hover:bg-coreconx/10 transition-colors"
                                    >
                                      <Eye size={10} />
                                      View Full
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Templates list */}
          {subTab === "templates" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">Reusable email templates for agents &amp; manual replies</p>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-coreconx text-white text-xs font-medium hover:bg-coreconx/90 transition-colors">
                  <Plus size={12} />
                  New Template
                </button>
              </div>
              {templates.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <LayoutTemplate size={32} className="mx-auto text-muted/30" />
                  <p className="text-sm text-muted mt-3">No templates yet</p>
                  <p className="text-xs text-muted/60 mt-1">Create templates for common responses</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {["Outreach", "Follow-Up", "Support", "Sales"].map((category) => {
                    const catTemplates = templates.filter((t) => t.category === category);
                    if (catTemplates.length === 0) return null;
                    return (
                      <div key={category}>
                        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{category}</h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {catTemplates.map((t) => (
                            <button
                              key={t.id}
                              onClick={() => openTemplateEditor(t)}
                              className="bg-card border border-border rounded-xl p-4 text-left hover:border-coreconx/50 hover:bg-coreconx/5 transition-all group"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <h4 className="text-sm font-semibold text-foreground">{t.name}</h4>
                                  <p className="text-[10px] text-muted/60 mt-0.5">{t.description}</p>
                                </div>
                                <Edit3 size={12} className="text-muted/40 group-hover:text-coreconx-light transition-colors shrink-0" />
                              </div>
                              <p className="text-xs text-muted font-medium">Subject: {t.subject}</p>
                              <p className="text-xs text-muted/60 mt-1 line-clamp-2">{t.body}</p>
                              <div className="flex items-center flex-wrap gap-1 mt-2">
                                {t.variables.map((v) => (
                                  <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-coreconx/10 text-coreconx-light font-mono">{v}</span>
                                ))}
                              </div>
                              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
                                <span className="text-[10px] text-muted">Used {t.usedCount} times</span>
                                <span className="text-[10px] text-coreconx-light font-medium">Click to edit</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Thread Detail Modal */}
      <Modal
        open={!!selectedThread || loadingThread}
        onClose={() => {
          setSelectedThread(null);
          setLoadingThread(false);
          setShowReplyForm(false);
        }}
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
                    <p><span className="font-medium text-foreground">From:</span> {msg.from || "\u2014"}</p>
                    <p><span className="font-medium text-foreground">To:</span> {msg.to || "\u2014"}</p>
                    <p><span className="font-medium text-foreground">Date:</span> {msg.date || "\u2014"}</p>
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

            {/* Draft Reply Button */}
            {!showReplyForm && selectedThread.messages.length > 0 && (
              <button
                onClick={() => openReplyForm(selectedThread.messages![selectedThread.messages!.length - 1])}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-coreconx text-white text-sm font-medium hover:bg-coreconx/90 transition-colors"
              >
                <Reply size={14} />
                Draft Reply
              </button>
            )}

            {/* Draft Reply Form */}
            {showReplyForm && (
              <div className="bg-background rounded-lg border border-coreconx/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-card-hover/50 flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Reply size={14} className="text-coreconx-light" />
                    Draft Reply
                  </span>
                  <button onClick={() => setShowReplyForm(false)} className="text-muted hover:text-foreground">
                    <X size={14} />
                  </button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">To</label>
                      <input
                        value={replyTo}
                        onChange={(e) => setReplyTo(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-coreconx"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">From (alias)</label>
                      <select
                        value={replyFrom}
                        onChange={(e) => setReplyFrom(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-coreconx"
                      >
                        {aliases.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Subject</label>
                    <input
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-coreconx"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Body</label>
                    <textarea
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-coreconx resize-y"
                      placeholder="Write your reply..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowReplyForm(false)}
                      className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveDraftReply}
                      disabled={savingDraft || !replyTo || !replyBody}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-coreconx text-white text-sm font-medium hover:bg-coreconx/90 transition-colors disabled:opacity-50"
                    >
                      {savingDraft ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      Save Draft to Review
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted text-sm">No messages found in this thread.</p>
        )}
      </Modal>

      {/* Edit Draft Modal */}
      <Modal
        open={!!editingDraft}
        onClose={() => setEditingDraft(null)}
        title="Edit Draft"
        subtitle="Update the response before approving"
      >
        {editingDraft && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">To</label>
                <input
                  value={editTo}
                  onChange={(e) => setEditTo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-coreconx"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">From (alias)</label>
                <select
                  value={editFrom}
                  onChange={(e) => setEditFrom(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-coreconx"
                >
                  {aliases.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Subject</label>
              <input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-coreconx"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Body</label>
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-coreconx resize-y font-sans leading-relaxed"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setEditingDraft(null)}
                className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedDraft}
                disabled={savingDraft || !editTo || !editBody}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-coreconx text-white text-sm font-medium hover:bg-coreconx/90 transition-colors disabled:opacity-50"
              >
                {savingDraft ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                Save Changes
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Sequence Email Viewer Modal */}
      <Modal
        open={!!viewingSequenceEmail}
        onClose={() => setViewingSequenceEmail(null)}
        title={viewingSequenceEmail?.label || "Sequence Email"}
        subtitle={viewingSequenceEmail ? `Day ${viewingSequenceEmail.day}` : ""}
      >
        {viewingSequenceEmail && (
          <div className="space-y-4">
            <div className="bg-background rounded-lg border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-card-hover/50">
                <p className="text-xs text-muted"><span className="font-medium text-foreground">Subject:</span> {viewingSequenceEmail.subject}</p>
                <p className="text-xs text-muted mt-1"><span className="font-medium text-foreground">Trigger:</span> Day {viewingSequenceEmail.day}</p>
              </div>
              <div className="p-4">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{viewingSequenceEmail.body}</pre>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setViewingSequenceEmail(null)}
                className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Template Edit Modal */}
      <Modal
        open={!!editingTemplate}
        onClose={() => setEditingTemplate(null)}
        title={editingTemplate?.name || "Edit Template"}
        subtitle={editingTemplate ? `${editingTemplate.category} template` : ""}
      >
        {editingTemplate && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted block mb-1">Category</label>
              <p className="text-sm text-foreground">{editingTemplate.category}</p>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Description</label>
              <p className="text-sm text-foreground">{editingTemplate.description}</p>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Variables</label>
              <div className="flex flex-wrap gap-1">
                {editingTemplate.variables.map((v) => (
                  <span key={v} className="text-xs px-2 py-0.5 rounded bg-coreconx/10 text-coreconx-light font-mono">{v}</span>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Subject</label>
              <input
                value={editTemplateSubject}
                onChange={(e) => setEditTemplateSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-coreconx"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Body</label>
              <textarea
                value={editTemplateBody}
                onChange={(e) => setEditTemplateBody(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground focus:outline-none focus:border-coreconx resize-y font-sans leading-relaxed"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <button
                onClick={() => setEditingTemplate(null)}
                className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  // Mock: would open draft compose with template content
                }}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-coreconx/40 text-coreconx-light text-sm font-medium hover:bg-coreconx/10 transition-colors"
              >
                <FileText size={14} />
                Use in Draft
              </button>
              <button
                onClick={saveTemplate}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-coreconx text-white text-sm font-medium hover:bg-coreconx/90 transition-colors"
              >
                <CheckCheck size={14} />
                Save
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// --- Kanban Column Wrapper ---

function KanbanColumn({
  col,
  counts,
  children,
}: {
  col: typeof columnConfig[number];
  counts: Record<ColumnId, number>;
  children: React.ReactNode;
}) {
  const Icon = col.icon;
  return (
    <div className="bg-card border border-border rounded-xl flex flex-col min-h-[400px] max-h-[calc(100vh-280px)]">
      <div className="px-3 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Icon size={14} className={col.color} />
          <span className="text-sm font-semibold text-foreground">{col.label}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-card-hover text-muted font-medium">
          {counts[col.id]}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">{children}</div>
    </div>
  );
}

// --- Column Content ---

function ColumnContent({
  colId,
  inboxEmails,
  inProgressDrafts,
  reviewDrafts,
  sentEmails,
  loadingInbox,
  loadingDrafts,
  loadingSent,
  actionLoading,
  draftActionLoading,
  onOpenThread,
  onEmailAction,
  onApproveDraft,
  onDeleteDraft,
  onEditDraft,
}: {
  colId: ColumnId;
  inboxEmails: GmailThread[];
  inProgressDrafts: Draft[];
  reviewDrafts: Draft[];
  sentEmails: GmailThread[];
  loadingInbox: boolean;
  loadingDrafts: boolean;
  loadingSent: boolean;
  actionLoading: Record<string, string>;
  draftActionLoading: Record<string, string>;
  onOpenThread: (id: string) => void;
  onEmailAction: (id: string, action: "archive" | "mark-read" | "trash") => void;
  onApproveDraft: (id: string) => void;
  onDeleteDraft: (id: string) => void;
  onEditDraft: (draft: Draft) => void;
}) {
  if (colId === "inbox") {
    if (loadingInbox) return <LoadingState />;
    if (inboxEmails.length === 0) return <EmptyState icon={Inbox} text="Inbox empty" sub="No emails need a reply" />;
    return (
      <>
        {inboxEmails.map((email, i) => (
          <button
            key={email.id || i}
            onClick={() => email.id && onOpenThread(email.id)}
            className="w-full text-left rounded-xl border border-border bg-background p-4 hover:border-coreconx/50 hover:bg-coreconx/5 transition-all cursor-pointer group active:scale-[0.98]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm sm:text-base font-semibold text-foreground line-clamp-2 leading-snug">{email.subject || "(no subject)"}</p>
                <p className="text-xs sm:text-sm text-muted mt-1">{email.from || "\u2014"}</p>
              </div>
              <ExternalLink size={14} className="text-muted/40 group-hover:text-coreconx-light shrink-0 mt-1 transition-colors" />
            </div>
            {email.snippet && (
              <p className="text-xs sm:text-sm text-muted/70 mt-2 line-clamp-3 leading-relaxed">{email.snippet}</p>
            )}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
              <span className="text-[11px] text-muted">{email.date || ""}</span>
              <div className="flex items-center gap-2">
                {email.messageCount && email.messageCount > 1 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-card-hover text-muted font-medium">{email.messageCount} msgs</span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-info/15 text-info font-medium">Tap to open</span>
              </div>
            </div>
          </button>
        ))}
      </>
    );
  }

  if (colId === "drafts") {
    if (loadingDrafts) return <LoadingState />;
    if (inProgressDrafts.length === 0) {
      return (
        <EmptyState
          icon={Edit3}
          text="No drafts in progress"
          sub="Click 'Draft Reply' on an inbox email to start"
        />
      );
    }
    return (
      <>
        {inProgressDrafts.map((draft) => (
          <DraftCard
            key={draft.id}
            draft={draft}
            draftActionLoading={draftActionLoading}
            onEdit={onEditDraft}
            onDelete={onDeleteDraft}
          />
        ))}
      </>
    );
  }

  if (colId === "review") {
    if (loadingDrafts) return <LoadingState />;
    if (reviewDrafts.length === 0) return <EmptyState icon={Clock} text="Nothing to review" sub="Drafts will appear here for approval" />;
    return (
      <>
        {reviewDrafts.map((draft) => (
          <div
            key={draft.id}
            className="rounded-lg border border-coreconx/30 bg-background p-3"
          >
            <p className="text-sm font-medium text-foreground truncate">{draft.subject || "(no subject)"}</p>
            <p className="text-xs text-muted truncate mt-0.5">To: {draft.to || "\u2014"}</p>
            {draft.from && <p className="text-xs text-muted/60 truncate">From: {draft.from}</p>}
            <p className="text-xs text-muted/60 mt-1 line-clamp-2">{draft.body?.slice(0, 120) || "(no body)"}</p>
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
              <button
                onClick={() => onApproveDraft(draft.id)}
                disabled={!!draftActionLoading[draft.id]}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-success/20 text-success text-xs font-medium hover:bg-success/30 transition-colors disabled:opacity-50"
              >
                {draftActionLoading[draft.id] === "approve" ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <CheckCheck size={11} />
                )}
                Approve
              </button>
              <button
                onClick={() => onEditDraft(draft)}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
                title="Edit"
              >
                <Edit3 size={12} />
              </button>
              <button
                onClick={() => onDeleteDraft(draft.id)}
                disabled={!!draftActionLoading[draft.id]}
                className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                title="Delete"
              >
                {draftActionLoading[draft.id] === "delete" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Trash2 size={12} />
                )}
              </button>
            </div>
          </div>
        ))}
      </>
    );
  }

  if (colId === "sent") {
    if (loadingSent) return <LoadingState />;
    if (sentEmails.length === 0) return <EmptyState icon={Send} text="No sent emails" sub="Approved replies appear here" />;
    return (
      <>
        {sentEmails.map((email, i) => {
          // Simple spam risk heuristic based on labels
          const labels = email.labels || [];
          const isSpam = labels.some((l) => l.toLowerCase().includes("spam"));
          const isBounced = labels.some((l) => l.toLowerCase().includes("bounce") || l.toLowerCase().includes("failed"));
          const healthStatus = isSpam ? "spam" : isBounced ? "bounced" : "delivered";
          const HealthIcon = healthStatus === "delivered" ? ShieldCheck : healthStatus === "spam" ? ShieldAlert : ShieldQuestion;
          const healthColor = healthStatus === "delivered" ? "text-success" : healthStatus === "spam" ? "text-error" : "text-warning";
          const healthLabel = healthStatus === "delivered" ? "Delivered" : healthStatus === "spam" ? "Spam Risk" : "Bounced";

          return (
            <button
              key={email.id || i}
              onClick={() => email.id && onOpenThread(email.id)}
              className="w-full text-left rounded-xl border border-border bg-background p-4 hover:border-coreconx/50 hover:bg-coreconx/5 transition-all cursor-pointer group active:scale-[0.98]"
            >
              <p className="text-sm sm:text-base font-semibold text-foreground line-clamp-2 leading-snug">{email.subject || "(no subject)"}</p>
              <p className="text-xs sm:text-sm text-muted mt-1">To: {email.to || email.from || "\u2014"}</p>
              {email.snippet && (
                <p className="text-xs sm:text-sm text-muted/70 mt-2 line-clamp-2 leading-relaxed">{email.snippet}</p>
              )}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                <span className="text-[11px] text-muted">{email.date || ""}</span>
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    healthStatus === "delivered" ? "bg-success/15 text-success" :
                    healthStatus === "spam" ? "bg-error/15 text-error" :
                    "bg-warning/15 text-warning"
                  }`}>
                    <HealthIcon size={10} />
                    {healthLabel}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </>
    );
  }

  return null;
}

// --- Shared Components ---

function DraftCard({
  draft,
  draftActionLoading,
  onEdit,
  onDelete,
}: {
  draft: Draft;
  draftActionLoading: Record<string, string>;
  onEdit: (draft: Draft) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-warning/30 bg-background p-3">
      <p className="text-sm font-medium text-foreground truncate">{draft.subject || "(no subject)"}</p>
      <p className="text-xs text-muted truncate mt-0.5">To: {draft.to || "\u2014"}</p>
      {draft.from && <p className="text-xs text-muted/60 truncate">From: {draft.from}</p>}
      <p className="text-xs text-muted/60 mt-1 line-clamp-2">{draft.body?.slice(0, 120) || "(no body)"}</p>
      <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
        <button
          onClick={() => onEdit(draft)}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-warning/20 text-warning text-xs font-medium hover:bg-warning/30 transition-colors"
        >
          <Edit3 size={11} />
          Edit
        </button>
        <button
          onClick={() => onDelete(draft.id)}
          disabled={!!draftActionLoading[draft.id]}
          className="p-1.5 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
          title="Delete"
        >
          {draftActionLoading[draft.id] === "delete" ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Trash2 size={12} />
          )}
        </button>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={20} className="text-muted animate-spin" />
    </div>
  );
}

function EmptyState({ icon: Icon, text, sub }: { icon: typeof Inbox; text: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon size={24} className="text-muted/30" />
      <p className="text-xs text-muted mt-2">{text}</p>
      <p className="text-[10px] text-muted/60 mt-0.5">{sub}</p>
    </div>
  );
}
