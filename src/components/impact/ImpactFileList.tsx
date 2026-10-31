import type { AffectedFile } from "@/types";
import { cn } from "@/lib/utils";

export function ImpactFileList({
  title,
  description,
  files,
  variant,
}: {
  title: string;
  description: string;
  files: AffectedFile[];
  variant: "direct" | "transitive";
}) {
  return (
    <section className="rounded-xl border border-white/[0.07] bg-[#101014]">
      <div className="border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              variant === "direct" ? "bg-amber-400" : "bg-zinc-500",
            )}
          />
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] tabular-nums text-zinc-500">
            {files.length}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">{description}</p>
      </div>

      {files.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-zinc-600">
          No {variant} dependents found.
        </p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {files.map((file) => (
            <li key={file.fileId} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {file.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
                    {file.path}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500">
                    depth {file.depth}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-zinc-500">{file.reason}</p>
              <p className="mt-1 truncate font-mono text-[10px] text-zinc-600">
                Path: {file.dependencyPath.join(" → ")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
