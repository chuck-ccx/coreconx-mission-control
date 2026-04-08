"use client";

import { useState } from "react";
import { FileText, ExternalLink, Search, Shield, Scale, BookOpen } from "lucide-react";
import { Modal } from "@/components/modal";

interface LegalDoc {
  id: string;
  title: string;
  phase: string;
  category: string;
  url: string;
  summary: string;
  status: "Live" | "Draft" | "Not Published";
  lastUpdated: string;
}

const legalDocs: LegalDoc[] = [
  // Phase 1
  {
    id: "tos",
    title: "Terms of Service",
    phase: "Phase 1",
    category: "MVP Launch",
    url: "https://docs.google.com/document/d/1k8123ZrJiTJhrrnYHtltx5ZJmbrDPz-NEtJHyVKtu2A/edit",
    summary: "Governs user access to CoreConX platform. Covers account creation, acceptable use, intellectual property, limitation of liability, termination. BC/Canada jurisdiction, PIPEDA compliant. Entity: CoreConX (not incorporated). Free during early access, $150/mo per user after.",
    status: "Live",
    lastUpdated: "Apr 8",
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    phase: "Phase 1",
    category: "MVP Launch",
    url: "https://docs.google.com/document/d/1e4Y9yMl8QTsX1W8k3cQ6qcUWuNkVBYNeAoUc8hDskSM/edit",
    summary: "Details how CoreConX collects, uses, stores, and protects personal information. PIPEDA compliant. Privacy Officer: Dylan Fader. 30-day data retention after termination. Covers drilling performance data, shift records, project information.",
    status: "Live",
    lastUpdated: "Apr 8",
  },
  {
    id: "aup",
    title: "Acceptable Use Policy",
    phase: "Phase 1",
    category: "MVP Launch",
    url: "https://docs.google.com/document/d/10aUm-xY3tmYVE6nr002sEWTiTjoj25AKvZAN2HLsI00/edit",
    summary: "Defines prohibited activities on the platform — no unauthorized access, no data scraping, no abuse of drilling data. Enforcement procedures and account suspension policies.",
    status: "Live",
    lastUpdated: "Apr 8",
  },
  {
    id: "cookie",
    title: "Cookie Policy",
    phase: "Phase 1",
    category: "MVP Launch",
    url: "https://docs.google.com/document/d/1jUpikcRCTqdLIiamXr7xrBnxDfyIWyfVbXdzvjKBpZY/edit",
    summary: "Explains use of cookies and tracking technologies. Essential cookies, analytics, preferences. How to manage/disable cookies. Compliant with Canadian privacy requirements.",
    status: "Live",
    lastUpdated: "Apr 8",
  },
  {
    id: "getting-started",
    title: "Getting Started Guide",
    phase: "Phase 1",
    category: "MVP Launch",
    url: "https://docs.google.com/document/d/1ehRkppftE-L53QiVqNTeBL9pXZP2gHqlcFKK73vFSdc/edit",
    summary: "Onboarding guide for new users. Account setup, first drill log, shift tracking, project creation. App coming soon to App Store/Google Play.",
    status: "Live",
    lastUpdated: "Apr 8",
  },
  // Phase 2
  {
    id: "subscription",
    title: "Subscription Agreement",
    phase: "Phase 2",
    category: "Paid Plans & Data",
    url: "#",
    summary: "Covers subscription plans, billing cycles, payment terms. Free during early access, then $150/mo per user. 30-day data retention after termination. No payment processing system yet.",
    status: "Draft",
    lastUpdated: "Apr 8",
  },
  {
    id: "dpa",
    title: "Data Processing Agreement",
    phase: "Phase 2",
    category: "Paid Plans & Data",
    url: "#",
    summary: "Governs how CoreConX processes customer drilling data. Data security measures, breach notification procedures, sub-processor management. SOC 2 claims removed — honest about current security posture.",
    status: "Draft",
    lastUpdated: "Apr 8",
  },
  {
    id: "sla",
    title: "Service Level Agreement",
    phase: "Phase 2",
    category: "Paid Plans & Data",
    url: "#",
    summary: "Uptime commitments and support response times. Chuck (AI) provides 24/7 support. No enterprise response time promises. Status page planned but not live yet.",
    status: "Draft",
    lastUpdated: "Apr 8",
  },
  {
    id: "refund",
    title: "Refund & Cancellation Policy",
    phase: "Phase 2",
    category: "Paid Plans & Data",
    url: "#",
    summary: "How to cancel subscriptions and request refunds. 30-day data retention after termination (consistent across all docs). Pro-rated refunds for annual plans.",
    status: "Draft",
    lastUpdated: "Apr 8",
  },
  {
    id: "eula",
    title: "End User License Agreement",
    phase: "Phase 2",
    category: "Paid Plans & Data",
    url: "#",
    summary: "License terms for the CoreConX mobile app. Usage rights, restrictions, intellectual property. Standard EULA for mobile applications distributed through app stores.",
    status: "Draft",
    lastUpdated: "Apr 8",
  },
  // Phase 3
  {
    id: "marketplace-terms",
    title: "Marketplace Terms",
    phase: "Phase 3",
    category: "Marketplace",
    url: "#",
    summary: "Terms for the contractor-mine matching marketplace. How listings work, matching process, payment flow through platform. NOT FOR PUBLICATION — Phase 3 not built yet.",
    status: "Not Published",
    lastUpdated: "Apr 8",
  },
  {
    id: "contractor",
    title: "Independent Contractor Agreement",
    phase: "Phase 3",
    category: "Marketplace",
    url: "#",
    summary: "Template agreement for drill contractors listing on the marketplace. Responsibilities, insurance requirements, performance standards. NOT FOR PUBLICATION.",
    status: "Not Published",
    lastUpdated: "Apr 8",
  },
  {
    id: "commission",
    title: "Commission & Fee Schedule",
    phase: "Phase 3",
    category: "Marketplace",
    url: "#",
    summary: "Platform fees and commission structure. $1/meter model for marketplace transactions. NOT FOR PUBLICATION — pricing model still being finalized.",
    status: "Not Published",
    lastUpdated: "Apr 8",
  },
  {
    id: "dispute",
    title: "Dispute Resolution Policy",
    phase: "Phase 3",
    category: "Marketplace",
    url: "#",
    summary: "How disputes between mines and contractors are handled. Mediation process, escalation procedures, resolution timelines. NOT FOR PUBLICATION.",
    status: "Not Published",
    lastUpdated: "Apr 8",
  },
  {
    id: "insurance-req",
    title: "Insurance & Liability Requirements",
    phase: "Phase 3",
    category: "Marketplace",
    url: "#",
    summary: "Minimum insurance requirements for contractors on the marketplace. E&O, general liability, workers comp. NOT FOR PUBLICATION.",
    status: "Not Published",
    lastUpdated: "Apr 8",
  },
  {
    id: "nda",
    title: "NDA Template",
    phase: "Phase 3",
    category: "Marketplace",
    url: "#",
    summary: "Non-disclosure agreement template for sensitive project data shared between mines and contractors through the marketplace.",
    status: "Not Published",
    lastUpdated: "Apr 8",
  },
  // General Legal
  {
    id: "casl",
    title: "CASL Compliance Policy",
    phase: "General",
    category: "Legal",
    url: "https://docs.google.com/document/d/1hxNOjpdPFZ9WK7eb1Ht32yOc8_GqXVTSTOOY0xaLOPQ/edit",
    summary: "Canadian Anti-Spam Legislation compliance. Consent requirements for commercial emails, unsubscribe mechanisms, record-keeping. Critical for email outreach campaigns.",
    status: "Live",
    lastUpdated: "Apr 8",
  },
  {
    id: "pipeda",
    title: "PIPEDA Compliance Policy",
    phase: "General",
    category: "Legal",
    url: "https://docs.google.com/document/d/1yX1T1TMrsxFPhcAVzkerL48hGhHVNHjm3oPCbUIIbLo/edit",
    summary: "Personal Information Protection and Electronic Documents Act compliance. 10 fair information principles, consent management, access rights. Privacy Officer: Dylan Fader.",
    status: "Live",
    lastUpdated: "Apr 8",
  },
  {
    id: "ip-assignment",
    title: "IP Assignment Agreement",
    phase: "General",
    category: "Legal",
    url: "https://docs.google.com/document/d/1CvJaeAZP6ihCxAgM2Ow01GdhYdLlkU-bFdd0PRq37vI/edit",
    summary: "Intellectual property assignment for contractors who built the app. Ensures CoreConX owns all code, designs, and IP created during development.",
    status: "Live",
    lastUpdated: "Apr 8",
  },
  {
    id: "employee",
    title: "Employee & Contractor Agreement",
    phase: "General",
    category: "Legal",
    url: "https://docs.google.com/document/d/1BklnEoyttFVzfIgJPgKlggWwitV1-ZYh-Lwa8JbExq0/edit",
    summary: "Template for hiring employees or contractors. Roles, compensation, IP ownership, confidentiality, termination. No employees currently — for future use.",
    status: "Live",
    lastUpdated: "Apr 8",
  },
  {
    id: "insurance-internal",
    title: "Insurance Requirements (Internal)",
    phase: "General",
    category: "Legal",
    url: "https://docs.google.com/document/d/1gM0MKa_LKJc2sVknxODg_X6p5zG5YveRBXnlOBOZLFw/edit",
    summary: "Internal reference for insurance needs — E&O, cyber liability, general business insurance. Planning document for when CoreConX incorporates.",
    status: "Live",
    lastUpdated: "Apr 8",
  },
];

