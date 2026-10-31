import type { ChangeImpactResult } from "@/types";
import { ImpactFileList } from "./ImpactFileList";
import { MockBadge } from "@/components/shared/MockBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ShieldAlert } from "lucide-react";

export function ImpactPanel({ impact }: { impact: ChangeImpactResult | null }) {
  if (!impact) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Select a file to analyze"
        description="Choose a source file to calculate direct and transitive dependents from the active repository graph."
        className="min-h-[420px]"
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/[0.07] bg-[#101014] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
                Change target
              </p>
              <MockBadge provenance={impact.provenance} />
            </div>
            <h2 className="mt-2 text-lg font-semibold text-zinc-100">
              {impact.selectedFile.name}
            </h2>
            <p className="mt-1 font-mono text-xs text-zinc-500">
              {impact.selectedFile.path}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Direct dependents" value={impact.directDependents.length} />
          <Stat
            label="Transitive dependents"
            value={impact.transitiveDependents.length}
          />
          <Stat label="Affected modules" value={impact.affectedModules.length} />
          <Stat label="Max depth" value={impact.maxDepth} />
        </div>

        <p className="mt-4 rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-[11px] leading-5 text-violet-200/80">
          {impact.note}
        </p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ImpactFileList
          title="Direct dependents"
          description="Modules that import the selected file directly."
          files={impact.directDependents}
          variant="direct"
        />
        <ImpactFileList
          title="Transitive dependents"
          description="Modules reached through two or more import hops."
          files={impact.transitiveDependents}
          variant="transitive"
        />
      </div>

      {impact.affectedModules.length > 0 ? (
        <section className="rounded-xl border border-white/[0.07] bg-[#101014] p-5">
          <h3 className="text-sm font-semibold">Potentially affected modules</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Ordered by dependency depth from the selected file.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {impact.affectedModules.map((mod) => (
              <span
                key={mod.fileId}
                className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-zinc-300"
              >
                <span className="font-mono">{mod.name}</span>
                <span className="text-zinc-600">d{mod.depth}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-100">
        {value}
      </p>
    </div>
  );
}
