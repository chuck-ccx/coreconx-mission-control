"use client";

import { useState } from "react";
import {
  Mail,
  Send,
  Inbox,
  FileText,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { Modal } from "@/components/modal";

interface CampaignEmail {
  id: number;
  name: string;
  subject: string;
  day: string;
  status: string;
  description: string;
  body: string;
}

const campaignEmails: CampaignEmail[] = [
  {
    id: 1,
    name: "The Honest Ask",
    subject: "Building something for drillers — could use your eyes on it",
    day: "Day 1",
    status: "Draft",
    description:
      "Opens with flaws, admits it's rough, asks for help not a sale. Buffett method — lead with negatives.",
    body: `Hey [Name],

I'm Dylan — I work as a helper at Hardrock Diamond Drilling. I've been trying to build an app for diamond drillers on the side and I'll be honest, it's rough around the edges. The UI needs work, there are features missing, and I'm figuring it out as I go.

But the core works — tracking driller performance, shifts, and project data without spreadsheets or paper. I built it because nothing out there is made for what we actually do.

I'm not looking for customers right now. I'm looking for a few drillers willing to beat it up and tell me what's broken. No cost, no contract. If it's useful, all I'd ask is an honest testimonial down the road. If it's not useful, tell me that too — that's just as valuable.

Would you be open to taking a look?

Dylan`,
  },
  {
    id: 2,
    name: "The Gentle Follow-Up",
    subject: "No worries if not — just following up",
    day: "Day 5-7",
    status: "Draft",
    description:
      "Respects their time, 'I know what 12-hour days look like,' easy out.",
    body: `Hey [Name],

Just following up — totally get it if you're slammed. I know what 12-hour days on a drill look like.

Quick context if my last email got buried: I'm a helper at Hardrock building an app to track driller performance and shifts. No customers yet, no testimonials, no polished marketing page. Just a working tool that needs real drillers to test it.

It's free. The only thing I'd ask for is honest feedback — and if it actually helps, a testimonial down the road.

If the timing's wrong, no stress at all. Door's open whenever.

Dylan`,
  },
  {
    id: 3,
    name: "The Last Door",
    subject: "Last one from me — door's always open",
    day: "Day 12-14",
    status: "Draft",
    description:
      "Honest scarcity (10 companies), referral ask, graceful close. No follow-up after this.",
    body: `Hey [Name],

Last email from me — I promise.

I'm looking for 10 diamond drilling companies to test an app I built for tracking driller performance and shifts. I can only support 10 right now because it's just me, and I want to give each company real attention.

The deal is simple: free access to the app, your honest feedback shapes what gets built, and if it works for you, a testimonial I can use.

If this isn't for you, totally respect that. If you know someone who might be interested, I'd appreciate the intro.

Either way, thanks for reading. Door's always open.

Dylan

Reply STOP to unsubscribe.`,
  },
];

interface Template {
  name: string;
  subject: string;
  body: string;
}

interface TemplateCategory {
  name: string;
  count: number;
  icon: string;
  templates: Template[];
}

const templateCategories: TemplateCategory[] = [
  {
    name: "Onboarding",
    count: 6,
    icon: "📥",
    templates: [
      { name: "Welcome Email", subject: "Welcome to CoreConX", body: "Hey [Name],\n\nWelcome to CoreConX! You're one of our founding partners, and that means a lot.\n\nHere's how to get started:\n1. Download the app (link coming soon to App Store/Google Play)\n2. Create your first project\n3. Log your first drill shift\n\nIf you hit any snags, reply to this email — I'm here to help.\n\nDylan" },
      { name: "Email Verification", subject: "Verify your CoreConX email", body: "Click the link below to verify your email address:\n\n[Verification Link]\n\nIf you didn't create a CoreConX account, ignore this email." },
      { name: "Password Reset", subject: "Reset your CoreConX password", body: "Someone requested a password reset for your CoreConX account.\n\nClick here to reset: [Reset Link]\n\nThis link expires in 24 hours. If you didn't request this, no action needed." },
      { name: "Trial Started", subject: "Your CoreConX account is live", body: "Hey [Name],\n\nYour CoreConX account is set up and ready to go.\n\nLog your first shift in under 2 minutes — that's all it takes to see the value.\n\nDylan" },
      { name: "Trial Expiring (7 days)", subject: "Your CoreConX access — 7 days left", body: "Hey [Name],\n\nJust a heads up — your founding partner access is active and running smoothly. Any feedback so far?\n\nDylan" },
      { name: "Trial Expiring (1 day)", subject: "Quick check-in on CoreConX", body: "Hey [Name],\n\nHow's the app working for you? I'd love to hear what's useful and what needs work.\n\nDylan" },
    ],
  },
  {
    name: "Transactional",
    count: 5,
    icon: "💳",
    templates: [
      { name: "Subscription Confirmed", subject: "You're subscribed to CoreConX", body: "Thanks for subscribing! Your account is now on the [Plan] plan.\n\nBilling: $150/mo per user\nNext payment: [Date]\n\nManage your subscription in Settings > Billing.\n\nDylan" },
      { name: "Invoice / Payment Receipt", subject: "CoreConX payment receipt", body: "Payment received — thanks!\n\nAmount: [Amount]\nDate: [Date]\nInvoice: [Link]\n\nQuestions? Reply to this email." },
      { name: "Payment Failed", subject: "Payment issue with your CoreConX account", body: "Hey [Name],\n\nYour payment didn't go through. We'll retry in 3 days.\n\nUpdate your payment method: [Link]\n\nIf you need help, just reply.\n\nDylan" },
      { name: "Subscription Cancelled", subject: "CoreConX cancellation confirmed", body: "Hey [Name],\n\nYour subscription has been cancelled. Your data will be available for 30 days.\n\nIf there's anything we could have done better, I'd genuinely like to know.\n\nDylan" },
      { name: "Plan Change Confirmation", subject: "CoreConX plan updated", body: "Your plan has been updated to [New Plan].\n\nChanges take effect immediately. Your next invoice will reflect the new rate.\n\nDylan" },
    ],
  },
  {
    name: "Engagement",
    count: 4,
    icon: "📊",
    templates: [
      { name: "First Drill Logged", subject: "Nice — first drill logged!", body: "Hey [Name],\n\nYou just logged your first drill shift in CoreConX. That data's already working for you.\n\nTip: Log consistently for a week and you'll start seeing performance patterns you never noticed.\n\nDylan" },
      { name: "Weekly Summary", subject: "Your CoreConX weekly summary", body: "Hey [Name],\n\nHere's your week:\n- Shifts logged: [X]\n- Total meters: [X]\n- Top performer: [Name]\n\nKeep it up.\n\nDylan" },
      { name: "Product Update", subject: "What's new in CoreConX", body: "Hey [Name],\n\nNew this week:\n- [Feature 1]\n- [Feature 2]\n- [Bug fix]\n\nYour feedback drove [Feature 1] — thanks for that.\n\nDylan" },
      { name: "Inactivity Nudge", subject: "Haven't seen you in a while", body: "Hey [Name],\n\nNoticed you haven't logged in for a bit. Everything OK?\n\nIf something's not working or the app isn't useful, I'd rather hear it straight. No hard feelings.\n\nDylan" },
    ],
  },
  {
    name: "Marketplace",
    count: 5,
    icon: "🤝",
    templates: [
      { name: "New Job Match", subject: "New drilling opportunity matches your profile", body: "Hey [Name],\n\nA new project just came in that matches your profile:\n\n[Project details]\n\nInterested? Reply or check the marketplace.\n\nDylan" },
      { name: "Profile Approved", subject: "Your contractor profile is live", body: "Hey [Name],\n\nYour contractor profile is now live on the CoreConX marketplace. Mine operators can now find and contact you.\n\nDylan" },
      { name: "Job Request Received", subject: "New drilling request for your review", body: "A mine operator has submitted a drilling request:\n\n[Request details]\n\nReview and respond in the marketplace.\n\nDylan" },
      { name: "Match Confirmed", subject: "You've been matched!", body: "Hey [Name],\n\nYou've been matched with [Other Party] for [Project].\n\nWe'll make an intro shortly. Questions? Reply here.\n\nDylan" },
      { name: "Review Request", subject: "How did the project go?", body: "Hey [Name],\n\nThe [Project] with [Other Party] is marked complete. Would you mind leaving a quick review?\n\n[Review Link]\n\nThanks!\nDylan" },
    ],
  },
  {
    name: "Support",
    count: 4,
    icon: "🎧",
    templates: [
      { name: "Ticket Received", subject: "Got your support request", body: "Hey [Name],\n\nGot your message. I'm looking into it now and will get back to you shortly.\n\nTicket: [ID]\n\nChuck (CoreConX Support)" },
      { name: "Ticket Resolved", subject: "Your support ticket is resolved", body: "Hey [Name],\n\nYour issue has been resolved:\n\n[Resolution details]\n\nIf it's not fully fixed, just reply and we'll keep working on it.\n\nChuck (CoreConX Support)" },
      { name: "Maintenance Notice", subject: "Scheduled maintenance — [Date]", body: "Hey [Name],\n\nQuick heads up — we have scheduled maintenance on [Date] from [Time] to [Time].\n\nThe app may be briefly unavailable. Your data is safe.\n\nDylan" },
      { name: "Data Export Ready", subject: "Your data export is ready", body: "Your data export is ready for download:\n\n[Download Link]\n\nThis link expires in 7 days.\n\nChuck (CoreConX Support)" },
    ],
  },
  {
    name: "Outreach",
    count: 4,
    icon: "📨",
    templates: [
      { name: "Cold Outreach", subject: "Quick question about your drilling ops", body: "Hey [Name],\n\nI'm Dylan — I work as a helper at Hardrock Diamond Drilling. I've been building an app to track driller performance and shifts because the tools out there aren't built for us.\n\nI'm looking for companies willing to try it and give honest feedback. Free, no strings.\n\nWorth a quick look?\n\nDylan" },
      { name: "Warm Follow-Up", subject: "Following up — CoreConX", body: "Hey [Name],\n\nWe met at [Event/Connection]. I mentioned the drilling app I've been building — wanted to follow up and see if you'd be open to trying it.\n\nFree access, just looking for real-world feedback.\n\nDylan" },
      { name: "Partnership Inquiry", subject: "Partnership idea for [Company]", body: "Hey [Name],\n\nI'm building CoreConX — a performance tracking app for diamond drillers. I think there might be a natural fit between what we're building and what [Company] does.\n\nWould you be open to a quick chat?\n\nDylan" },
      { name: "Demo Invite", subject: "Want to see CoreConX in action?", body: "Hey [Name],\n\nI can do a quick 10-minute walkthrough of the app — just screen share, no slides, no pitch.\n\nWould [Day] work for you?\n\nDylan" },
    ],
  },
];

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

const tabs = ["Campaign", "Templates", "Sent", "Legal Docs"] as const;
type Tab = typeof tabs[number];

const legalDocs = [
  { phase: "Phase 1 — MVP Launch", docs: [
    { name: "Terms of Service", url: "https://docs.google.com/document/d/1k8123ZrJiTJhrrnYHtltx5ZJmbrDPz-NEtJHyVKtu2A/edit" },
    { name: "Privacy Policy", url: "https://docs.google.com/document/d/1e4Y9yMl8QTsX1W8k3cQ6qcUWuNkVBYNeAoUc8hDskSM/edit" },
    { name: "Acceptable Use Policy", url: "https://docs.google.com/document/d/10aUm-xY3tmYVE6nr002sEWTiTjoj25AKvZAN2HLsI00/edit" },
    { name: "Cookie Policy", url: "https://docs.google.com/document/d/1jUpikcRCTqdLIiamXr7xrBnxDfyIWyfVbXdzvjKBpZY/edit" },
    { name: "Getting Started Guide", url: "https://docs.google.com/document/d/1ehRkppftE-L53QiVqNTeBL9pXZP2gHqlcFKK73vFSdc/edit" },
  ]},
  { phase: "Phase 2 — Paid Plans & Data", docs: [
    { name: "Subscription Agreement", url: "" },
    { name: "Data Processing Agreement (DPA)", url: "" },
    { name: "Service Level Agreement (SLA)", url: "" },
    { name: "Refund & Cancellation Policy", url: "" },
    { name: "End User License Agreement (EULA)", url: "" },
  ]},
  { phase: "Phase 3 — Marketplace (DRAFT)", docs: [
    { name: "Marketplace Terms", url: "" },
    { name: "Independent Contractor Agreement", url: "" },
    { name: "Commission & Fee Schedule", url: "" },
    { name: "Dispute Resolution Policy", url: "" },
    { name: "Insurance & Liability Requirements", url: "" },
    { name: "NDA Template", url: "" },
  ]},
  { phase: "General Legal", docs: [
    { name: "CASL Compliance Policy", url: "https://docs.google.com/document/d/1hxNOjpdPFZ9WK7eb1Ht32yOc8_GqXVTSTOOY0xaLOPQ/edit" },
    { name: "PIPEDA Compliance Policy", url: "https://docs.google.com/document/d/1yX1T1TMrsxFPhcAVzkerL48hGhHVNHjm3oPCbUIIbLo/edit" },
    { name: "IP Assignment Agreement", url: "https://docs.google.com/document/d/1CvJaeAZP6ihCxAgM2Ow01GdhYdLlkU-bFdd0PRq37vI/edit" },
    { name: "Employee & Contractor Agreement", url: "https://docs.google.com/document/d/1BklnEoyttFVzfIgJPgKlggWwitV1-ZYh-Lwa8JbExq0/edit" },
    { name: "Insurance Requirements (Internal)", url: "https://docs.google.com/document/d/1gM0MKa_LKJc2sVknxODg_X6p5zG5YveRBXnlOBOZLFw/edit" },
  ]},
];

const sentEmails: { to: string; subject: string; date: string; status: string }[] = [];

export default function EmailsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Campaign");
  const [selectedEmail, setSelectedEmail] = useState<CampaignEmail | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail size={24} className="text-coreconx-light" />
            Email Hub
          </h1>
          <p className="text-muted text-sm mt-1">
            Campaigns, templates, sent emails, and legal documents
          </p>
        </div>
        <div className="flex gap-3">
          <a
            href="https://docs.google.com/spreadsheets/d/1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-lg text-sm hover:bg-card-hover transition-colors"
          >
            <ExternalLink size={14} />
            CRM Sheet
          </a>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Emails Sent",
            value: "0",
            icon: <Send size={16} />,
            sub: "Campaign not launched",
          },
          {
            label: "Inbox",
            value: "—",
            icon: <Inbox size={16} />,
            sub: "Monitoring 10 aliases",
          },
          {
            label: "Templates",
            value: "28",
            icon: <FileText size={16} />,
            sub: "6 categories",
          },
          {
            label: "Domain Auth",
            value: "3/3",
            icon: <Mail size={16} />,
            sub: "SPF + DKIM + DMARC",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-xl p-4"
          >
            <div className="flex items-center gap-2 text-muted">
              {stat.icon}
              <span className="text-xs">{stat.label}</span>
            </div>
            <p className="text-2xl font-semibold text-foreground mt-2">
              {stat.value}
            </p>
            <p className="text-xs text-muted mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-coreconx text-white"
                : "text-muted hover:text-foreground hover:bg-card-hover"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Campaign Tab */}
      {activeTab === "Campaign" && (
        <>
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Founding Partner Campaign
              </h2>
              <span className="text-xs px-3 py-1 rounded-full bg-warning/20 text-warning font-medium">
                Ready to Launch
              </span>
            </div>
            <p className="text-sm text-muted mt-2">
              3-email sequence — Buffett method (lead with negatives), Hormozi
              frameworks, testimonial exchange. Click any email to view the full body.
            </p>

            <div className="mt-4 space-y-3">
              {campaignEmails.map((email) => (
                <button
                  key={email.id}
                  onClick={() => setSelectedEmail(email)}
                  className="w-full text-left flex items-start gap-4 p-4 rounded-lg border border-border bg-background hover:border-coreconx/40 transition-colors cursor-pointer"
                >
                  <div className="flex-shrink-0 w-16 text-center">
                    <span className="text-xs font-mono text-muted">
                      {email.day}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-foreground">
                        {email.name}
                      </h3>
                      <ArrowRight size={12} className="text-muted" />
                      <span className="text-xs text-muted italic">
                        &quot;{email.subject}&quot;
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-1">{email.description}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-card-hover text-muted">
                    {email.status}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Active Aliases */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-lg font-semibold text-foreground">
              Email Aliases
            </h2>
            <p className="text-xs text-muted mt-1">
              All routed to chuck@coreconx.group
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {aliases.map((alias) => (
                <span
                  key={alias}
                  className="text-xs px-3 py-1.5 rounded-full bg-coreconx/10 text-coreconx-light font-mono"
                >
                  {alias}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Templates Tab */}
      {activeTab === "Templates" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-lg font-semibold text-foreground">
            Email Templates
          </h2>
          <p className="text-xs text-muted mt-1">Click a category to see all templates, then click a template to read the full body</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {templateCategories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat)}
                className="text-left p-4 rounded-lg border border-border bg-background hover:border-coreconx/40 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      {cat.name}
                    </h3>
                    <p className="text-xs text-muted">
                      {cat.count} templates
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sent Tab */}
      {activeTab === "Sent" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-lg font-semibold text-foreground">Sent Emails</h2>
          <p className="text-xs text-muted mt-1">Track all outgoing emails from CoreConX</p>
          {sentEmails.length === 0 ? (
            <div className="mt-8 text-center py-12">
              <Send size={40} className="mx-auto text-muted/30" />
              <p className="text-muted mt-4">No emails sent yet</p>
              <p className="text-xs text-muted mt-1">Emails will appear here once the founding partner campaign launches</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {sentEmails.map((email, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border bg-background">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{email.subject}</p>
                    <p className="text-xs text-muted">To: {email.to}</p>
                  </div>
                  <span className="text-xs text-muted">{email.date}</span>
                  <span className="text-xs px-2 py-1 rounded bg-success/20 text-success">{email.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legal Docs Tab */}
      {activeTab === "Legal Docs" && (
        <div className="space-y-4">
          {legalDocs.map((section) => (
            <div key={section.phase} className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-lg font-semibold text-foreground">{section.phase}</h2>
              <div className="mt-3 space-y-2">
                {section.docs.map((doc) => (
                  <a
                    key={doc.name}
                    href={doc.url || "#"}
                    target={doc.url ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className={`flex items-center justify-between p-3 rounded-lg border border-border bg-background transition-colors ${
                      doc.url ? "hover:border-coreconx/40 cursor-pointer" : "opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-coreconx-light" />
                      <span className="text-sm font-medium text-foreground">{doc.name}</span>
                    </div>
                    {doc.url ? (
                      <ExternalLink size={14} className="text-muted" />
                    ) : (
                      <span className="text-xs text-muted">In Drive — link pending</span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Campaign Email Modal */}
      <Modal
        open={!!selectedEmail}
        onClose={() => setSelectedEmail(null)}
        title={selectedEmail?.name || ""}
        subtitle={selectedEmail ? `Subject: "${selectedEmail.subject}"` : ""}
      >
        {selectedEmail && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs px-2.5 py-1 rounded-full bg-warning/20 text-warning font-medium">
                {selectedEmail.status}
              </span>
              <span className="text-xs text-muted">Send on {selectedEmail.day}</span>
            </div>
            <div className="bg-background rounded-lg p-4 border border-border">
              <h4 className="text-xs font-medium text-muted mb-2">Strategy</h4>
              <p className="text-sm text-foreground">{selectedEmail.description}</p>
            </div>
            <div className="bg-background rounded-lg p-4 border border-border">
              <h4 className="text-xs font-medium text-muted mb-2">Email Body</h4>
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{selectedEmail.body}</pre>
            </div>
          </div>
        )}
      </Modal>

      {/* Template Category Modal */}
      <Modal
        open={!!selectedCategory && !selectedTemplate}
        onClose={() => setSelectedCategory(null)}
        title={selectedCategory ? `${selectedCategory.icon} ${selectedCategory.name} Templates` : ""}
        subtitle={selectedCategory ? `${selectedCategory.count} templates` : ""}
        wide
      >
        {selectedCategory && (
          <div className="space-y-2">
            {selectedCategory.templates.map((tpl) => (
              <button
                key={tpl.name}
                onClick={() => setSelectedTemplate(tpl)}
                className="w-full text-left p-4 rounded-lg border border-border bg-background hover:border-coreconx/40 transition-colors"
              >
                <h3 className="text-sm font-medium text-foreground">{tpl.name}</h3>
                <p className="text-xs text-muted mt-1">Subject: &quot;{tpl.subject}&quot;</p>
              </button>
            ))}
          </div>
        )}
      </Modal>

      {/* Individual Template Modal */}
      <Modal
        open={!!selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        title={selectedTemplate?.name || ""}
        subtitle={selectedTemplate ? `Subject: "${selectedTemplate.subject}"` : ""}
      >
        {selectedTemplate && (
          <div className="space-y-4">
            <div className="bg-background rounded-lg p-4 border border-border">
              <h4 className="text-xs font-medium text-muted mb-2">Email Body</h4>
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">{selectedTemplate.body}</pre>
            </div>
            <button
              onClick={() => setSelectedTemplate(null)}
              className="text-xs text-muted hover:text-foreground transition-colors"
            >
              ← Back to {selectedCategory?.name} templates
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
