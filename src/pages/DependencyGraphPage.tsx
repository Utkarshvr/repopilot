import DependencyGraph from "@/components/graph/DependencyGraph";
import { MockBadge } from "@/components/shared/MockBadge";
import { useRepositoryStore } from "@/store/repositoryStore";
import { Link } from "react-router-dom";
import { GitBranch, Info } from "lucide-react";
import { useMemo } from "react";
import { buildGraphIndex, getDependencyGraphStatistics } from "@/lib/graph";

export default function DependencyGraphPage() {
  const graph = useRepositoryStore((s) => s.getActiveGraph());
  const analyzed = useRepositoryStore((s) => s.getActiveAnalyzed());
  const graphStatistics = useMemo(
    () => getDependencyGraphStatistics(buildGraphIndex(graph)),
    [graph],
  );

  const isReal = graph.provenance === "analyzed";

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <section>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Dependency Graph
          </h1>
          <MockBadge provenance={graph.provenance} />
        </div>

        {isReal && analyzed ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-zinc-500">
              Real dependency graph for{" "}
              <span className="font-medium text-zinc-300">{analyzed.metadata.fullName}</span>
              {" "}— {graph.files.length} files, {graph.edges.length} edges.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <GitBranch size={12} />
              {analyzed.branch}
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="max-w-2xl text-sm text-zinc-500">
              Interactive visualization of import relationships. Select a file to
              highlight direct dependencies and dependents.
            </p>
            <Link
              to="/repositories"
              className="inline-flex items-center gap-1.5 rounded border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-400 hover:text-indigo-300 transition"
            >
              <Info size={12} />
              No repository analyzed — connect one to view its graph
            </Link>
          </div>
        )}
      </section>

      {/* Analysis stats (real only) */}
      {isReal && analyzed && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
            <StatPill label="Internal files" value={graphStatistics.totalInternalFiles} />
            <StatPill label="Internal relationships" value={graphStatistics.totalInternalEdges} />
            <StatPill label="Files with no dependencies" value={graphStatistics.filesWithNoDependencies.length} />
            <StatPill label="Files with no dependents" value={graphStatistics.filesWithNoDependents.length} />
            <StatPill label="Circular groups" value={graphStatistics.circularDependencyGroups.length} warn={graphStatistics.circularDependencyGroups.length > 0} />
            <StatPill label="External packages" value={analyzed.stats.externalPackages} />
            <StatPill label="Unresolved imports" value={analyzed.stats.unresolved} warn={analyzed.stats.unresolved > 0} />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-zinc-500">
            <span>Most imported: {graphStatistics.mostImportedFiles[0] ? `${graphStatistics.mostImportedFiles[0].fileId} (${graphStatistics.mostImportedFiles[0].dependentCount} dependents)` : "None"}</span>
            <span>Highest dependency count: {graphStatistics.highestDependencyCounts[0] ? `${graphStatistics.highestDependencyCounts[0].fileId} (${graphStatistics.highestDependencyCounts[0].dependencyCount})` : "None"}</span>
          </div>
        </div>
      )}

      <DependencyGraph graph={graph} heightClass="h-[min(72vh,720px)]" />

      {/* Unresolved imports panel */}
      {isReal && analyzed && analyzed.unresolvedImports.length > 0 && (
        <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
          <h3 className="text-sm font-semibold text-amber-300">
            Unresolved imports ({analyzed.unresolvedImports.length})
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            These imports could not be resolved to a source file. They may be
            dynamic paths, generated modules, or missing files.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
            {analyzed.unresolvedImports.slice(0, 60).map((imp, i) => (
              <span
                key={`${imp.importingFile}-${imp.specifier}-${i}`}
                className="rounded border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] text-amber-400/80"
              >
                {imp.specifier}
              </span>
            ))}
            {analyzed.unresolvedImports.length > 60 && (
              <span className="text-xs text-zinc-600 self-center">
                +{analyzed.unresolvedImports.length - 60} more
              </span>
            )}
          </div>
        </section>
      )}

      {/* External packages */}
      {isReal && analyzed && analyzed.externalPackages.length > 0 && (
        <section className="rounded-xl border border-white/[0.07] bg-[#101014] p-5">
          <h3 className="text-sm font-semibold">
            External packages ({analyzed.externalPackages.length})
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            npm packages detected in imports (excluded from graph nodes).
          </p>
          <div className="mt-3 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {analyzed.externalPackages.map((pkg) => (
              <span
                key={pkg}
                className="rounded border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-zinc-400"
              >
                {pkg}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatPill({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#101014] px-4 py-3 text-center">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p
        className={`mt-1.5 text-xl font-semibold tabular-nums ${
          warn && typeof value === "number" && value > 0 ? "text-amber-400" : "text-zinc-100"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}
