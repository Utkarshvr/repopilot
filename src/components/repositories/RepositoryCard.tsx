import { GitBranch, Star } from "lucide-react";
import type { Repository } from "@/types";
import { MockBadge } from "@/components/shared/MockBadge";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

const statusStyles: Record<Repository["status"], string> = {
  indexed: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  indexing: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  pending: "text-zinc-400 border-white/10 bg-white/[0.03]",
  error: "text-red-400 border-red-500/30 bg-red-500/10",
};

export function RepositoryCard({ repository }: { repository: Repository }) {
  const selectedRepositoryId = useAppStore((s) => s.selectedRepositoryId);
  const setSelectedRepositoryId = useAppStore((s) => s.setSelectedRepositoryId);
  const selected = selectedRepositoryId === repository.id;

  return (
    <button
      type="button"
      onClick={() => setSelectedRepositoryId(repository.id)}
      className={cn(
        "w-full rounded-xl border p-5 text-left transition",
        selected
          ? "border-indigo-500/40 bg-indigo-500/[0.06]"
          : "border-white/[0.07] bg-[#101014] hover:border-white/[0.12]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-white/[0.05] p-2.5">
            <GitBranch size={18} className="text-zinc-300" />
          </div>
          <div>
            <p className="text-sm font-medium text-zinc-100">{repository.name}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{repository.fullName}</p>
          </div>
        </div>
        <MockBadge provenance={repository.provenance} />
      </div>

      <p className="mt-4 line-clamp-2 text-xs leading-5 text-zinc-500">
        {repository.description}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
        <span className="rounded border border-white/10 px-2 py-0.5">
          {repository.language}
        </span>
        <span className="rounded border border-white/10 px-2 py-0.5">
          {repository.fileCount} files
        </span>
        <span className="rounded border border-white/10 px-2 py-0.5">
          {repository.dependencyCount} deps
        </span>
        <span className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-0.5">
          <Star size={11} />
          {repository.stars}
        </span>
        <span
          className={cn(
            "rounded border px-2 py-0.5 capitalize",
            statusStyles[repository.status],
          )}
        >
          {repository.status}
        </span>
      </div>
    </button>
  );
}
