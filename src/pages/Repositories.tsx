import { GitBranch, PackageOpen } from "lucide-react";
import { RepositoryConnector } from "@/components/repositories/RepositoryConnector";
import { AnalyzedRepositoryCard } from "@/components/repositories/AnalyzedRepositoryCard";
import { useRepositoryStore } from "@/store/repositoryStore";

export default function Repositories() {
  const analyzedRepositories = useRepositoryStore((s) => s.analyzedRepositories);
  const analyzedList = Object.values(analyzedRepositories).sort(
    (a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime(),
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      {/* Header */}
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Repositories</h1>
            <span className="flex items-center gap-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <GitBranch size={10} />
              Live
            </span>
          </div>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Connect a public GitHub repository to extract its real dependency graph
            using AST-based import analysis.
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr] xl:grid-cols-[480px_1fr]">
        {/* Left: connector */}
        <div>
          <RepositoryConnector />
        </div>

        {/* Right: analyzed repositories */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">
              Analyzed Repositories
              {analyzedList.length > 0 && (
                <span className="ml-2 rounded-full bg-white/[0.07] px-2 py-0.5 text-xs font-normal text-zinc-400">
                  {analyzedList.length}
                </span>
              )}
            </h2>
          </div>

          {analyzedList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/[0.08] bg-[#0d0d10] px-6 py-12 text-center">
              <PackageOpen size={28} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-zinc-500">No repositories analyzed yet</p>
              <p className="mt-1 text-xs text-zinc-700">
                Enter a GitHub URL and click Analyze Repository to get started.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {analyzedList.map((analyzed) => (
                <AnalyzedRepositoryCard key={analyzed.id} analyzed={analyzed} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
