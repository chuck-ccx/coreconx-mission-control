"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { CheckSquare, Circle, Clock, CheckCircle2, Loader2, RefreshCw, ThumbsUp, Trash2, X, UserCircle, ChevronDown } from "lucide-react";
import { Modal } from "@/components/modal";
import { apiFetch } from "@/lib/api";
import { useRealtime } from "@/lib/use-realtime";

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  state: { id: string; name: string; color: string; type: string } | null;
  assignee: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  project: { name: string } | null;
  labels: { nodes: { name: string; color: string }[] } | null;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface WorkflowState {
  id: string;
  name: string;
  color: string;
  type: string;
  position: number;
}

type ColumnId = "backlog" | "todo" | "in-progress" | "done";

function mapStateToColumn(stateType: string): ColumnId {
  switch (stateType) {
    case "completed": return "done";
    case "started": return "in-progress";
    case "unstarted": return "todo";
    default: return "backlog";
  }
}

const priorityLabels: Record<number, { label: string; class: string }> = {
  0: { label: "none", class: "bg-border text-muted" },
  1: { label: "urgent", class: "bg-danger/20 text-danger" },
  2: { label: "high", class: "bg-warning/20 text-warning" },
  3: { label: "medium", class: "bg-info/20 text-info" },
  4: { label: "low", class: "bg-border text-muted" },
};

const columns: { id: ColumnId; label: string; icon: typeof Circle; color: string; stateType: string }[] = [
  { id: "backlog", label: "Backlog", icon: Circle, color: "text-muted", stateType: "backlog" },
  { id: "todo", label: "Todo", icon: Circle, color: "text-foreground", stateType: "unstarted" },
  { id: "in-progress", label: "In Progress", icon: Clock, color: "text-warning", stateType: "started" },
  { id: "done", label: "Done", icon: CheckCircle2, color: "text-success", stateType: "completed" },
];