const statusColors: Record<string, string> = {
  Live: "bg-success/20 text-success",
  Draft: "bg-warning/20 text-warning",
  "Not Published": "bg-danger/20 text-danger",
};

const phaseIcons: Record<string, typeof Shield> = {
  "Phase 1": BookOpen,
  "Phase 2": Scale,
  "Phase 3": Shield,
  General: FileText,
};

export default function LegalPage() {
  const [selectedDoc, setSelectedDoc] = useState<LegalDoc | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPhase, setFilterPhase] = useState<string>("all");

  const filtered = legalDocs.filter((doc) => {
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPhase = filterPhase === "all" || doc.phase === filterPhase;
    return matchesSearch && matchesPhase;
  });

  const phases = ["all", "Phase 1", "Phase 2", "Phase 3", "General"];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileText size={24} className="text-coreconx-light" />
            Legal Documents
          </h1>
          <p className="text-muted text-sm mt-1">
            21 documents across all phases — click any to view details
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Docs", value: 21 },
          { label: "Live", value: legalDocs.filter((d) => d.status === "Live").length },
          { label: "Draft", value: legalDocs.filter((d) => d.status === "Draft").length },
          { label: "Not Published", value: legalDocs.filter((d) => d.status === "Not Published").length },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border border-border rounded-lg p-4 text-center">
            <p className="text-2xl font-semibold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-coreconx-light"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {phases.map((phase) => (
            <button
              key={phase}
              onClick={() => setFilterPhase(phase)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filterPhase === phase
                  ? "bg-coreconx text-white"
                  : "bg-card border border-border text-muted hover:text-foreground"
              }`}
            >
              {phase === "all" ? "All" : phase}
            </button>
          ))}
        </div>
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((doc) => {
          const Icon = phaseIcons[doc.phase] || FileText;
          return (
            <button
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className="text-left bg-card border border-border rounded-xl p-5 hover:border-coreconx/60 transition-all hover:shadow-lg hover:shadow-coreconx/5 group"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-coreconx/10 text-coreconx-light">
                  <Icon size={18} />
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[doc.status]}`}>
                  {doc.status}
                </span>
              </div>
              <h3 className="text-sm font-medium text-foreground mt-3 group-hover:text-coreconx-light transition-colors">
                {doc.title}
              </h3>
              <p className="text-xs text-muted mt-1">
                {doc.phase} — {doc.category}
              </p>
              <p className="text-xs text-muted mt-2 line-clamp-2">{doc.summary}</p>
              <p className="text-[10px] text-muted mt-3">Updated {doc.lastUpdated}</p>
            </button>
          );
        })}
      </div>

      {/* Detail Modal */}
      <Modal
        open={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        title={selectedDoc?.title || ""}
        subtitle={selectedDoc ? `${selectedDoc.phase} — ${selectedDoc.category}` : ""}
      >
        {selectedDoc && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[selectedDoc.status]}`}>
                {selectedDoc.status}
              </span>
              <span className="text-xs text-muted">Last updated: {selectedDoc.lastUpdated}</span>
            </div>

            <div className="bg-background rounded-lg p-4 border border-border">
              <h4 className="text-xs font-medium text-muted mb-2">Summary</h4>
              <p className="text-sm text-foreground leading-relaxed">{selectedDoc.summary}</p>
            </div>

            {selectedDoc.url !== "#" && (
              <a
                href={selectedDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-coreconx text-white rounded-lg text-sm font-medium hover:bg-coreconx-light transition-colors"
              >
                <ExternalLink size={16} />
                Open in Google Docs
              </a>
            )}

            {selectedDoc.status === "Not Published" && (
              <div className="bg-danger/10 border border-danger/20 rounded-lg p-3">
                <p className="text-xs text-danger font-medium">Not for publication</p>
                <p className="text-xs text-muted mt-1">
                  This document is a draft for future use. Phase 3 features are not yet built.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
