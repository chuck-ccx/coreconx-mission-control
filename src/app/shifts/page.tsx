"use client";

import { useState, useEffect, useCallback } from "react";
import {
  HardHat,
  Send,
  ChevronRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Drill,
  Users,
  Ruler,
  FileText,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface Shift {
  id: string;
  name?: string;
  site_name?: string;
  date?: string;
  shift_type?: string;
  meters?: number;
  meters_drilled?: number;
  holes?: number;
  holes_completed?: number;
  crew?: string | string[];
  crew_names?: string;
  crew_count?: number;
  consumables?: string | string[];
  notes?: string;
  drill_owner_email?: string;
  owner_email?: string;
  status?: string;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Shift | null>(null);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchShifts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("shifts")
        .select("*")
        .order("date", { ascending: false })
        .limit(50);
      if (!error && data) setShifts(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchShifts(); }, [fetchShifts]);

  const sendSummary = async (shiftId: string) => {
    setSending(true);
    setSendResult(null);
    try {
      const res = await apiFetch<{ sent?: boolean; error?: string; to?: string }>(
        `/api/shifts/${shiftId}/summary-email`,
        { method: "POST" },
      );
      if (res?.sent) {
        setSendResult({ ok: true, msg: `Summary sent to ${res.to}` });
      } else {
        setSendResult({ ok: false, msg: res?.error || "Failed to send summary" });
      }
    } catch {
      setSendResult({ ok: false, msg: "Failed to reach server" });
    } finally {
      setSending(false);
    }
  };

  const formatCrew = (shift: Shift) => {
    if (Array.isArray(shift.crew)) return shift.crew.join(", ");
    return shift.crew || shift.crew_names || `${shift.crew_count || 0} members`;
  };

  const formatConsumables = (shift: Shift) => {
    if (Array.isArray(shift.consumables)) return shift.consumables.join(", ");
    return shift.consumables || "None recorded";
  };

  // Detail view
  if (selected) {
    const meters = selected.meters ?? selected.meters_drilled ?? "N/A";
    const holes = selected.holes ?? selected.holes_completed ?? "N/A";
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <button
          onClick={() => { setSelected(null); setSendResult(null); }}
          className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Back to shifts
        </button>

        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <HardHat size={28} className="text-coreconx-light" />
            {selected.name || selected.site_name || "Shift Detail"}
          </h1>
          <p className="text-muted text-sm mt-1">
            {selected.date || "No date"} &mdash; {selected.shift_type || selected.name || "Standard"}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Ruler, label: "Meters Drilled", value: meters },
            { icon: Drill, label: "Holes Worked", value: holes },
            { icon: Users, label: "Crew", value: formatCrew(selected) },
            { icon: FileText, label: "Consumables", value: formatConsumables(selected) },
          ].map((s) => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 text-muted mb-2">
                <s.icon size={14} />
                <span className="text-xs">{s.label}</span>
              </div>
              <p className="text-foreground font-semibold text-sm truncate">{String(s.value)}</p>
            </div>
          ))}
        </div>

        {/* Notes */}
        {selected.notes && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-sm font-medium text-foreground mb-2">Key Notes</h3>
            <p className="text-sm text-muted leading-relaxed">{selected.notes}</p>
          </div>
        )}

        {/* Send summary */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">Email Shift Summary</h3>
              <p className="text-xs text-muted mt-0.5">
                Send an HTML summary to the drill owner ({selected.drill_owner_email || selected.owner_email || "no email set"})
              </p>
            </div>
            <button
              onClick={() => sendSummary(selected.id)}
              disabled={sending || !(selected.drill_owner_email || selected.owner_email)}
              className="flex items-center gap-2 px-4 py-2.5 bg-coreconx text-white rounded-lg text-sm font-medium hover:bg-coreconx-light transition-colors disabled:opacity-50"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? "Sending..." : "Send Summary"}
            </button>
          </div>
          {sendResult && (
            <p className={`text-xs mt-3 ${sendResult.ok ? "text-success" : "text-danger"}`}>
              {sendResult.ok && <CheckCircle2 size={12} className="inline mr-1" />}
              {sendResult.msg}
            </p>
          )}
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <HardHat size={28} className="text-coreconx-light" />
          Shifts
        </h1>
        <p className="text-muted text-sm mt-1">View shift records and send summaries</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted text-sm">Loading shifts...</div>
        ) : shifts.length === 0 ? (
          <div className="p-8 text-center text-muted text-sm">
            No shifts found. Shift data will appear here once drilling operations are recorded.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wider">
                <th className="px-4 py-3">Shift / Site</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Meters</th>
                <th className="px-4 py-3">Holes</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className="border-b border-border last:border-0 hover:bg-background/50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <p className="text-foreground font-medium">{s.name || s.site_name || "Unnamed"}</p>
                    {s.shift_type && <p className="text-xs text-muted">{s.shift_type}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted">{s.date || "—"}</td>
                  <td className="px-4 py-3 text-foreground font-medium">
                    {s.meters ?? s.meters_drilled ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {s.holes ?? s.holes_completed ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      s.status === "completed" ? "bg-success/20 text-success" :
                      s.status === "active" ? "bg-info/20 text-info" :
                      "bg-muted/20 text-muted"
                    }`}>
                      {s.status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <ChevronRight size={16} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
