import { Users, Search, ExternalLink, MapPin, Mail } from "lucide-react";

const companies = [
  {
    name: "Hardrock Diamond Drilling",
    contact: "Jordan",
    email: "jordan@hardrockdrilling.ca",
    location: "BC, Canada",
    status: "Research",
    score: 9,
    notes: "Dylan works here — warm intro possible",
  },
  {
    name: "Driftwood Diamond Drilling",
    contact: "Kevin Goodson",
    email: "kevin@driftwooddrilling.com",
    location: "BC, Canada",
    status: "Research",
    score: 7,
    notes: "Full-service diamond drilling in BC",
  },
  {
    name: "Radius Gold / Drilling",
    contact: "Tony Harte",
    email: "tonyharte@gmail.com",
    location: "BC, Canada",
    status: "Research",
    score: 6,
    notes: "Exploration-focused, smaller operation",
  },
  {
    name: "Omineca Diamond Drilling",
    contact: "Tony",
    email: "tony@ominecadrilling.com",
    location: "BC, Canada",
    status: "Research",
    score: 7,
    notes: "Northern BC operations",
  },
  {
    name: "Platinum Diamond Drilling",
    contact: "Steve Procyshyn",
    email: "steve@platinumdiamonddrilling.ca",
    location: "Manitoba, Canada",
    status: "Research",
    score: 7,
    notes: "Manitoba-based, good size",
  },
  {
    name: "Chibougamau Diamond Drilling",
    contact: "Steve Larouche",
    email: "chibougamau.drilling@sympatico.ca",
    location: "Quebec, Canada",
    status: "Research",
    score: 5,
    notes: "Quebec operations, older email",
  },
];

const statusColors: Record<string, string> = {
  Research: "bg-info/20 text-info",
  "Cold Outreach": "bg-warning/20 text-warning",
  Warm: "bg-coreconx/20 text-coreconx-light",
  Demo: "bg-accent-light/20 text-accent-light",
  Customer: "bg-success/20 text-success",
  Lost: "bg-danger/20 text-danger",
};

export default function CRMPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users size={24} className="text-coreconx-light" />
            CRM
          </h1>
          <p className="text-muted text-sm mt-1">
            Diamond drilling companies — verified contacts only
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Search companies..."
              className="bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-coreconx-light"
            />
          </div>
          <a
            href="https://docs.google.com/spreadsheets/d/1arbZpTV9DSVS8w-4FA8XhV59x_DWxpGIP1dI5vxX3ak/edit"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-coreconx text-white rounded-lg text-sm hover:bg-coreconx-light transition-colors"
          >
            <ExternalLink size={14} />
            Open Sheet
          </a>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Companies", value: companies.length },
          {
            label: "With Direct Email",
            value: companies.filter((c) => c.email).length,
          },
          { label: "Contacted", value: 0 },
          {
            label: "Avg Lead Score",
            value: (
              companies.reduce((a, b) => a + b.score, 0) / companies.length
            ).toFixed(1),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border rounded-lg p-4 text-center"
          >
            <p className="text-2xl font-semibold text-foreground">
              {stat.value}
            </p>
            <p className="text-xs text-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Company Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
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
            {companies.map((company, i) => (
              <tr
                key={company.name}
                className={`border-b border-border/50 hover:bg-card-hover transition-colors ${
                  i % 2 === 0 ? "bg-card" : "bg-background/30"
                }`}
              >
                <td className="px-5 py-4">
                  <p className="text-sm font-medium text-foreground">
                    {company.name}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{company.notes}</p>
                </td>
                <td className="px-5 py-4 text-sm text-foreground">
                  {company.contact}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <Mail size={12} className="text-muted" />
                    <span className="text-sm text-foreground font-mono">
                      {company.email}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-muted" />
                    <span className="text-sm text-muted">
                      {company.location}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      statusColors[company.status] || "bg-border text-muted"
                    }`}
                  >
                    {company.status}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-coreconx-light rounded-full"
                        style={{ width: `${company.score * 10}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-muted">
                      {company.score}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
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
