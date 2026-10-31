import { useMemo, useState } from "react";
import { FileSelector } from "@/components/impact/FileSelector";
import { ImpactPanel } from "@/components/impact/ImpactPanel";
import { MockBadge } from "@/components/shared/MockBadge";
import { computeChangeImpact } from "@/lib/graph";
import { useRepositoryStore } from "@/store/repositoryStore";
import { useAppStore } from "@/store/useAppStore";
import { Link } from "react-router-dom";
import { Info, Search } from "lucide-react";
import DependencyGraph from "@/components/graph/DependencyGraph";

export default function ImpactAnalysis() {
  const graph = useRepositoryStore((s) => s.getActiveGraph());
  const analyzed = useRepositoryStore((s) => s.getActiveAnalyzed());

  const selectedFileId = useAppStore((s) => s.selectedFileId);
  const setSelectedFileId = useAppStore((s) => s.setSelectedFileId);

  const [search, setSearch] = useState("");

  const isReal = graph.provenance === "analyzed";

  const filteredFiles = useMemo(() => {
    if (!search.trim()) return graph.files;
    const q = search.toLowerCase();
    return graph.files.filter(
      (f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q),
    );
  }, [graph.files, search]);

  const impact = useMemo(
    () =>
      selectedFileId ? computeChangeImpact(graph, selectedFileId) : null,
    [graph, selectedFileId],
  );

  // Auto-update impact provenance label
  const impactWithProvenance = useMemo(() => {
    if (!impact) return null;
    return {
      ...impact,
      provenance: isReal ? ("analyzed" as const) : ("simulated" as const),
      note: isReal
        ? "Change impact computed from real AST-extracted dependency graph."
        : "Connect a public repository to calculate impact from extracted dependencies.",
    };
  }, [impact, isReal]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Change Impact Intelligence
          </h1>
          <MockBadge provenance={isReal ? "analyzed" : "simulated"} />
        </div>

        {isReal && analyzed ? (
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Real impact analysis for{" "}
            <span className="font-medium text-zinc-300">{analyzed.metadata.fullName}</span>.
            Select a file to discover all direct and transitive dependents using
            the extracted dependency graph.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="max-w-2xl text-sm text-zinc-500">
              Analyze how a change propagates through repository dependents.
            </p>
            <Link
              to="/repositories"
              className="inline-flex items-center gap-1.5 rounded border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-400 hover:text-indigo-300 transition"
            >
              <Info size={12} />
              Analyze a real repo for live data
            </Link>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* File selector column */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search files…"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition"
            />
          </div>

          <FileSelector
            files={filteredFiles}
            selectedFileId={selectedFileId}
            onSelect={setSelectedFileId}
            isReal={isReal}
          />
        </div>

        <ImpactPanel impact={impactWithProvenance} />
      </div>

      {impact && graph.files.length > 0 && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400">
            <span className="font-medium text-zinc-200">Impact graph</span>
            <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-400" />Direct dependents</span>
            <span><i className="mr-1.5 inline-block h-2 w-2 rounded-full bg-orange-400" />Transitive dependents</span>
          </div>
          <DependencyGraph
            graph={graph}
            heightClass="h-[min(65vh,620px)]"
            highlightedImpact={{
              direct: new Set(impact.directDependents.map((file) => file.fileId)),
              transitive: new Set(impact.transitiveDependents.map((file) => file.fileId)),
            }}
          />
        </section>
      )}
    </div>
  );
}
