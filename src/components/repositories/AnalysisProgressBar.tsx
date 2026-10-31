import type { AnalysisProgress, AnalysisStage } from "@/types/analysis";
import { CheckCircle2, XCircle, Loader2, Ban } from "lucide-react";
import { FilesNotAnalyzed } from "./FilesNotAnalyzed";

const STAGE_LABELS: Record<AnalysisStage, string> = {
  idle: "Idle",
  validating: "Validating URL",
  "fetching-metadata": "Fetching metadata",
  "fetching-tree": "Fetching file tree",
  metadata: "Analyzing project metadata",
  "fetching-contents": "Downloading files",
  parsing: "Parsing imports",
  resolving: "Resolving dependencies",
  "building-graph": "Building graph",
  complete: "Complete",
  error: "Error",
  cancelled: "Cancelled",
};

const STAGE_ORDER: AnalysisStage[] = [
  "validating",
  "fetching-metadata",
  "fetching-tree",
  "metadata",
  "fetching-contents",
  "parsing",
  "resolving",
  "building-graph",
  "complete",
];

function stageProgress(stage: AnalysisStage): number {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx === -1) return 0;
  return Math.round((idx / (STAGE_ORDER.length - 1)) * 100);
}

export function AnalysisProgressBar({
  progress,
  onCancel,
  isAnalyzing,
}: {
  progress: AnalysisProgress;
  onCancel: () => void;
  isAnalyzing: boolean;
}) {
  const pct = stageProgress(progress.stage);
  const isError = progress.stage === "error";
  const isComplete = progress.stage === "complete";
  const isCancelled = progress.stage === "cancelled";

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#101014] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          ) : isError ? (
            <XCircle size={16} className="text-red-400 shrink-0" />
          ) : isCancelled ? (
            <Ban size={16} className="text-zinc-400 shrink-0" />
          ) : (
            <Loader2 size={16} className="text-indigo-400 shrink-0 animate-spin" />
          )}
          <span className="text-sm font-medium text-zinc-200">
            {STAGE_LABELS[progress.stage]}
          </span>
        </div>
        {isAnalyzing && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition border border-white/10 rounded-md px-2.5 py-1"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isError
              ? "bg-red-500"
              : isComplete
                ? "bg-emerald-500"
                : "bg-indigo-500"
          }`}
          style={{ width: `${isError || isCancelled ? 100 : pct}%` }}
        />
      </div>

      {/* Message */}
      <p className="text-xs text-zinc-500">{progress.message}</p>

      {/* Stats */}
      {(progress.filesDiscovered > 0 || progress.filesFetched > 0) && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatChip label="Eligible source files" value={progress.eligibleSourceFiles} title="Supported JavaScript and TypeScript files before size and maximum-file exclusions." />
            <StatChip label="Selected for analysis" value={progress.filesSelected} title="Eligible files that passed configured safety limits and were queued for content fetching." />
            <StatChip label="Successfully fetched" value={progress.filesFetched} title="Selected files whose content request returned successfully." />
            <StatChip label="Successfully parsed" value={progress.filesParsed} title="Fetched files parsed without TypeScript syntax diagnostics." />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatChip label="Excluded files" value={progress.excludedFiles} title="Files outside the eligible source set, such as unsupported, generated, binary, or ignored-directory files." />
            <StatChip label="Skipped files" value={progress.skippedFiles} title="Eligible files left out because they exceeded the per-file size or configured maximum-file limit." />
            <StatChip label="Failed downloads" value={progress.failedDownloads} color="amber" title="Selected files whose content could not be fetched." />
            <StatChip label="Failed parsing" value={progress.failedParsing} color="amber" title="Fetched files with TypeScript parser diagnostics." />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatChip label="Unsupported files" value={progress.unsupportedFiles} title="Files with extensions outside the supported JS and TS set." />
            <StatChip label="Generated files" value={progress.generatedFiles} title="Files or directories classified as generated output." />
            <StatChip label="Binary files" value={progress.binaryFiles} title="Files with known binary extensions." />
            <StatChip label="Files exceeding size limit" value={progress.filesTooLarge} color="amber" title="Eligible files over the configured per-file byte limit." />
          </div>
        </>
      )}

      {progress.importsExtracted > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatChip label="Imports found" value={progress.importsExtracted} />
          <StatChip label="Resolved" value={progress.resolvedImports} color="emerald" />
          <StatChip label="External" value={progress.externalImports} color="sky" />
          <StatChip label="Unresolved" value={progress.unresolvedImports} color="amber" />
        </div>
      )}

      {progress.metadataFilesDiscovered > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <StatChip label="Metadata files discovered" value={progress.metadataFilesDiscovered} title="Recognized package manifests, JS/TS configs, and lockfiles." />
          <StatChip label="Fully parsed" value={progress.metadataOutcomes.filter((item) => item.status === "fully-parsed").length} color="emerald" title="Package manifests and JS/TS configuration files parsed successfully." />
          <StatChip label="Partially inspected" value={progress.metadataOutcomes.filter((item) => item.status === "partially-inspected").length} title="Lockfile name identified a package manager; lockfile contents were not parsed." />
          <StatChip label="Failed" value={progress.metadataOutcomes.filter((item) => item.status === "failed").length} color="amber" title="Metadata fetch or parsing failed." />
          <StatChip label="Not processed" value={progress.metadataOutcomes.filter((item) => item.status === "not-processed").length} title="Metadata was not processed, for example because it exceeded the size limit." />
        </div>
      )}

      {/* Errors */}
      {progress.failedDownloads + progress.failedParsing > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.05] px-3 py-2">
          <p className="text-[11px] text-red-400">
            {progress.failedDownloads + progress.failedParsing} file(s) failed to fetch or parse.
          </p>
        </div>
      )}

      {/* Truncation warning */}
      {progress.truncatedTree && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2">
          <p className="text-[11px] text-amber-400">
            GitHub returned a truncated file tree. Some files may be missing.
          </p>
        </div>
      )}
      {progress.maximumLimitFiles > 0 && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] px-3 py-2 text-[11px] text-amber-300">
          Maximum-file limit reached: {progress.maximumLimitFiles} eligible file(s) were not selected.
        </p>
      )}
      <FilesNotAnalyzed outcomes={progress.fileOutcomes} metadataOutcomes={progress.metadataOutcomes} />
    </div>
  );
}

function StatChip({
  label,
  value,
  color = "zinc",
  title,
}: {
  label: string;
  value: number;
  color?: "zinc" | "emerald" | "sky" | "amber";
  title?: string;
}) {
  const textColors = {
    zinc: "text-zinc-200",
    emerald: "text-emerald-400",
    sky: "text-sky-400",
    amber: "text-amber-400",
  };

  return (
    <div title={title} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-center">
      <p className="text-[10px] text-zinc-500">{label}</p>
      <p className={`mt-1 text-sm font-semibold tabular-nums ${textColors[color]}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
