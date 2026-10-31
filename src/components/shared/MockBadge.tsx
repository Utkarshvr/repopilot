import { cn } from "@/lib/utils";
import type { DataProvenance } from "@/types";

const labels: Record<DataProvenance, string> = {
  mock: "Mock data",
  simulated: "Simulated",
  analyzed: "Analyzed",
};

const styles: Record<DataProvenance, string> = {
  mock: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  simulated: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  analyzed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
};

export function MockBadge({
  provenance = "mock",
  className,
}: {
  provenance?: DataProvenance;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        styles[provenance],
        className,
      )}
    >
      {labels[provenance]}
    </span>
  );
}
