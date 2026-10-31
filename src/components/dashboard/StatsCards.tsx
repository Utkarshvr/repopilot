import { FileCode2, GitBranch, ShieldAlert, Workflow } from "lucide-react";
import type { WorkspaceStats } from "@/types";
import { MockBadge } from "@/components/shared/MockBadge";

const cards = [
  {
    key: "repositories" as const,
    label: "Repositories",
    icon: GitBranch,
    hint: "Connected (mock)",
  },
  {
    key: "filesIndexed" as const,
    label: "Files Indexed",
    icon: FileCode2,
    hint: "Across repositories",
  },
  {
    key: "dependencies" as const,
    label: "Dependencies",
    icon: Workflow,
    hint: "Mapped relationships",
  },
  {
    key: "potentialRisks" as const,
    label: "Potential Risks",
    icon: ShieldAlert,
    hint: "Simulated signals",
  },
];

export function StatsCards({ stats }: { stats: WorkspaceStats }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500">Workspace statistics</p>
        <MockBadge provenance={stats.provenance} />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {cards.map(({ key, label, icon: Icon, hint }) => (
          <div
            key={key}
            className="rounded-xl border border-white/[0.07] bg-[#101014] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">{label}</p>
              <Icon size={16} className="text-zinc-500" />
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">
              {stats[key].toLocaleString()}
            </p>
            <p className="mt-1.5 text-[11px] text-zinc-500">{hint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
