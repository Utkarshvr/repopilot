import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-[#101014]/60 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <Icon size={22} className="text-zinc-500" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-zinc-200">{title}</h3>
      <p className="mt-2 max-w-sm text-xs leading-5 text-zinc-500">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
