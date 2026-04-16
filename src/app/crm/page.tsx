"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Users, Search, ExternalLink, MapPin, Mail, FileText, Plus, X, Pencil, LayoutGrid, Table2, DollarSign } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/use-realtime";
import { Modal } from "@/components/modal";

interface Company {
  "Company Name": string;
  Website: string;
  "Province/State": string;
  Country: string;
  City: string;
  "# of Rigs": string;
  Specialties: string;
  "Size (S/M/L)": string;
  "Lead Status": string;
  "Lead Score (1-10)": string;
  "Priority (H/M/L)": string;
  Notes: string;
  "Recent Intel": string;
  _supabase_id?: string;
  [key: string]: string | undefined;
}

interface Contact {
  "Company Name": string;
  "Full Name": string;
  Email: string;
  Phone?: string;
  Role?: string;
  _supabase_id?: string;
  [key: string]: string | undefined;
}

interface Document {
  name: string;
  status: "Not Sent" | "Sent" | "Signed";
  sentDate: string | null;
  signedDate: string | null;
}

const statusColors: Record<string, string> = {
  Research: "bg-info/20 text-info",
  "Cold Outreach": "bg-warning/20 text-warning",
  Warm: "bg-coreconx/20 text-coreconx-light",
  Demo: "bg-accent-light/20 text-accent-light",
  Customer: "bg-success/20 text-success",
  Lost: "bg-danger/20 text-danger",
};

const LEAD_STATUSES = ["Research", "Cold Outreach", "Warm", "Demo", "Customer", "Lost"];
const SIZES = ["S", "M", "L"];
const PRIORITIES = ["H", "M", "L"];

const emptyCompanyForm = {
  name: "", website: "", province_state: "", country: "", city: "",
  num_rigs: "", specialties: "", size: "", lead_status: "Research",
  lead_score: "0", priority: "", notes: "", recent_intel: "",
};

const emptyContactForm = {
  full_name: "", email: "", company_name: "", phone: "", role: "",
};

