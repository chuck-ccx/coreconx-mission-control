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
  // For now, all Gmail drafts go to Review since agents create them ready to send
  // The "Drafts" column is for in-progress work (future: local state before saving to Gmail)
  const reviewDrafts = drafts;
  const inProgressDrafts: Draft[] = []; // Future: local drafts being edited

  // --- Counts ---
  const counts: Record<ColumnId, number> = {
    inbox: inboxEmails.length,
    drafts: inProgressDrafts.length,
    review: reviewDrafts.length,
    sent: sentEmails.length,
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
            Response pipeline — Inbox → Draft → Review → Sent
          </p>
        </div>
        <button
          onClick={refreshAll}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-lg text-sm hover:bg-card-hover transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
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
              inboxEmails={inboxEmails}
              inProgressDrafts={inProgressDrafts}
              reviewDrafts={reviewDrafts}
              sentEmails={sentEmails}
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
          inboxEmails={inboxEmails}
          inProgressDrafts={inProgressDrafts}
          reviewDrafts={reviewDrafts}
          sentEmails={sentEmails}
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
          <div
            key={email.id || i}
            className="rounded-lg border border-border bg-background p-3 hover:border-coreconx/40 transition-colors"
          >
            <button
              onClick={() => email.id && onOpenThread(email.id)}
              className="w-full text-left"
            >
              <p className="text-sm font-medium text-foreground truncate">{email.subject || "(no subject)"}</p>
              <p className="text-xs text-muted truncate mt-0.5">{email.from || "\u2014"}</p>
              {email.snippet && (
                <p className="text-xs text-muted/60 mt-1 line-clamp-2">{email.snippet}</p>
              )}
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted">{email.date || ""}</span>
                {email.messageCount && email.messageCount > 1 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-card-hover text-muted">{email.messageCount} msgs</span>
                )}
              </div>
            </button>
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/50">
              <button
                onClick={() => email.id && onEmailAction(email.id, "archive")}
                disabled={!!actionLoading[email.id || ""]}
                title="Archive"
                className="p-1.5 rounded text-muted hover:text-foreground hover:bg-card-hover transition-colors disabled:opacity-50"
              >
                {actionLoading[email.id || ""] === "archive" ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
              </button>
              <button
                onClick={() => email.id && onEmailAction(email.id, "mark-read")}
                disabled={!!actionLoading[email.id || ""]}
                title="Mark read"
                className="p-1.5 rounded text-muted hover:text-foreground hover:bg-card-hover transition-colors disabled:opacity-50"
              >
                {actionLoading[email.id || ""] === "mark-read" ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
              </button>
              <button
                onClick={() => email.id && onEmailAction(email.id, "trash")}
                disabled={!!actionLoading[email.id || ""]}
                title="Trash"
                className="p-1.5 rounded text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
              >
                {actionLoading[email.id || ""] === "trash" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            </div>
          </div>
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
        {sentEmails.map((email, i) => (
          <button
            key={email.id || i}
            onClick={() => email.id && onOpenThread(email.id)}
            className="w-full text-left rounded-lg border border-border bg-background p-3 hover:border-coreconx/40 transition-colors"
          >
            <p className="text-sm font-medium text-foreground truncate">{email.subject || "(no subject)"}</p>
            <p className="text-xs text-muted truncate mt-0.5">To: {email.to || email.from || "\u2014"}</p>
            {email.snippet && (
              <p className="text-xs text-muted/60 mt-1 line-clamp-2">{email.snippet}</p>
            )}
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-muted">{email.date || ""}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-success/20 text-success">Sent</span>
            </div>
          </button>
        ))}
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
