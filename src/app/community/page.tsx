import { MessageSquare, ThumbsUp, Lightbulb, Users } from "lucide-react";

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  votes: number;
  status: "new" | "planned" | "building" | "shipped";
  submittedBy: string;
  date: string;
}

const featureRequests: FeatureRequest[] = [
  {
    id: "FR-001",
    title: "GPS tracking for drill rigs",
    description:
      "Track rig locations on a map so dispatchers can see which rigs are where without calling around.",
    votes: 0,
    status: "planned",
    submittedBy: "Dylan (internal)",
    date: "Apr 2026",
  },
  {
    id: "FR-002",
    title: "Photo logging for core samples",
    description:
      "Let drillers snap photos of core samples and auto-attach them to the shift log with depth markers.",
    votes: 0,
    status: "planned",
    submittedBy: "Dylan (internal)",
    date: "Apr 2026",
  },
  {
    id: "FR-003",
    title: "Equipment maintenance tracker",
    description:
      "Track drill bit hours, pump maintenance, and flag when things are due for service before they break.",
    votes: 0,
    status: "new",
    submittedBy: "Dylan (internal)",
    date: "Apr 2026",
  },
  {
    id: "FR-004",
    title: "Daily safety checklist",
    description:
      "Digital pre-shift safety checklist that drillers fill out on their phone. Auto-generates compliance reports.",
    votes: 0,
    status: "new",
    submittedBy: "Dylan (internal)",
    date: "Apr 2026",
  },
];

const statusConfig: Record<
  string,
  { label: string; color: string }
> = {
  new: { label: "New", color: "bg-info/20 text-info" },
  planned: { label: "Planned", color: "bg-warning/20 text-warning" },
  building: { label: "Building", color: "bg-coreconx/20 text-coreconx-light" },
  shipped: { label: "Shipped", color: "bg-success/20 text-success" },
};

export default function CommunityPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare size={24} className="text-coreconx-light" />
          Community
        </h1>
        <p className="text-muted text-sm mt-1">
          Feature requests, ideas, and feedback from founding partners
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Founding Partners",
            value: "0 / 10",
            icon: <Users size={16} />,
            sub: "Target: 10 companies",
          },
          {
            label: "Feature Requests",
            value: featureRequests.length,
            icon: <Lightbulb size={16} />,
            sub: "From internal + partners",
          },
          {
            label: "Testimonials",
            value: 0,
            icon: <MessageSquare size={16} />,
            sub: "Need first partner signup",
          },
          {
            label: "Community Score",
            value: "—",
            icon: <ThumbsUp size={16} />,
            sub: "Launches with first partner",
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

      {/* The Offer */}
      <div className="bg-coreconx/10 border border-coreconx/30 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground">
          The Founding Partner Deal
        </h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-foreground">
              What they get:
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-foreground/80">
              <li>Free access to CoreConX (no time limit)</li>
              <li>Direct line to the dev team (that&apos;s us)</li>
              <li>Their feedback shapes what gets built</li>
              <li>Locked-in pricing when it goes paid</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">
              What we get:
            </h3>
            <ul className="mt-2 space-y-1.5 text-xs text-foreground/80">
              <li>Real-world testing with actual drillers</li>
              <li>Honest feedback on what works and what doesn&apos;t</li>
              <li>Testimonials (if the product actually helps)</li>
              <li>Feature ideas from the field</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Feature Requests */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Feature Requests
          </h2>
          <span className="text-xs text-muted">
            Vote counts will go live when partners join
          </span>
        </div>
        <div className="mt-4 space-y-3">
          {featureRequests.map((request) => (
            <div
              key={request.id}
              className="flex items-start gap-4 p-4 rounded-lg border border-border bg-background hover:border-coreconx/40 transition-colors"
            >
              {/* Vote button placeholder */}
              <div className="flex flex-col items-center gap-1 min-w-[48px]">
                <button className="w-10 h-10 rounded-lg border border-border bg-card hover:border-coreconx/40 flex items-center justify-center transition-colors">
                  <ThumbsUp size={14} className="text-muted" />
                </button>
                <span className="text-xs font-mono text-muted">
                  {request.votes}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted">
                    {request.id}
                  </span>
                  <h3 className="text-sm font-medium text-foreground">
                    {request.title}
                  </h3>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      statusConfig[request.status].color
                    }`}
                  >
                    {statusConfig[request.status].label}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  {request.description}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-muted">
                    by {request.submittedBy}
                  </span>
                  <span className="text-[10px] text-muted">{request.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-card/50 border border-border/50 rounded-lg p-4">
        <p className="text-xs text-muted">
          <strong className="text-foreground">How this works:</strong> Founding
          partners submit feature requests and vote on priorities. The most-voted
          features get built first. This isn&apos;t a suggestion box — it&apos;s how we
          decide what to build next.
        </p>
      </div>
    </div>
  );
}
