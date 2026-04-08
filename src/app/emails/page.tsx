import {
  Mail,
  Send,
  Inbox,
  FileText,
  ExternalLink,
  ArrowRight,
} from "lucide-react";

const campaignEmails = [
  {
    id: 1,
    name: "The Honest Ask",
    subject: "Building something for drillers — could use your eyes on it",
    day: "Day 1",
    status: "Draft",
    description:
      "Opens with flaws, admits it's rough, asks for help not a sale. Buffett method — lead with negatives.",
  },
  {
    id: 2,
    name: "The Gentle Follow-Up",
    subject: "No worries if not — just following up",
    day: "Day 5-7",
    status: "Draft",
    description:
      "Respects their time, 'I know what 12-hour days look like,' easy out.",
  },
  {
    id: 3,
    name: "The Last Door",
    subject: "Last one from me — door's always open",
    day: "Day 12-14",
    status: "Draft",
    description:
      "Honest scarcity (10 companies), referral ask, graceful close. No follow-up after this.",
  },
];

const templateCategories = [
  { name: "Onboarding", count: 6, icon: "📥" },
  { name: "Transactional", count: 5, icon: "💳" },
  { name: "Engagement", count: 4, icon: "📊" },
  { name: "Marketplace", count: 5, icon: "🤝" },
  { name: "Support", count: 4, icon: "🎧" },
  { name: "Outreach", count: 4, icon: "📨" },
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

export default function EmailsPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Mail size={24} className="text-coreconx-light" />
            Email Hub
          </h1>
          <p className="text-muted text-sm mt-1">
            Campaigns, templates, and inbox management
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

      {/* Founding Partner Campaign */}
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
          frameworks, testimonial exchange. Free app for honest feedback.
        </p>

        <div className="mt-4 space-y-3">
          {campaignEmails.map((email) => (
            <div
              key={email.id}
              className="flex items-start gap-4 p-4 rounded-lg border border-border bg-background hover:border-coreconx/40 transition-colors"
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
            </div>
          ))}
        </div>
      </div>

      {/* Template Categories */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-foreground">
          Email Templates
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {templateCategories.map((cat) => (
            <div
              key={cat.name}
              className="p-4 rounded-lg border border-border bg-background hover:border-coreconx/40 transition-colors"
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
            </div>
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
    </div>
  );
}
