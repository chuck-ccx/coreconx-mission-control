"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckSquare, Circle, Clock, CheckCircle2, Loader2, RefreshCw, ChevronRight } from "lucide-react";
import { Modal } from "@/components/modal";
import { apiFetch } from "@/lib/api";

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  state: { id: string; name: string; color: string; type: string } | null;
  assignee: { name: string } | null;
  createdAt: string;
  updatedAt: string;
  project: { name: string } | null;
  labels: { nodes: { name: string; color: string }[] } | null;
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<LinearIssue | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [tasksData, statesData] = await Promise.all([
      apiFetch<LinearIssue[]>("/api/tasks"),
      apiFetch<WorkflowState[]>("/api/tasks/states"),
    ]);

    if (tasksData && Array.isArray(tasksData)) setIssues(tasksData);
    if (statesData && Array.isArray(statesData)) setStates(statesData);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const issuesByColumn = (colId: ColumnId) =>
    issues.filter(i => i.state && mapStateToColumn(i.state.type) === colId);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
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
      <div className="grid grid-cols-4 gap-3">
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
      <div className="grid grid-cols-4 gap-4 min-h-[500px]">
        {columns.map(col => {
          const colIssues = issuesByColumn(col.id);
          return (
            <div key={col.id} className="space-y-3">
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
                      className={`w-full text-left bg-card border border-border rounded-lg p-4 hover:border-coreconx/40 transition-colors cursor-pointer ${isUpdating ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-mono text-muted">{issue.identifier}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.class}`}>{p.label}</span>
                      </div>
                      <h4 className="text-sm font-medium text-foreground mt-2">{issue.title}</h4>
                      {issue.description && (
                        <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-2">{issue.description}</p>
                      )}
                      <div className="flex items-center justify-between mt-3">
                        {issue.assignee ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-coreconx/20 text-coreconx-light">{issue.assignee.name}</span>
                        ) : (
                          <span className="text-[10px] text-muted">Unassigned</span>
                        )}
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
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${(priorityLabels[selectedIssue.priority] || priorityLabels[0]).class}`}>
                {(priorityLabels[selectedIssue.priority] || priorityLabels[0]).label}
              </span>
              {selectedIssue.assignee && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-coreconx/20 text-coreconx-light">{selectedIssue.assignee.name}</span>
              )}
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
              <div className="flex gap-2">
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
          </div>
        )}
      </Modal>
    </div>
  );
}