export default function TasksPage() {
  const [issues, setIssues] = useState<LinearIssue[]>([]);
  const [states, setStates] = useState<WorkflowState[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<LinearIssue | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [assignDropdown, setAssignDropdown] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [priorityDropdown, setPriorityDropdown] = useState<string | null>(null);
  const [changingPriority, setChangingPriority] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [tasksData, statesData, membersData] = await Promise.all([
      apiFetch<LinearIssue[]>("/api/tasks"),
      apiFetch<WorkflowState[]>("/api/tasks/states"),
      apiFetch<TeamMember[]>("/api/tasks/members"),
    ]);

    if (tasksData && Array.isArray(tasksData)) setIssues(tasksData);
    if (statesData && Array.isArray(statesData)) setStates(statesData);
    if (membersData && Array.isArray(membersData)) setMembers(membersData);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]); // eslint-disable-line react-hooks/set-state-in-effect

  // Real-time sync: refresh when tasks table changes in Supabase
  const refreshTasks = useCallback(() => { void fetchData(true); }, [fetchData]);
  useRealtime("tasks", refreshTasks);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const moveTask = async (issue: LinearIssue, targetColumnId: ColumnId) => {
    const targetStateType = columns.find(c => c.id === targetColumnId)?.stateType;
    const targetState = states.find(s => s.type === targetStateType);
    if (!targetState) return;

    setUpdating(issue.id);

    const result = await apiFetch<{ id: string }>(`/api/tasks/${issue.id}`, {
      method: "PATCH",
      body: JSON.stringify({ stateId: targetState.id }),
    });

    if (result) {
      // Update local state
      setIssues(prev => prev.map(i =>
        i.id === issue.id
          ? { ...i, state: { id: targetState.id, name: targetState.name, color: targetState.color, type: targetState.type } }
          : i
      ));
      // Update selected issue if it's the one we moved
      if (selectedIssue?.id === issue.id) {
        setSelectedIssue(prev => prev ? { ...prev, state: { id: targetState.id, name: targetState.name, color: targetState.color, type: targetState.type } } : null);
      }
    }
    setUpdating(null);
  };

  const isApproved = (issue: LinearIssue) =>
    issue.labels?.nodes?.some(l => l.name === "Approved") ?? false;

  const approveTask = async (issue: LinearIssue) => {
    setApproving(issue.id);
    const approved = isApproved(issue);
    const endpoint = approved ? "unapprove" : "approve";

    const result = await apiFetch<{ approved?: boolean; unapproved?: boolean }>(`/api/tasks/${issue.id}/${endpoint}`, {
      method: "POST",
    });

    if (result) {
      // Refresh data to get updated labels
      await fetchData(true);
    }
    setApproving(null);
  };

  const deleteTask = async (issue: LinearIssue) => {
    setDeleting(issue.id);

    const result = await apiFetch<{ deleted: boolean }>(`/api/tasks/${issue.id}`, {
      method: "DELETE",
    });

    if (result?.deleted) {
      setIssues(prev => prev.filter(i => i.id !== issue.id));
      if (selectedIssue?.id === issue.id) setSelectedIssue(null);
    }
    setDeleting(null);
    setConfirmDelete(null);
  };

  const assignTask = async (issue: LinearIssue, userId: string | null) => {
    setAssigning(issue.id);
    setAssignDropdown(null);

    const result = await apiFetch<{ assigned: boolean; assignee: { name: string; id: string } | null }>(`/api/tasks/${issue.id}/assign`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });

    if (result?.assigned) {
      await fetchData(true);
    }
    setAssigning(null);
  };

  const changePriority = async (issue: LinearIssue, priority: number) => {
    setPriorityDropdown(null);
    if (issue.priority === priority) return;
    setChangingPriority(issue.id);

    // Optimistic update
    setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, priority } : i));
    if (selectedIssue?.id === issue.id) {
      setSelectedIssue(prev => prev ? { ...prev, priority } : null);
    }

    const result = await apiFetch<{ id: string }>(`/api/tasks/${issue.id}`, {
      method: "PATCH",
      body: JSON.stringify({ priority }),
    });

    if (!result) {
      // Revert on failure
      setIssues(prev => prev.map(i => i.id === issue.id ? { ...i, priority: issue.priority } : i));
      if (selectedIssue?.id === issue.id) {
        setSelectedIssue(prev => prev ? { ...prev, priority: issue.priority } : null);
      }
    }
    setChangingPriority(null);
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAssignDropdown(null);
      }
      if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(e.target as Node)) {
        setPriorityDropdown(null);
      }
    };
    if (assignDropdown || priorityDropdown) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [assignDropdown, priorityDropdown]);

  // Helper: get effective assignee name (check for agent labels if no Linear assignee)
  const getAssigneeName = (issue: LinearIssue): string | null => {
    if (issue.assignee?.name) return issue.assignee.name;
    if (issue.labels?.nodes?.some(l => l.name === "Assigned: Chuck")) return "Chuck (AI)";
    if (issue.labels?.nodes?.some(l => l.name === "Assigned: Code Agent")) return "Code Agent";
    return null;
  };

  const issuesByColumn = (colId: ColumnId) =>
    issues.filter(i => i.state && mapStateToColumn(i.state.type) === colId);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <CheckSquare size={24} className="text-coreconx-light" />
            Task Board
          </h1>
          <p className="text-muted text-sm mt-1">
            {loading ? (
              <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading from Linear...</span>
            ) : (
              <span>
                Live from Linear — {issues.length} active tasks
                {lastUpdated && <span className="ml-2 text-muted/60">· Updated {lastUpdated.toLocaleTimeString()}</span>}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-card border border-border rounded-lg hover:border-coreconx/40 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {columns.map(col => {
          const count = issuesByColumn(col.id).length;
          return (
            <div key={col.id} className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
              <col.icon size={18} className={col.color} />
              <div>
                <p className="text-lg font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted">{col.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className="flex md:grid md:grid-cols-4 gap-4 min-h-[500px] overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none md:overflow-visible">
        {columns.map(col => {
          const colIssues = issuesByColumn(col.id);
          return (
            <div key={col.id} className="min-w-[280px] md:min-w-0 snap-start space-y-3">
              <div className="flex items-center gap-2 px-1">
                <col.icon size={16} className={col.color} />
                <h3 className="text-sm font-medium text-foreground">{col.label}</h3>
                <span className="text-xs text-muted bg-border/50 px-1.5 py-0.5 rounded">{colIssues.length}</span>
              </div>
              <div className="space-y-2">
                {colIssues.map(issue => {
                  const p = priorityLabels[issue.priority] || priorityLabels[0];
                  const isUpdating = updating === issue.id;
                  return (
                    <button
                      key={issue.id}
                      onClick={() => setSelectedIssue(issue)}
                      className={`w-full text-left bg-card border rounded-lg p-4 hover:border-coreconx/40 transition-colors cursor-pointer ${isUpdating ? "opacity-50" : ""} ${
                        col.id === "in-progress"
                          ? "border-coreconx/60 ring-1 ring-coreconx/30 animate-pulse-subtle"
                          : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-mono text-muted">{issue.identifier}</span>
                        <div className="relative" ref={priorityDropdown === issue.id ? priorityDropdownRef : undefined}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPriorityDropdown(priorityDropdown === issue.id ? null : issue.id); }}
                            disabled={changingPriority === issue.id}
                            className={`text-[10px] px-2 py-0.5 rounded-full font-medium cursor-pointer hover:ring-1 hover:ring-coreconx/40 transition-colors flex items-center gap-1 ${p.class} disabled:opacity-50`}
                          >
                            {changingPriority === issue.id ? <Loader2 size={10} className="animate-spin" /> : null}
                            {p.label}
                            <ChevronDown size={8} />
                          </button>
                          {priorityDropdown === issue.id && (
                            <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[120px]">
                              {[1, 2, 3, 4, 0].map(pr => (
                                <button
                                  key={pr}
                                  onClick={(e) => { e.stopPropagation(); changePriority(issue, pr); }}
                                  className={`w-full text-left px-3 py-1.5 text-xs hover:bg-border/50 transition-colors flex items-center gap-2 ${
                                    issue.priority === pr ? "font-medium" : "text-foreground"
                                  }`}
                                >
                                  <span className={`w-2 h-2 rounded-full ${priorityLabels[pr].class}`} />
                                  <span className={issue.priority === pr ? priorityLabels[pr].class.split(" ")[1] : ""}>{priorityLabels[pr].label}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <h4 className="text-sm font-medium text-foreground mt-2">{issue.title}</h4>
                      {issue.description && (
                        <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">{issue.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        <div className="relative" ref={assignDropdown === issue.id ? dropdownRef : undefined}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setAssignDropdown(assignDropdown === issue.id ? null : issue.id); }}
                            disabled={assigning === issue.id}
                            className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                              getAssigneeName(issue)
                                ? "bg-coreconx/20 text-coreconx-light hover:bg-coreconx/30"
                                : "text-muted hover:text-foreground hover:bg-border/50"
                            } disabled:opacity-50`}
                            title="Click to assign"
                          >
                            {assigning === issue.id ? <Loader2 size={10} className="animate-spin" /> : <UserCircle size={10} />}
                            {getAssigneeName(issue) || "Unassigned"}
                            <ChevronDown size={8} />
                          </button>
                          {assignDropdown === issue.id && (
                            <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                              {members.map(m => (
                                <button
                                  key={m.id}
                                  onClick={(e) => { e.stopPropagation(); assignTask(issue, m.id); }}
                                  className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-border/50 transition-colors flex items-center gap-2 ${
                                    (getAssigneeName(issue) === m.name) ? "text-coreconx-light font-medium" : "text-foreground"
                                  }`}
                                >
                                  <UserCircle size={12} />
                                  {m.name}
                                </button>
                              ))}
                              <div className="border-t border-border my-1" />
                              <button
                                onClick={(e) => { e.stopPropagation(); assignTask(issue, null); }}
                                className="w-full text-left px-3 py-1.5 text-[11px] text-muted hover:bg-border/50 transition-colors flex items-center gap-2"
                              >
                                <X size={12} />
                                Unassign
                              </button>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-muted">
                          {new Date(issue.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      {issue.labels?.nodes && issue.labels.nodes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {issue.labels.nodes.map(l => (
                            <span key={l.name} className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: l.color + "20", color: l.color }}>{l.name}</span>
                          ))}
                        </div>
                      )}
                      {/* Approve & Delete buttons */}
                      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
                        <button
                          onClick={(e) => { e.stopPropagation(); approveTask(issue); }}
                          disabled={approving === issue.id}
                          className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border transition-colors ${
                            isApproved(issue)
                              ? "bg-success/20 border-success/40 text-success font-medium"
                              : "border-border text-muted hover:border-success/40 hover:text-success"
                          } disabled:opacity-50`}
                          title={isApproved(issue) ? "Revoke approval" : "Approve — Chuck will work on this"}
                        >
                          {approving === issue.id ? <Loader2 size={10} className="animate-spin" /> : <ThumbsUp size={10} />}
                          {isApproved(issue) ? "Approved" : "Approve"}
                        </button>
                        {confirmDelete === issue.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteTask(issue); }}
                              disabled={deleting === issue.id}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border border-danger/40 bg-danger/20 text-danger font-medium disabled:opacity-50"
                            >
                              {deleting === issue.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                              Confirm
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmDelete(null); }}
                              className="flex items-center px-1.5 py-1 text-[10px] rounded-md border border-border text-muted hover:text-foreground"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmDelete(issue.id); }}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] rounded-md border border-border text-muted hover:border-danger/40 hover:text-danger transition-colors"
                            title="Delete task"
                          >
                            <Trash2 size={10} />
                            Delete
                          </button>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Detail Modal */}
      <Modal
        open={!!selectedIssue}
        onClose={() => setSelectedIssue(null)}
        title={selectedIssue ? `${selectedIssue.identifier} — ${selectedIssue.title}` : ""}
        subtitle={selectedIssue?.state?.name || ""}
      >
        {selectedIssue && (
          <div className="space-y-4">
            {/* Meta */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative" ref={priorityDropdown === selectedIssue.id ? priorityDropdownRef : undefined}>
                <button
                  onClick={() => setPriorityDropdown(priorityDropdown === selectedIssue.id ? null : selectedIssue.id)}
                  disabled={changingPriority === selectedIssue.id}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors cursor-pointer hover:ring-1 hover:ring-coreconx/40 ${(priorityLabels[selectedIssue.priority] || priorityLabels[0]).class} disabled:opacity-50`}
                >
                  {changingPriority === selectedIssue.id ? <Loader2 size={12} className="animate-spin" /> : null}
                  {(priorityLabels[selectedIssue.priority] || priorityLabels[0]).label}
                  <ChevronDown size={10} />
                </button>
                {priorityDropdown === selectedIssue.id && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[130px]">
                    {[1, 2, 3, 4, 0].map(p => (
                      <button
                        key={p}
                        onClick={() => changePriority(selectedIssue, p)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-border/50 transition-colors flex items-center gap-2 ${
                          selectedIssue.priority === p ? "font-medium" : "text-foreground"
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${priorityLabels[p].class}`} />
                        <span className={selectedIssue.priority === p ? priorityLabels[p].class.split(" ")[1] : ""}>{priorityLabels[p].label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" ref={assignDropdown === selectedIssue.id ? dropdownRef : undefined}>
                <button
                  onClick={() => setAssignDropdown(assignDropdown === selectedIssue.id ? null : selectedIssue.id)}
                  disabled={assigning === selectedIssue.id}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    getAssigneeName(selectedIssue)
                      ? "bg-coreconx/20 text-coreconx-light hover:bg-coreconx/30"
                      : "bg-border/50 text-muted hover:text-foreground"
                  } disabled:opacity-50`}
                >
                  {assigning === selectedIssue.id ? <Loader2 size={12} className="animate-spin" /> : <UserCircle size={12} />}
                  {getAssigneeName(selectedIssue) || "Unassigned"}
                  <ChevronDown size={10} />
                </button>
                {assignDropdown === selectedIssue.id && (
                  <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]">
                    {members.map(m => (
                      <button
                        key={m.id}
                        onClick={() => assignTask(selectedIssue, m.id)}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-border/50 transition-colors flex items-center gap-2 ${
                          (getAssigneeName(selectedIssue) === m.name) ? "text-coreconx-light font-medium" : "text-foreground"
                        }`}
                      >
                        <UserCircle size={14} />
                        {m.name}
                      </button>
                    ))}
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => assignTask(selectedIssue, null)}
                      className="w-full text-left px-3 py-2 text-xs text-muted hover:bg-border/50 transition-colors flex items-center gap-2"
                    >
                      <X size={14} />
                      Unassign
                    </button>
                  </div>
                )}
              </div>
              {selectedIssue.project && (
                <span className="text-xs text-muted">Project: {selectedIssue.project.name}</span>
              )}
              <span className="text-xs text-muted">Updated {new Date(selectedIssue.updatedAt).toLocaleDateString()}</span>
            </div>

            {/* Description */}
            {selectedIssue.description && (
              <div className="bg-background rounded-lg p-4 border border-border">
                <h4 className="text-xs font-medium text-muted mb-2">Description</h4>
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{selectedIssue.description}</pre>
              </div>
            )}

            {/* Move Task */}
            <div className="bg-background rounded-lg p-4 border border-border">
              <h4 className="text-xs font-medium text-muted mb-3">Move to</h4>
              <div className="flex flex-wrap gap-2">
                {columns.map(col => {
                  const currentCol = selectedIssue.state ? mapStateToColumn(selectedIssue.state.type) : "backlog";
                  const isCurrent = col.id === currentCol;
                  return (
                    <button
                      key={col.id}
                      onClick={() => !isCurrent && moveTask(selectedIssue, col.id)}
                      disabled={isCurrent || updating === selectedIssue.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                        isCurrent
                          ? "bg-coreconx/20 border-coreconx/40 text-coreconx-light font-medium"
                          : "border-border text-muted hover:border-coreconx/40 hover:text-foreground"
                      } disabled:opacity-50`}
                    >
                      {updating === selectedIssue.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <col.icon size={12} />
                      )}
                      {col.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Labels */}
            {selectedIssue.labels?.nodes && selectedIssue.labels.nodes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedIssue.labels.nodes.map(l => (
                  <span key={l.name} className="text-xs px-2 py-1 rounded" style={{ backgroundColor: l.color + "20", color: l.color }}>{l.name}</span>
                ))}
              </div>
            )}

            {/* Approve & Delete Actions */}
            <div className="bg-background rounded-lg p-4 border border-border">
              <h4 className="text-xs font-medium text-muted mb-3">Actions</h4>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => approveTask(selectedIssue)}
                  disabled={approving === selectedIssue.id}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg border transition-colors ${
                    isApproved(selectedIssue)
                      ? "bg-success/20 border-success/40 text-success font-medium"
                      : "border-border text-muted hover:border-success/40 hover:text-success"
                  } disabled:opacity-50`}
                >
                  {approving === selectedIssue.id ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}
                  {isApproved(selectedIssue) ? "Approved — Chuck will work on this" : "Approve for Chuck"}
                </button>
                {confirmDelete === selectedIssue.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteTask(selectedIssue)}
                      disabled={deleting === selectedIssue.id}
                      className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-danger/40 bg-danger/20 text-danger font-medium disabled:opacity-50"
                    >
                      {deleting === selectedIssue.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="flex items-center px-3 py-2 text-sm rounded-lg border border-border text-muted hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(selectedIssue.id)}
                    className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-border text-muted hover:border-danger/40 hover:text-danger transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete Task
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
