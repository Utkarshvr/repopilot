import type { ImpactSeverity } from "@/types";
import { cn } from "@/lib/utils";

const styles: Record<ImpactSeverity, string> = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
};

export function ImpactSeverityBadge({
  severity,
  className,
}: {
  severity: ImpactSeverity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        styles[severity],
        className,
      )}
    >
      {severity}
    </span>
  );
}
