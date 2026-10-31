import { GitBranch, Star, Trash2, CheckCircle2, BarChart2 } from "lucide-react";
import type { AnalyzedRepository } from "@/types/analysis";
import { useRepositoryStore } from "@/store/repositoryStore";
import { cn } from "@/lib/utils";
import { FilesNotAnalyzed } from "./FilesNotAnalyzed";
import { ProjectMetadataPanel } from "./ProjectMetadataPanel";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export function AnalyzedRepositoryCard({
  analyzed,
}: {
  analyzed: AnalyzedRepository;
}) {
  const activeRepositoryId = useRepositoryStore((s) => s.activeRepositoryId);
  const setActiveRepository = useRepositoryStore((s) => s.setActiveRepository);
  const removeRepository = useRepositoryStore((s) => s.removeRepository);

  const isActive = activeRepositoryId === analyzed.id;
  const { metadata, stats, repository } = analyzed;

  return (
    <div
      className={cn(
        "rounded-xl border p-5 transition cursor-pointer",
        isActive
          ? "border-indigo-500/40 bg-indigo-500/[0.06]"
          : "border-white/[0.07] bg-[#101014] hover:border-white/[0.12]",
      )}
      onClick={() => setActiveRepository(analyzed.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="rounded-lg bg-white/[0.05] p-2.5 shrink-0">
            <GitBranch size={18} className="text-zinc-300" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100 truncate">{metadata.name}</p>
            <p className="mt-0.5 text-xs text-zinc-500 truncate">{metadata.fullName}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
            <CheckCircle2 size={10} />
            Analyzed
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeRepository(analyzed.id);
            }}
            className="rounded-md border border-white/10 p-1 text-zinc-600 hover:text-red-400 hover:border-red-500/30 transition"
            title="Remove repository"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {metadata.description && (
        <p className="mt-3 line-clamp-2 text-xs leading-5 text-zinc-500">
          {metadata.description}
        </p>
      )}

      {/* Stats row */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
        <span className="rounded border border-white/10 px-2 py-0.5">
          {metadata.language ?? "Unknown"}
        </span>
        <span className="rounded border border-white/10 px-2 py-0.5 capitalize">
          {metadata.visibility}
        </span>
        <span className="rounded border border-white/10 px-2 py-0.5">
          {stats.filesAnalyzed} files
        </span>
        <span className="rounded border border-white/10 px-2 py-0.5">
          {stats.edges} deps
        </span>
        <span className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-0.5">
          <Star size={11} />
          {metadata.stars.toLocaleString()}
        </span>
        <span className="rounded border border-white/10 px-2 py-0.5">
          {metadata.forks.toLocaleString()} forks
        </span>
        <span className="rounded border border-white/10 px-2 py-0.5">
          {formatRelative(analyzed.analyzedAt)} analyzed
        </span>
      </div>

      {/* Analysis stats mini-bar */}
      <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-3 gap-2">
        <MiniStat
          icon={<BarChart2 size={11} className="text-indigo-400" />}
          label="Imports"
          value={stats.importsExtracted.toLocaleString()}
        />
        <MiniStat
          label="Internal"
          value={stats.resolvedInternal.toLocaleString()}
          color="emerald"
        />
        <MiniStat
          label="Unresolved"
          value={stats.unresolved.toLocaleString()}
          color="amber"
        />
      </div>

      {typeof stats.eligibleSourceFiles === "number" ? (
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <OutcomeMetric label="Eligible source files" value={stats.eligibleSourceFiles} title="Supported source files before size and count exclusions." />
            <OutcomeMetric label="Selected for analysis" value={stats.filesSelected} title="Eligible files queued for source download." />
            <OutcomeMetric label="Successfully fetched" value={stats.filesFetched} title="Source files whose content request succeeded." />
            <OutcomeMetric label="Successfully parsed" value={stats.filesAnalyzed} title="Files parsed without syntax diagnostics." />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <OutcomeMetric label="Excluded files" value={stats.excludedFiles} title="Total files excluded before source analysis; reason counts below are included in this total." />
            <OutcomeMetric label="Skipped files" value={stats.filesSkipped} title="Eligible files skipped due to size or a configured file-count limit; reason counts below are included in this total." />
            <OutcomeMetric label="Failed downloads" value={stats.failedDownloads} />
            <OutcomeMetric label="Failed parsing" value={stats.failedParsing} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <OutcomeMetric label="Unsupported files" value={stats.unsupportedFiles} />
            <OutcomeMetric label="Generated files" value={stats.generatedFiles} />
            <OutcomeMetric label="Binary files" value={stats.binaryFiles} />
            <OutcomeMetric label="Over size limit" value={stats.filesTooLarge} />
          </div>
          {stats.maximumLimitFiles > 0 && (
            <p className="text-[10px] text-amber-300">Maximum analysis limit left {stats.maximumLimitFiles} eligible file(s) unselected.</p>
          )}
        </div>
      ) : null}

      {/* Branch & current */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-600">
        <span>branch: {repository.branch}</span>
        {isActive && (
          <span className="text-indigo-400 font-medium">Active workspace</span>
        )}
      </div>
      {analyzed.fileOutcomes ? (
        <div className="mt-3" onClick={(event) => event.stopPropagation()}>
          <FilesNotAnalyzed outcomes={analyzed.fileOutcomes} metadataOutcomes={analyzed.projectMetadata?.outcomes} />
        </div>
      ) : (
        <p className="mt-3 text-[10px] text-zinc-600">
          Detailed file outcomes are unavailable for this saved analysis. Re-analyze the repository to generate them.
        </p>
      )}
      <div className="mt-3" onClick={(event) => event.stopPropagation()}>
        <ProjectMetadataPanel metadata={analyzed.projectMetadata} />
      </div>
    </div>
  );
}

function OutcomeMetric({ label, value, title }: { label: string; value: number; title?: string }) {
  return (
    <div title={title} className="rounded border border-white/[0.05] bg-white/[0.02] px-2 py-1.5 text-center">
      <p className="text-[9px] text-zinc-500">{label}</p>
      <p className="mt-0.5 text-xs font-semibold tabular-nums text-zinc-200">{value.toLocaleString()}</p>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
  color = "zinc",
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  color?: "zinc" | "emerald" | "amber";
}) {
  const textColor = {
    zinc: "text-zinc-300",
    emerald: "text-emerald-400",
    amber: "text-amber-400",
  }[color];

  return (
    <div className="rounded border border-white/[0.05] bg-white/[0.02] px-2 py-1.5 text-center">
      <div className="flex items-center justify-center gap-1">
        {icon}
        <p className="text-[10px] text-zinc-500">{label}</p>
      </div>
      <p className={`mt-0.5 text-xs font-semibold tabular-nums ${textColor}`}>
        {value}
      </p>
    </div>
  );
}
