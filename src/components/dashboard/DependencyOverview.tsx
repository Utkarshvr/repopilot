import { ArrowUpRight, Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { MockBadge } from "@/components/shared/MockBadge";
import { useRepositoryStore } from "@/store/repositoryStore";

export function DependencyOverview() {
  const graph = useRepositoryStore((s) => s.getActiveGraph());
  const { files, edges, provenance, note } = graph;

  const byKind = files.reduce<Record<string, number>>((acc, file) => {
    acc[file.kind] = (acc[file.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#101014] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Dependency Overview</h3>
            <MockBadge provenance={provenance} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {files.length} files · {edges.length} edges
          </p>
        </div>
        <Workflow size={18} className="shrink-0 text-indigo-400" />
      </div>

      <div className="mt-5 space-y-2">
        {Object.entries(byKind)
          .sort((a, b) => b[1] - a[1])
          .map(([kind, count]) => (
            <div
              key={kind}
              className="flex items-center justify-between rounded-md border border-white/[0.05] bg-white/[0.02] px-3 py-2"
            >
              <span className="text-xs capitalize text-zinc-400">{kind}</span>
              <span className="text-xs font-medium tabular-nums text-zinc-200">
                {count}
              </span>
            </div>
          ))}
      </div>

      <p className="mt-4 text-[11px] leading-5 text-zinc-500">{note}</p>

      <Link
        to="/graph"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 transition hover:text-indigo-300"
      >
        Explore graph
        <ArrowUpRight size={15} />
      </Link>
    </div>
  );
}