export default function CRMPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [dataSource, setDataSource] = useState<"supabase" | "sheets">("supabase");
  const [viewMode, setViewMode] = useState<"table" | "pipeline">("table");

  // Modal state
  const [companyModal, setCompanyModal] = useState<"add" | "edit" | null>(null);
  const [contactModal, setContactModal] = useState<"add" | "edit" | null>(null);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [contactForm, setContactForm] = useState(emptyContactForm);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    // Try Supabase first for companies, fall back to Sheets
    const { data: sbCompanies, error } = await supabase
      .from("companies")
      .select("*")
      .order("name");

    if (!error && sbCompanies && sbCompanies.length > 0) {
      const mapped: Company[] = sbCompanies.map((c: Record<string, unknown>) => ({
        "Company Name": (c.name as string) || "",
        Website: (c.website as string) || "",
        "Province/State": (c.province_state as string) || (c.state as string) || "",
        Country: (c.country as string) || "",
        City: (c.city as string) || "",
        "# of Rigs": String(c.num_rigs ?? c.rig_count ?? ""),
        Specialties: (c.specialties as string) || "",
        "Size (S/M/L)": (c.size as string) || "",
        "Lead Status": (c.lead_status as string) || "Research",
        "Lead Score (1-10)": String(c.lead_score ?? "0"),
        "Priority (H/M/L)": (c.priority as string) || "",
        Notes: (c.notes as string) || "",
        "Recent Intel": (c.recent_intel as string) || "",
        _supabase_id: String(c.id ?? ""),
      }));
      setCompanies(mapped);
      setDataSource("supabase");
    } else {
      const compData = await apiFetch<Company[]>("/api/crm/companies");
      if (compData) setCompanies(compData);
      setDataSource("sheets");
    }

    // Contacts: try Supabase profiles first, fall back to Sheets
    const { data: sbContacts, error: contactsError } = await supabase
      .from("profiles")
      .select("*")
      .order("full_name");

    if (!contactsError && sbContacts && sbContacts.length > 0) {
      const mapped: Contact[] = sbContacts.map((c: Record<string, unknown>) => ({
        "Company Name": (c.company_name as string) || "",
        "Full Name": (c.full_name as string) || "",
        Email: (c.email as string) || "",
        Phone: (c.phone as string) || "",
        Role: (c.role as string) || "",
        _supabase_id: String(c.id ?? ""),
      }));
      setContacts(mapped);
    } else {
      const contData = await apiFetch<Contact[]>("/api/crm/contacts");
      if (contData) setContacts(contData);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    void loadData();
  }, [loadData]);

  // Real-time sync: reload when companies or contacts change in Supabase
  useRealtime("companies", loadData);
  useRealtime("contacts", loadData);

  function getContact(companyName: string) {
    return contacts.find((c) => c["Company Name"] === companyName);
  }

  async function loadDocuments(companyName: string) {
    setDocsLoading(true);
    const docs = await apiFetch<Document[]>(`/api/crm/documents/${encodeURIComponent(companyName)}`);
    if (docs) setDocuments(docs);
    setDocsLoading(false);
  }

  async function cycleStatus(idx: number) {
    if (!selectedCompany) return;
    const doc = documents[idx];
    const next = doc.status === "Not Sent" ? "Sent" : doc.status === "Sent" ? "Signed" : "Not Sent";
    const now = new Date().toISOString().split("T")[0];
    const body: Record<string, string | null> = { status: next };
    if (next === "Sent") body.sentDate = now;
    if (next === "Signed") body.signedDate = now;
    if (next === "Not Sent") { body.sentDate = null; body.signedDate = null; }
    const updated = await apiFetch<Document[]>(
      `/api/crm/documents/${encodeURIComponent(selectedCompany)}/${idx}`,
      { method: "PATCH", body: JSON.stringify(body) }
    );
    if (updated) setDocuments(updated);
  }

  async function addDocument() {
    if (!selectedCompany || !newDocName.trim()) return;
    const updated = await apiFetch<Document[]>(
      `/api/crm/documents/${encodeURIComponent(selectedCompany)}`,
      { method: "POST", body: JSON.stringify({ name: newDocName.trim() }) }
    );
    if (updated) setDocuments(updated);
    setNewDocName("");
  }

  function selectCompany(name: string) {
    setSelectedCompany(name);
    loadDocuments(name);
  }

  // Company CRUD
  function openAddCompany() {
    setCompanyForm(emptyCompanyForm);
    setEditingCompanyId(null);
    setCompanyModal("add");
  }

  function openEditCompany(company: Company) {
    setCompanyForm({
      name: company["Company Name"],
      website: company.Website,
      province_state: company["Province/State"],
      country: company.Country,
      city: company.City,
      num_rigs: company["# of Rigs"],
      specialties: company.Specialties,
      size: company["Size (S/M/L)"],
      lead_status: company["Lead Status"],
      lead_score: company["Lead Score (1-10)"],
      priority: company["Priority (H/M/L)"],
      notes: company.Notes,
      recent_intel: company["Recent Intel"],
    });
    setEditingCompanyId(company._supabase_id || null);
    setCompanyModal("edit");
  }

  async function saveCompany() {
    setSaving(true);
    const payload = {
      ...companyForm,
      num_rigs: companyForm.num_rigs ? parseInt(companyForm.num_rigs) || null : null,
      lead_score: parseInt(companyForm.lead_score) || 0,
    };

    if (companyModal === "edit" && editingCompanyId) {
      await apiFetch(`/api/crm/supabase/companies/${editingCompanyId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      await apiFetch("/api/crm/supabase/companies", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    setCompanyModal(null);
    await loadData();
  }

  // Contact CRUD
  function openAddContact(companyName?: string) {
    setContactForm({ ...emptyContactForm, company_name: companyName || "" });
    setEditingContactId(null);
    setContactModal("add");
  }

  function openEditContact(contact: Contact) {
    setContactForm({
      full_name: contact["Full Name"],
      email: contact.Email,
      company_name: contact["Company Name"],
      phone: contact.Phone || "",
      role: contact.Role || "",
    });
    setEditingContactId(contact._supabase_id || null);
    setContactModal("edit");
  }

  async function saveContact() {
    setSaving(true);

    if (contactModal === "edit" && editingContactId) {
      await apiFetch(`/api/crm/supabase/contacts/${editingContactId}`, {
        method: "PATCH",
        body: JSON.stringify(contactForm),
      });
    } else {
      await apiFetch("/api/crm/supabase/contacts", {
        method: "POST",
        body: JSON.stringify(contactForm),
      });
    }

    setSaving(false);
    setContactModal(null);
    await loadData();
  }

  const filtered = companies.filter((c) =>
    (c["Company Name"] || "").toLowerCase().includes(search.toLowerCase())
  );

  const withEmail = companies.filter((c) => {
    const contact = getContact(c["Company Name"]);
    return contact?.Email;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <Users size={24} className="text-coreconx-light" />
            CRM
          </h1>
          <p className="text-muted text-xs sm:text-sm mt-1">
            {loading
              ? "Loading live data..."
              : `${companies.length} drilling companies — live from ${dataSource === "supabase" ? "Supabase" : "Sheets"}`}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-coreconx-light"
            />
          </div>
          <button
            onClick={openAddCompany}
            className="flex items-center gap-1.5 px-3 py-2 bg-coreconx text-white rounded-lg text-sm hover:bg-coreconx-light transition-colors whitespace-nowrap"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Company</span>
          </button>
          <button
            onClick={() => openAddContact()}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent-light/20 text-accent-light rounded-lg text-sm hover:bg-accent-light/30 transition-colors whitespace-nowrap"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Contact</span>
          </button>
          <a
            href="https://docs.google.com/spreadsheets/d/1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-coreconx text-white rounded-lg text-sm hover:bg-coreconx-light transition-colors whitespace-nowrap"
          >
            <ExternalLink size={14} />
            <span className="hidden sm:inline">Sheet</span>
          </a>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Total Companies", value: companies.length },
          { label: "With Direct Email", value: withEmail.length },
          {
            label: "Contacted",
            value: companies.filter(
              (c) => c["Lead Status"] === "Cold Outreach" || c["Lead Status"] === "Warm"
            ).length,
          },
          {
            label: "Avg Lead Score",
            value: companies.length
              ? (
                  companies.reduce(
                    (a, c) => a + (parseInt(c["Lead Score (1-10)"] || "0") || 0),
                    0
                  ) / companies.length
                ).toFixed(1)
              : "—",
          },
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

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setViewMode("table")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            viewMode === "table" ? "bg-coreconx/20 text-coreconx-light" : "text-muted hover:text-foreground"
          }`}
        >
          <Table2 size={14} /> Table
        </button>
        <button
          onClick={() => setViewMode("pipeline")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            viewMode === "pipeline" ? "bg-coreconx/20 text-coreconx-light" : "text-muted hover:text-foreground"
          }`}
        >
          <LayoutGrid size={14} /> Pipeline
        </button>
      </div>

      {/* Pipeline View */}
      {viewMode === "pipeline" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
          {LEAD_STATUSES.map((status) => {
            const stageCompanies = filtered.filter((c) => c["Lead Status"] === status);
            const stageValue = stageCompanies.reduce((sum, c) => {
              const rigs = parseInt(c["# of Rigs"] || "0") || 0;
              return sum + rigs * 150; // $150/rig/month estimate
            }, 0);
            return (
              <div key={status} className="bg-card border border-border rounded-xl p-3 min-w-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || "bg-background text-muted"}`}>
                      {status}
                    </span>
                    <p className="text-xs text-muted mt-1">{stageCompanies.length} companies</p>
                  </div>
                  {stageValue > 0 && (
                    <span className="text-xs text-success flex items-center gap-0.5">
                      <DollarSign size={10} />
                      {(stageValue / 1000).toFixed(1)}k/mo
                    </span>
                  )}
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {stageCompanies.map((company) => {
                    const contact = getContact(company["Company Name"]);
                    const score = parseInt(company["Lead Score (1-10)"] || "0") || 0;
                    return (
                      <button
                        key={company["Company Name"]}
                        onClick={() => selectCompany(company["Company Name"])}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                          selectedCompany === company["Company Name"]
                            ? "border-coreconx bg-coreconx/10"
                            : "border-border hover:border-coreconx/50 bg-background"
                        }`}
                      >
                        <p className="text-sm font-medium text-foreground truncate">{company["Company Name"]}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {company["Province/State"] && (
                            <span className="text-[10px] text-muted flex items-center gap-0.5">
                              <MapPin size={8} /> {company["Province/State"]}
                            </span>
                          )}
                          {score > 0 && (
                            <span className={`text-[10px] font-medium ${score >= 7 ? "text-success" : score >= 4 ? "text-warning" : "text-muted"}`}>
                              Score: {score}
                            </span>
                          )}
                        </div>
                        {contact?.["Full Name"] && (
                          <p className="text-[10px] text-muted mt-1 truncate">{contact["Full Name"]}</p>
                        )}
                        {company["# of Rigs"] && (
                          <p className="text-[10px] text-muted">{company["# of Rigs"]} rigs</p>
                        )}
                      </button>
                    );
                  })}
                  {stageCompanies.length === 0 && (
                    <p className="text-xs text-muted text-center py-4">No companies</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Company Table */}
      {viewMode === "table" && <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-border bg-coreconx-dark/30">
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Company
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Contact
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Email
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Location
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Status
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3">
                Score
              </th>
              <th className="text-left text-xs font-medium text-muted px-5 py-3 w-10">
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-muted text-sm">
                  Loading live data...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-muted text-sm">
                  No companies found
                </td>
              </tr>
            ) : (
              filtered.map((company, i) => {
                const contact = getContact(company["Company Name"]);
                const score = parseInt(company["Lead Score (1-10)"] || "0") || 0;
                const status = company["Lead Status"] || "Research";
                const location = [company.City, company["Province/State"]]
                  .filter(Boolean)
                  .join(", ");
                const isSelected = selectedCompany === company["Company Name"];

                return (
                  <React.Fragment key={company["Company Name"]}>
                    <tr
                      onClick={() => isSelected ? setSelectedCompany(null) : selectCompany(company["Company Name"])}
                      className={`border-b border-border/50 hover:bg-card-hover transition-colors cursor-pointer ${
                        i % 2 === 0 ? "bg-card" : "bg-background/30"
                      } ${isSelected ? "bg-coreconx-dark/20 border-coreconx-light/30" : ""}`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className={isSelected ? "text-coreconx-light" : "text-transparent"} />
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {company["Company Name"]}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {company.Specialties || company.Notes || ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-foreground">
                        {contact ? (
                          <span
                            onClick={(e) => { e.stopPropagation(); openEditContact(contact); }}
                            className="hover:text-coreconx-light cursor-pointer"
                          >
                            {contact["Full Name"]}
                          </span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); openAddContact(company["Company Name"]); }}
                            className="text-xs text-muted hover:text-coreconx-light"
                          >
                            + Add contact
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {contact?.Email ? (
                          <div className="flex items-center gap-1.5">
                            <Mail size={12} className="text-muted" />
                            <span className="text-sm text-foreground font-mono">
                              {contact.Email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted">No direct email</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <MapPin size={12} className="text-muted" />
                          <span className="text-sm text-muted">
                            {location || company.Country || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                            statusColors[status] || "bg-border text-muted"
                          }`}
                        >
                          {status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-coreconx-light rounded-full"
                              style={{ width: `${score * 10}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono text-muted">
                            {score || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {company._supabase_id && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditCompany(company); }}
                            className="p-1.5 rounded-lg text-muted hover:text-coreconx-light hover:bg-card-hover transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isSelected && (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <div className="bg-coreconx-dark/10 border-t border-b border-coreconx-light/20 px-6 py-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <FileText size={14} className="text-coreconx-light" />
                                Documents — {selectedCompany}
                              </h3>
                              <button onClick={(e) => { e.stopPropagation(); setSelectedCompany(null); }} className="text-muted hover:text-foreground">
                                <X size={16} />
                              </button>
                            </div>
                            {docsLoading ? (
                              <p className="text-xs text-muted">Loading documents...</p>
                            ) : (
                              <div className="space-y-2">
                                {documents.map((doc, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-background/50 border border-border/50 rounded-lg px-4 py-2.5">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-foreground">{doc.name}</p>
                                      <div className="flex gap-3 mt-0.5">
                                        {doc.sentDate && <span className="text-xs text-muted">Sent: {doc.sentDate}</span>}
                                        {doc.signedDate && <span className="text-xs text-muted">Signed: {doc.signedDate}</span>}
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); cycleStatus(idx); }}
                                      className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                                        doc.status === "Signed"
                                          ? "bg-success/20 text-success hover:bg-success/30"
                                          : doc.status === "Sent"
                                          ? "bg-warning/20 text-warning hover:bg-warning/30"
                                          : "bg-danger/20 text-danger hover:bg-danger/30"
                                      }`}
                                    >
                                      {doc.status}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Add custom document..."
                                value={newDocName}
                                onChange={(e) => setNewDocName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") addDocument(); }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-coreconx-light"
                              />
                              <button
                                onClick={(e) => { e.stopPropagation(); addDocument(); }}
                                disabled={!newDocName.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-coreconx text-white rounded-lg text-sm hover:bg-coreconx-light transition-colors disabled:opacity-40"
                              >
                                <Plus size={14} />
                                Add
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>}

      {/* Rules */}
      <div className="bg-card/50 border border-border/50 rounded-lg p-4">
        <p className="text-xs text-muted">
          <strong className="text-foreground">CRM Rules:</strong> No generic
          emails (info@, admin@, office@). Only named decision makers with
          direct emails. If we don&apos;t have the right contact, the row stays
          blank until nightly research finds one.
        </p>
      </div>

      {/* Add/Edit Company Modal */}
      <Modal
        open={companyModal !== null}
        onClose={() => setCompanyModal(null)}
        title={companyModal === "edit" ? "Edit Company" : "Add Company"}
        subtitle={companyModal === "edit" ? `Editing ${companyForm.name}` : "Add a new drilling company to the CRM"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Company Name *</label>
              <input
                type="text"
                value={companyForm.name}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Website</label>
              <input
                type="text"
                value={companyForm.website}
                onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">City</label>
              <input
                type="text"
                value={companyForm.city}
                onChange={(e) => setCompanyForm({ ...companyForm, city: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Province/State</label>
              <input
                type="text"
                value={companyForm.province_state}
                onChange={(e) => setCompanyForm({ ...companyForm, province_state: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Country</label>
              <input
                type="text"
                value={companyForm.country}
                onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1"># of Rigs</label>
              <input
                type="text"
                value={companyForm.num_rigs}
                onChange={(e) => setCompanyForm({ ...companyForm, num_rigs: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Specialties</label>
              <input
                type="text"
                value={companyForm.specialties}
                onChange={(e) => setCompanyForm({ ...companyForm, specialties: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Size</label>
              <select
                value={companyForm.size}
                onChange={(e) => setCompanyForm({ ...companyForm, size: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              >
                <option value="">—</option>
                {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Lead Status</label>
              <select
                value={companyForm.lead_status}
                onChange={(e) => setCompanyForm({ ...companyForm, lead_status: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              >
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Lead Score (1-10)</label>
              <input
                type="number"
                min="0"
                max="10"
                value={companyForm.lead_score}
                onChange={(e) => setCompanyForm({ ...companyForm, lead_score: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Priority</label>
              <select
                value={companyForm.priority}
                onChange={(e) => setCompanyForm({ ...companyForm, priority: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              >
                <option value="">—</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Notes</label>
            <textarea
              value={companyForm.notes}
              onChange={(e) => setCompanyForm({ ...companyForm, notes: e.target.value })}
              rows={2}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Recent Intel</label>
            <textarea
              value={companyForm.recent_intel}
              onChange={(e) => setCompanyForm({ ...companyForm, recent_intel: e.target.value })}
              rows={2}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setCompanyModal(null)}
              className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveCompany}
              disabled={!companyForm.name.trim() || saving}
              className="px-4 py-2 bg-coreconx text-white rounded-lg text-sm hover:bg-coreconx-light transition-colors disabled:opacity-40"
            >
              {saving ? "Saving..." : companyModal === "edit" ? "Update Company" : "Add Company"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Add/Edit Contact Modal */}
      <Modal
        open={contactModal !== null}
        onClose={() => setContactModal(null)}
        title={contactModal === "edit" ? "Edit Contact" : "Add Contact"}
        subtitle={contactModal === "edit" ? `Editing ${contactForm.full_name}` : "Add a new contact"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Full Name *</label>
              <input
                type="text"
                value={contactForm.full_name}
                onChange={(e) => setContactForm({ ...contactForm, full_name: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Email</label>
              <input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Company</label>
              <input
                type="text"
                value={contactForm.company_name}
                onChange={(e) => setContactForm({ ...contactForm, company_name: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Phone</label>
              <input
                type="text"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-muted mb-1">Role / Title</label>
              <input
                type="text"
                value={contactForm.role}
                onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-coreconx-light"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setContactModal(null)}
              className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveContact}
              disabled={!contactForm.full_name.trim() || saving}
              className="px-4 py-2 bg-coreconx text-white rounded-lg text-sm hover:bg-coreconx-light transition-colors disabled:opacity-40"
            >
              {saving ? "Saving..." : contactModal === "edit" ? "Update Contact" : "Add Contact"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
