import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: { value: string; positive: boolean };
}

export function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:border-coreconx/40 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted text-sm">{title}</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted mt-1">{subtitle}</p>}
          {trend && (
            <p
              className={`text-xs mt-2 ${
                trend.positive ? "text-success" : "text-danger"
              }`}
            >
              {trend.value}
            </p>
          )}
        </div>
        <div className="p-2 rounded-lg bg-coreconx/10 text-coreconx-light">
          {icon}
        </div>
      </div>
    </div>
  );
}
