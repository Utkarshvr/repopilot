import { useMemo } from "react";
import { FileSelector } from "@/components/impact/FileSelector";
import { ImpactPanel } from "@/components/impact/ImpactPanel";
import { MockBadge } from "@/components/shared/MockBadge";
import { repoPilotGraph } from "@/data/mockDependencyGraph";
import { computeChangeImpact } from "@/lib/graph";
import { useAppStore } from "@/store/useAppStore";

export default function ImpactAnalysis() {
  const selectedFileId = useAppStore((s) => s.selectedFileId);
  const setSelectedFileId = useAppStore((s) => s.setSelectedFileId);

  const impact = useMemo(
    () =>
      selectedFileId
        ? computeChangeImpact(repoPilotGraph, selectedFileId)
        : null,
    [selectedFileId],
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Change Impact Intelligence
          </h1>
          <MockBadge provenance="simulated" />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Simulate how a change propagates through dependents. Traversal uses
          the mock RepoPilot graph — results are labeled simulated, not analyzed.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <FileSelector
          files={repoPilotGraph.files}
          selectedFileId={selectedFileId}
          onSelect={setSelectedFileId}
        />
        <ImpactPanel impact={impact} />
      </div>
    </div>
  );
}
