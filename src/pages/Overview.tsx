import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { ImpactPreview } from "@/components/dashboard/ImpactPreview";
import { DependencyOverview } from "@/components/dashboard/DependencyOverview";
import { RecentRepositories } from "@/components/dashboard/RecentRepositories";
import { MockBadge } from "@/components/shared/MockBadge";
import { useRepositoryStore } from "@/store/repositoryStore";
import type { WorkspaceStats } from "@/types";

export default function Overview() {
  const analyzedRepositories = useRepositoryStore((s) => s.analyzedRepositories);

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());

  const hasRealData = Object.keys(analyzedRepositories).length > 0;

  // Build real workspace stats if we have analyzed repos
  const workspaceStats: WorkspaceStats = hasRealData
    ? {
        repositories: Object.keys(analyzedRepositories).length,
        filesIndexed: Object.values(analyzedRepositories).reduce(
          (sum, r) => sum + r.stats.filesAnalyzed,
          0,
        ),
        dependencies: Object.values(analyzedRepositories).reduce(
          (sum, r) => sum + r.stats.edges,
          0,
        ),
        potentialRisks: Object.values(analyzedRepositories).reduce(
          (sum, r) => sum + r.stats.unresolved,
          0,
        ),
        provenance: "analyzed",
      }
    : { repositories: 0, filesIndexed: 0, dependencies: 0, potentialRisks: 0, provenance: "simulated" as const };

  // Build repository list from analyzed repos
  const repositories = hasRealData
    ? Object.values(analyzedRepositories)
        .sort(
          (a, b) =>
            new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime(),
        )
        .map((a) => a.repository)
    : [];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{today}</p>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
              Repository Intelligence
            </h1>
            <MockBadge provenance={workspaceStats.provenance} />
          </div>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            {hasRealData
              ? `Analyzing ${workspaceStats.repositories} repositor${workspaceStats.repositories === 1 ? "y" : "ies"} with real AST-extracted dependency data.`
              : "Understand your codebase. Predict the impact of every change. Connect a GitHub repository to get started."}
          </p>
        </div>

        <Link
          to="/repositories"
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          <Plus size={16} />
          Add Repository
        </Link>
      </section>

      <StatsCards stats={workspaceStats} />

      <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <ImpactPreview />
        <DependencyOverview />
      </section>

      {repositories.length > 0 ? (
        <RecentRepositories repositories={repositories} />
      ) : (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#0d0d10] px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">No repositories analyzed yet.</p>
          <p className="mt-1 text-xs text-zinc-700">
            Go to{" "}
            <Link to="/repositories" className="text-indigo-400 hover:text-indigo-300">
              Repositories
            </Link>{" "}
            to connect a GitHub repository.
          </p>
        </div>
      )}
    </div>
  );
}
