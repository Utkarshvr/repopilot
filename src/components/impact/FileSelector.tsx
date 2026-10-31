import type { SourceFile } from "@/types";
import { cn } from "@/lib/utils";

export function FileSelector({
  files,
  selectedFileId,
  onSelect,
  isReal = false,
}: {
  files: SourceFile[];
  selectedFileId: string | null;
  onSelect: (id: string) => void;
  isReal?: boolean;
}) {
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#101014]">
      <div className="border-b border-white/[0.07] px-4 py-3">
        <p className="text-xs font-medium text-zinc-300">Select a file</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          {isReal
            ? "Impact is computed from the real dependency graph."
            : "Connect a repository to calculate impact from its dependency graph."}
        </p>
        <p className="mt-1 text-[10px] text-zinc-600">
          {files.length} file{files.length !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="max-h-[480px] overflow-y-auto p-2">
        {sorted.length === 0 ? (
          <p className="py-6 text-center text-xs text-zinc-600">No files found</p>
        ) : (
          sorted.map((file) => {
            const active = file.id === selectedFileId;
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => onSelect(file.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition",
                  active
                    ? "bg-indigo-500/10 text-indigo-200"
                    : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    active ? "bg-indigo-400" : "bg-zinc-600",
                  )}
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium">
                    {file.name}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10px] text-zinc-500">
                    {file.path}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
