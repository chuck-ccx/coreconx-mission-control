"use client";

import { useEffect, useState } from "react";
import { Users, Search, ExternalLink, MapPin, Mail } from "lucide-react";
import { apiFetch } from "@/lib/api";

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
  [key: string]: string;
}

interface Contact {
  "Company Name": string;
  "Full Name": string;
  Email: string;
  [key: string]: string;
}

const statusColors: Record<string, string> = {
  Research: "bg-info/20 text-info",
  "Cold Outreach": "bg-warning/20 text-warning",
  Warm: "bg-coreconx/20 text-coreconx-light",
  Demo: "bg-accent-light/20 text-accent-light",
  Customer: "bg-success/20 text-success",
  Lost: "bg-danger/20 text-danger",
};

export default function CRMPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [compData, contData] = await Promise.all([
        apiFetch<Company[]>("/api/crm/companies"),
        apiFetch<Contact[]>("/api/crm/contacts"),
      ]);
      if (compData) setCompanies(compData);
      if (contData) setContacts(contData);
      setLoading(false);
    }
    load();
  }, []);

  // Match contacts to companies
  function getContact(companyName: string) {
    return contacts.find((c) => c["Company Name"] === companyName);
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
              : `${companies.length} drilling companies — live from Sheets`}
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
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-coreconx-light"
            />
          </div>
          <a
            href="https://docs.google.com/spreadsheets/d/1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-coreconx text-white rounded-lg text-sm hover:bg-coreconx-light transition-colors whitespace-nowrap"
          >
            <ExternalLink size={14} />
            <span className="hidden sm:inline">Open Sheet</span>
            <span className="sm:hidden">Sheet</span>
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

      {/* Company Table */}
      <div className="bg-card border border-border rounded-xl overflow-x-auto">
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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted text-sm">
                  Loading live data from Google Sheets...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-muted text-sm">
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

                return (
                  <tr
                    key={company["Company Name"]}
                    className={`border-b border-border/50 hover:bg-card-hover transition-colors ${
                      i % 2 === 0 ? "bg-card" : "bg-background/30"
                    }`}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {company["Company Name"]}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {company.Specialties || company.Notes || ""}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-sm text-foreground">
                      {contact?.["Full Name"] || "—"}
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
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Rules */}
      <div className="bg-card/50 border border-border/50 rounded-lg p-4">
        <p className="text-xs text-muted">
          <strong className="text-foreground">CRM Rules:</strong> No generic
          emails (info@, admin@, office@). Only named decision makers with
          direct emails. If we don&apos;t have the right contact, the row stays
          blank until nightly research finds one.
        </p>
      </div>
    </div>
  );
}
