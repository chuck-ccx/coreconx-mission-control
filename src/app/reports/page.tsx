"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  Target,
  Drill,
  Clock,
  Loader2,
  RefreshCw,
  ChevronDown,
  Building2,
  Layers,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/* ---------- types ---------- */
interface Project {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  company_id: string | null;
}

interface Hole {
  id: string;
  project_id: string;
  name: string;
  planned_depth: number | null;
  actual_depth: number | null;
  status: string;
}

interface Shift {
  id: string;
  hole_id: string;
  project_id: string | null;
  start_time: string;
  end_time: string | null;
  crew: string | null;
}

interface Run {
  id: string;
  shift_id: string;
  hole_id: string | null;
  depth_from: number | null;
  depth_to: number | null;
  recovered: number | null;
}

interface CompanyRow {
  id: string;
  name: string;
}

/* ---------- helpers ---------- */
function round(n: number, d = 1): number {
  return Math.round(n * 10 ** d) / 10 ** d;
}

function shiftHours(s: Shift): number {
  if (!s.end_time) return 0;
  return (new Date(s.end_time).getTime() - new Date(s.start_time).getTime()) / 3_600_000;
}

/* ---------- component ---------- */
export default function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [projectDropdown, setProjectDropdown] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const [pRes, hRes, sRes, rRes, cRes] = await Promise.all([
      supabase.from("projects").select("*").order("name"),
      supabase.from("holes").select("*"),
      supabase.from("shifts").select("*"),
      supabase.from("runs").select("*"),
      supabase.from("companies").select("id, name").order("name"),
    ]);

    if (pRes.data) setProjects(pRes.data as Project[]);
    if (hRes.data) setHoles(hRes.data as Hole[]);
    if (sRes.data) setShifts(sRes.data as Shift[]);
    if (rRes.data) setRuns(rRes.data as Run[]);
    if (cRes.data) setCompanies(cRes.data as CompanyRow[]);

    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]); // eslint-disable-line react-hooks/set-state-in-effect

  /* ---------- derived metrics ---------- */
  const filteredProjects =
    selectedProject === "all" ? projects : projects.filter((p) => p.id === selectedProject);
  const projectIds = new Set(filteredProjects.map((p) => p.id));
  const fHoles = holes.filter((h) => projectIds.has(h.project_id));
  const fShifts = shifts.filter(
    (s) => (s.project_id && projectIds.has(s.project_id)) || fHoles.some((h) => h.id === s.hole_id),
  );
  const fShiftIds = new Set(fShifts.map((s) => s.id));
  const holeIds = new Set(fHoles.map((h) => h.id));
  const fRuns = runs.filter((r) => fShiftIds.has(r.shift_id) || (r.hole_id && holeIds.has(r.hole_id)));

  // Total meters drilled
  const totalMeters = fRuns.reduce((sum, r) => {
    if (r.depth_from != null && r.depth_to != null) return sum + Math.abs(r.depth_to - r.depth_from);
    return sum;
  }, 0);

  // Total shift hours
  const totalShiftHrs = fShifts.reduce((sum, s) => sum + shiftHours(s), 0);

  // Meters per shift
  const metersPerShift = fShifts.length > 0 ? totalMeters / fShifts.length : 0;

  // Recovery rate
  const totalRecoverable = fRuns.reduce((sum, r) => {
    if (r.depth_from != null && r.depth_to != null) return sum + Math.abs(r.depth_to - r.depth_from);
    return sum;
  }, 0);
  const totalRecovered = fRuns.reduce((sum, r) => sum + (r.recovered ?? 0), 0);
  const recoveryRate = totalRecoverable > 0 ? (totalRecovered / totalRecoverable) * 100 : 0;

  // Project completion
  const completedHoles = fHoles.filter((h) => h.status === "completed" || h.status === "done").length;
  const completionRate = fHoles.length > 0 ? (completedHoles / fHoles.length) * 100 : 0;

  // Planned vs actual depth
  const totalPlanned = fHoles.reduce((sum, h) => sum + (h.planned_depth ?? 0), 0);
  const totalActual = fHoles.reduce((sum, h) => sum + (h.actual_depth ?? 0), 0);
  const depthVariance = totalPlanned > 0 ? ((totalActual - totalPlanned) / totalPlanned) * 100 : 0;

  // Per-project breakdown
  const projectStats = filteredProjects.map((p) => {
    const ph = holes.filter((h) => h.project_id === p.id);
    const phIds = new Set(ph.map((h) => h.id));
    const ps = shifts.filter(
      (s) => s.project_id === p.id || ph.some((h) => h.id === s.hole_id),
    );
    const psIds = new Set(ps.map((s) => s.id));
    const pr = runs.filter((r) => psIds.has(r.shift_id) || (r.hole_id && phIds.has(r.hole_id)));
    const meters = pr.reduce((sum, r) => {
      if (r.depth_from != null && r.depth_to != null) return sum + Math.abs(r.depth_to - r.depth_from);
      return sum;
    }, 0);
    const done = ph.filter((h) => h.status === "completed" || h.status === "done").length;
    const company = companies.find((c) => c.id === p.company_id);
    return {
      ...p,
      holes: ph.length,
      holesCompleted: done,
      shifts: ps.length,
      meters: round(meters),
      mps: ps.length > 0 ? round(meters / ps.length) : 0,
      companyName: company?.name ?? "—",
    };
  });

  // Per-shift timeline (latest 20)
  const shiftTimeline = [...fShifts]
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())
    .slice(0, 20)
    .map((s) => {
      const sRuns = fRuns.filter((r) => r.shift_id === s.id);
      const meters = sRuns.reduce((sum, r) => {
        if (r.depth_from != null && r.depth_to != null) return sum + Math.abs(r.depth_to - r.depth_from);
        return sum;
      }, 0);
      return { ...s, meters: round(meters), hours: round(shiftHours(s)) };
    });

  const maxShiftMeters = Math.max(...shiftTimeline.map((s) => s.meters), 1);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 size={24} className="text-coreconx-light" />
            Reports &amp; Analytics
          </h1>
          <p className="text-muted text-sm mt-1">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading drilling data...
              </span>
            ) : (
              <span>
                {projects.length} projects &middot; {holes.length} holes &middot; {shifts.length} shifts
                {lastUpdated && (
                  <span className="ml-2 text-muted/60">
                    &middot; Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Project filter */}
          <div className="relative">
            <button
              onClick={() => setProjectDropdown(!projectDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-card border border-border rounded-lg hover:border-coreconx/40 transition-colors"
            >
              <Layers size={14} />
              {selectedProject === "all" ? "All Projects" : projects.find((p) => p.id === selectedProject)?.name ?? "All"}
              <ChevronDown size={14} />
            </button>
            {projectDropdown && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-h-64 overflow-y-auto">
                <button
                  onClick={() => { setSelectedProject("all"); setProjectDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-border/50 transition-colors ${selectedProject === "all" ? "text-coreconx-light font-medium" : "text-foreground"}`}
                >
                  All Projects
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProject(p.id); setProjectDropdown(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-border/50 transition-colors ${selectedProject === p.id ? "text-coreconx-light font-medium" : "text-foreground"}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
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
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted text-sm">Total Meters Drilled</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{round(totalMeters)} m</p>
              <p className="text-xs text-muted mt-1">{fShifts.length} shifts</p>
            </div>
            <div className="p-2 rounded-lg bg-coreconx/10 text-coreconx-light">
              <Drill size={20} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted text-sm">Meters / Shift</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{round(metersPerShift)} m</p>
              <p className="text-xs text-muted mt-1">{round(totalShiftHrs)} hrs total</p>
            </div>
            <div className="p-2 rounded-lg bg-info/10 text-info">
              <TrendingUp size={20} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted text-sm">Hole Completion</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{round(completionRate)}%</p>
              <p className="text-xs text-muted mt-1">
                {completedHoles} / {fHoles.length} holes
              </p>
            </div>
            <div className="p-2 rounded-lg bg-success/10 text-success">
              <Target size={20} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted text-sm">Core Recovery</p>
              <p className="text-2xl font-semibold text-foreground mt-1">{round(recoveryRate)}%</p>
              <p className="text-xs text-muted mt-1">
                {round(totalRecovered)} / {round(totalRecoverable)} m
              </p>
            </div>
            <div className="p-2 rounded-lg bg-warning/10 text-warning">
              <Layers size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Depth variance banner */}
      {totalPlanned > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <Clock size={18} className="text-muted" />
          <div className="flex-1">
            <p className="text-sm text-foreground font-medium">Planned vs Actual Depth</p>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-coreconx-light rounded-full transition-all"
                  style={{ width: `${Math.min((totalActual / totalPlanned) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs text-muted whitespace-nowrap">
                {round(totalActual)} / {round(totalPlanned)} m
                <span className={`ml-1 ${depthVariance >= 0 ? "text-success" : "text-danger"}`}>
                  ({depthVariance >= 0 ? "+" : ""}{round(depthVariance)}%)
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Project Breakdown */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
              <Building2 size={16} className="text-coreconx-light" />
              Project Breakdown
            </h2>
          </div>
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {projectStats.length === 0 && !loading && (
              <p className="p-4 text-sm text-muted text-center">No project data found</p>
            )}
            {projectStats.map((p) => (
              <div key={p.id} className="p-4 hover:bg-card-hover transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted mt-0.5">{p.companyName}</p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.status === "active" || p.status === "in_progress"
                        ? "bg-success/20 text-success"
                        : p.status === "completed" || p.status === "done"
                          ? "bg-info/20 text-info"
                          : "bg-border text-muted"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <div>
                    <p className="text-lg font-semibold text-foreground">{p.holes}</p>
                    <p className="text-[10px] text-muted">Holes</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{p.meters}</p>
                    <p className="text-[10px] text-muted">Meters</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{p.shifts}</p>
                    <p className="text-[10px] text-muted">Shifts</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">{p.mps}</p>
                    <p className="text-[10px] text-muted">m/shift</p>
                  </div>
                </div>
                {/* Completion bar */}
                {p.holes > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[10px] text-muted mb-1">
                      <span>Hole completion</span>
                      <span>{p.holesCompleted}/{p.holes}</span>
                    </div>
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-coreconx-light rounded-full transition-all"
                        style={{ width: `${(p.holesCompleted / p.holes) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Shift Performance Timeline */}
        <div className="bg-card border border-border rounded-xl">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
              <TrendingUp size={16} className="text-info" />
              Shift Performance (Last 20)
            </h2>
          </div>
          <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
            {shiftTimeline.length === 0 && !loading && (
              <p className="text-sm text-muted text-center">No shift data found</p>
            )}
            {shiftTimeline.map((s) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className="w-24 shrink-0">
                  <p className="text-xs text-muted">
                    {new Date(s.start_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                  <p className="text-[10px] text-muted/60">{s.hours}h</p>
                </div>
                <div className="flex-1">
                  <div className="h-5 bg-border/30 rounded overflow-hidden">
                    <div
                      className="h-full bg-coreconx-light/60 rounded transition-all flex items-center px-2"
                      style={{ width: `${(s.meters / maxShiftMeters) * 100}%` }}
                    >
                      {s.meters > 0 && (
                        <span className="text-[10px] text-white font-medium whitespace-nowrap">
                          {s.meters}m
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {s.crew && <span className="text-[10px] text-muted shrink-0">{s.crew}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-coreconx-light" />
        </div>
      )}
    </div>
  );
}
