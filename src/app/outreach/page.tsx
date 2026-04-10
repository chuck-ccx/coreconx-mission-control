"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Send,
  Plus,
  X,
  Search,
  Trash2,
  ChevronDown,
  StickyNote,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface OutreachContact {
  id: number;
  name: string;
  company: string;
  email: string;
  status: string;
  lastContactDate: string | null;
  nextFollowUp: string | null;
  notes: string;
  createdAt: string;
}

const STATUSES = [
  "Not Contacted",
  "Emailed",
  "Followed Up",
  "Responded",
  "Converted",
] as const;

const statusColors: Record<string, string> = {
  "Not Contacted": "bg-border text-muted",
  Emailed: "bg-info/20 text-info",
  "Followed Up": "bg-warning/20 text-warning",
  Responded: "bg-coreconx/20 text-coreconx-light",
  Converted: "bg-success/20 text-success",
};

export default function OutreachPage() {
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [showAdd, setShowAdd] = useState(false);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [statusDropdown, setStatusDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // New contact form
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newFollowUp, setNewFollowUp] = useState("");

  async function loadContacts() {
    const data = await apiFetch<OutreachContact[]>("/api/outreach");
    if (data) setContacts(data);
    setLoading(false);
  }

  useEffect(() => {
    loadContacts(); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setStatusDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function addContact() {
    if (!newName.trim() || !newCompany.trim()) return;
    const contact = await apiFetch<OutreachContact>("/api/outreach", {
      method: "POST",
      body: JSON.stringify({
        name: newName.trim(),
        company: newCompany.trim(),
        email: newEmail.trim(),
        notes: newNotes.trim(),
        nextFollowUp: newFollowUp || null,
      }),
    });
    if (contact) {
      setContacts((prev) => [...prev, contact]);
      setNewName("");
      setNewCompany("");
      setNewEmail("");
      setNewNotes("");
      setNewFollowUp("");
      setShowAdd(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    const updated = await apiFetch<OutreachContact>(`/api/outreach/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (updated) {
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    }
    setStatusDropdown(null);
  }

  async function updateNotes(id: number) {
    const updated = await apiFetch<OutreachContact>(`/api/outreach/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ notes: notesValue }),
    });
    if (updated) {
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    }
    setEditingNotes(null);
  }

  async function updateFollowUp(id: number, date: string) {
    const updated = await apiFetch<OutreachContact>(`/api/outreach/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ nextFollowUp: date || null }),
    });
    if (updated) {
      setContacts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    }
  }

  async function deleteContact(id: number) {
    const result = await apiFetch<{ deleted: boolean }>(
      `/api/outreach/${id}`,
      { method: "DELETE" }
    );
    if (result) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
    }
  }

  // Filtered contacts
  const filtered = contacts.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      filterStatus === "All" || c.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const total = contacts.length;
  const emailed = contacts.filter((c) =>
    ["Emailed", "Followed Up", "Responded", "Converted"].includes(c.status)
  ).length;
  const responded = contacts.filter((c) =>
    ["Responded", "Converted"].includes(c.status)
  ).length;
  const converted = contacts.filter((c) => c.status === "Converted").length;
  const conversionRate =
    total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Send size={24} className="text-coreconx-light" />
            Outreach Tracker
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-1">
            {loading
              ? "Loading..."
              : `${contacts.length} contacts — marketplace outreach`}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-coreconx-light"
            />
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-coreconx text-white rounded-lg text-sm hover:bg-coreconx-light transition-colors whitespace-nowrap"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Add Contact</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Contacts", value: total },
          { label: "Emailed", value: emailed },
          { label: "Responded", value: responded },
          { label: "Conversion Rate", value: `${conversionRate}%` },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-lg p-4 text-center"
          >
            <p className="text-2xl font-semibold text-foreground">
              {loading ? "..." : stat.value}
            </p>
            <p className="text-xs text-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {["All", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              filterStatus === s
                ? "bg-coreconx text-white"
                : "bg-card border border-border text-muted hover:text-foreground"
            }`}
          >
            {s}
            {s !== "All" && (
              <span className="ml-1 opacity-60">
                {contacts.filter((c) => c.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Add Contact Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Add Outreach Contact
              </h2>
              <button
                onClick={() => setShowAdd(false)}
                className="text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Contact Name *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-coreconx-light"
              />
              <input
                type="text"
                placeholder="Company *"
                value={newCompany}
                onChange={(e) => setNewCompany(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-coreconx-light"
              />
              <input
                type="email"
                placeholder="Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-coreconx-light"
              />
              <div>
                <label className="text-xs text-muted block mb-1">
                  Next Follow-up
                </label>
                <input
                  type="date"
                  value={newFollowUp}
                  onChange={(e) => setNewFollowUp(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
                />
              </div>
              <textarea
                placeholder="Notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-coreconx-light resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addContact}
                disabled={!newName.trim() || !newCompany.trim()}
                className="px-4 py-2 bg-coreconx text-white rounded-lg text-sm hover:bg-coreconx-light transition-colors disabled:opacity-40"
              >
                Add Contact
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contacts Table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border bg-coreconx-dark/30">
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Name
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Company
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Email
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Status
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Last Contact
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Next Follow-up
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Notes
              </th>
              <th className="text-left text-xs font-medium text-muted px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-8 text-center text-muted text-sm"
                >
                  Loading outreach contacts...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-8 text-center text-muted text-sm"
                >
                  {contacts.length === 0
                    ? 'No contacts yet. Click "Add Contact" to get started.'
                    : "No contacts match your filters."}
                </td>
              </tr>
            ) : (
              filtered.map((contact, i) => {
                const isOverdue =
                  contact.nextFollowUp &&
                  new Date(contact.nextFollowUp) < new Date() &&
                  !["Responded", "Converted"].includes(contact.status);

                return (
                  <tr
                    key={contact.id}
                    className={`border-b border-border/50 hover:bg-card-hover transition-colors ${
                      i % 2 === 0 ? "bg-card" : "bg-background/30"
                    } ${isOverdue ? "border-l-2 border-l-warning" : ""}`}
                  >
                    <td className="px-5 py-4 text-sm font-medium text-foreground">
                      {contact.name}
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground">
                      {contact.company}
                    </td>
                    <td className="px-5 py-4">
                      {contact.email ? (
                        <span className="text-sm text-foreground font-mono">
                          {contact.email}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">--</span>
                      )}
                    </td>
                    <td className="px-5 py-4 relative">
                      <button
                        onClick={() =>
                          setStatusDropdown(
                            statusDropdown === contact.id ? null : contact.id
                          )
                        }
                        className={`text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1 transition-colors ${
                          statusColors[contact.status] || "bg-border text-muted"
                        }`}
                      >
                        {contact.status}
                        <ChevronDown size={12} />
                      </button>
                      {statusDropdown === contact.id && (
                        <div
                          ref={dropdownRef}
                          className="absolute z-20 mt-1 left-5 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
                        >
                          {STATUSES.map((s) => (
                            <button
                              key={s}
                              onClick={() => updateStatus(contact.id, s)}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-card-hover transition-colors flex items-center gap-2 ${
                                contact.status === s
                                  ? "text-coreconx-light font-medium"
                                  : "text-foreground"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  statusColors[s]?.split(" ")[0] || "bg-border"
                                }`}
                              />
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-muted">
                      {contact.lastContactDate || "--"}
                    </td>
                    <td className="px-5 py-4">
                      <input
                        type="date"
                        value={contact.nextFollowUp || ""}
                        onChange={(e) =>
                          updateFollowUp(contact.id, e.target.value)
                        }
                        className={`bg-transparent border-none text-sm focus:outline-none focus:ring-1 focus:ring-coreconx-light rounded px-1 py-0.5 ${
                          isOverdue
                            ? "text-warning font-medium"
                            : "text-muted"
                        }`}
                      />
                    </td>
                    <td className="px-5 py-4">
                      {editingNotes === contact.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={notesValue}
                            onChange={(e) => setNotesValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") updateNotes(contact.id);
                              if (e.key === "Escape") setEditingNotes(null);
                            }}
                            autoFocus
                            className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground w-full focus:outline-none focus:border-coreconx-light"
                          />
                          <button
                            onClick={() => updateNotes(contact.id)}
                            className="text-coreconx-light hover:text-coreconx text-xs px-1"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingNotes(contact.id);
                            setNotesValue(contact.notes);
                          }}
                          className="text-xs text-muted hover:text-foreground transition-colors flex items-center gap-1 max-w-[200px] truncate"
                          title={contact.notes || "Click to add notes"}
                        >
                          <StickyNote size={12} className="shrink-0" />
                          {contact.notes || "Add notes..."}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <button
                        onClick={() => deleteContact(contact.id)}
                        className="text-muted hover:text-danger transition-colors"
                        title="Delete contact"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div className="bg-card/50 border border-border/50 rounded-lg p-4">
        <p className="text-xs text-muted">
          <strong className="text-foreground">Outreach Rules:</strong> Track
          all drill contractor outreach here. Update status after each
          touchpoint. Follow up within 3 business days of initial email.
          Overdue follow-ups are highlighted in yellow.
        </p>
      </div>
    </div>
  );
}
