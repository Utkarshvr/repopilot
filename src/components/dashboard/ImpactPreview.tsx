import { ArrowUpRight, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { MockBadge } from "@/components/shared/MockBadge";
import { useAppStore } from "@/store/useAppStore";
import { repoPilotGraph } from "@/data/mockDependencyGraph";
import { computeChangeImpact } from "@/lib/graph";

export function ImpactPreview() {
  const selectedFileId = useAppStore((s) => s.selectedFileId);
  const impact = selectedFileId
    ? computeChangeImpact(repoPilotGraph, selectedFileId)
    : null;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#101014] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Change Impact Intelligence</h3>
            <MockBadge provenance="simulated" />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Preview what breaks when a file changes — using the mock graph.
          </p>
        </div>
        <ShieldAlert size={18} className="shrink-0 text-indigo-400" />
      </div>

      {impact ? (
        <div className="mt-5 rounded-lg border border-indigo-500/20 bg-indigo-500/[0.05] p-4">
          <p className="text-[10px] font-medium tracking-wide text-indigo-400 uppercase">
            Selected file
          </p>
          <p className="mt-2 font-mono text-sm text-zinc-100">
            {impact.selectedFile.path}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Metric
              label="Direct"
              value={impact.directDependents.length}
            />
            <Metric
              label="Transitive"
              value={impact.transitiveDependents.length}
            />
            <Metric label="Max depth" value={impact.maxDepth} />
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">{impact.note}</p>
          <Link
            to="/impact"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 transition hover:text-indigo-300"
          >
            Open full impact analysis
            <ArrowUpRight size={15} />
          </Link>
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-sm text-zinc-300">No file selected</p>
          <p className="mt-1 text-xs text-zinc-500">
            Pick a node in the dependency graph to simulate impact.
          </p>
          <Link
            to="/graph"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-400 transition hover:text-indigo-300"
          >
            Open dependency graph
            <ArrowUpRight size={15} />
          </Link>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-[#0d0d10] px-3 py-2">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
