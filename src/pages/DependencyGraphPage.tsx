import DependencyGraph from "@/components/graph/DependencyGraph";
import { MockBadge } from "@/components/shared/MockBadge";
import { repoPilotGraph } from "@/data/mockDependencyGraph";

export default function DependencyGraphPage() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <section>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Dependency Graph
          </h1>
          <MockBadge provenance={repoPilotGraph.provenance} />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-zinc-500">
          Interactive visualization of import relationships across the RepoPilot
          frontend. Select a file to highlight direct dependencies and
          dependents; click the canvas to clear.
        </p>
      </section>

      <DependencyGraph heightClass="h-[min(72vh,720px)]" />
    </div>
  );
}
