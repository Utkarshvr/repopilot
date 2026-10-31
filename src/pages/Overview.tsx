import { Plus } from "lucide-react";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { ImpactPreview } from "@/components/dashboard/ImpactPreview";
import { DependencyOverview } from "@/components/dashboard/DependencyOverview";
import { RecentRepositories } from "@/components/dashboard/RecentRepositories";
import {
  mockRepositories,
  mockWorkspaceStats,
} from "@/data/mockRepositories";
import { MockBadge } from "@/components/shared/MockBadge";

export default function Overview() {
  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date("2026-10-31"));

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{today}</p>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
              Repository Intelligence
            </h1>
            <MockBadge provenance="mock" />
          </div>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Understand your codebase. Predict the impact of every change.
            Phase I uses mock data shaped like the RepoPilot frontend.
          </p>
        </div>

        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400"
          title="Repository import arrives in Phase II"
        >
          <Plus size={16} />
          Add Repository
        </button>
      </section>

      <StatsCards stats={mockWorkspaceStats} />

      <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <ImpactPreview />
        <DependencyOverview />
      </section>

      <RecentRepositories repositories={mockRepositories} />
    </div>
  );
}
