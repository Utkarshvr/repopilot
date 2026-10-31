import type { FileAnalysisOutcome, FileAnalysisReason, MetadataFileOutcome } from "@/types/analysis";

const REASON_LABELS: Record<FileAnalysisReason, string> = {
  "unsupported-extension": "Unsupported extension",
  "generated-file": "Generated file",
  "binary-file": "Binary file",
  "ignored-directory": "Ignored directory",
  "file-too-large": "File exceeds size limit",
  "maximum-analysis-limit": "Maximum analysis limit reached",
  "fetch-failed": "Fetch failed",
  "parse-failed": "Parsing failed",
  "metadata-file": "Project metadata (handled separately)",
  "documentation-file": "Documentation (not parsed)",
  "other-file": "Other unsupported file",
};

export function FilesNotAnalyzed({ outcomes = [], metadataOutcomes = [] }: { outcomes?: FileAnalysisOutcome[]; metadataOutcomes?: MetadataFileOutcome[] }) {
  const notAnalyzed = outcomes.filter((outcome) => outcome.status !== "parsed" && outcome.reason !== "metadata-file");
  const partiallyOrUnprocessedMetadata = metadataOutcomes.filter((outcome) => outcome.status !== "fully-parsed");
  const total = notAnalyzed.length + partiallyOrUnprocessedMetadata.length;
  if (total === 0) return null;

  return (
    <details className="rounded-xl border border-white/[0.08] bg-[#101014]">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-zinc-200">
        Files not fully analyzed <span className="ml-2 text-xs font-normal text-zinc-500">({total})</span>
      </summary>
      <div className="max-h-80 overflow-y-auto border-t border-white/[0.06]">
        <ul className="divide-y divide-white/[0.04]">
          {notAnalyzed.map((outcome) => (
            <li key={outcome.path} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
              <code className="min-w-0 break-all text-[11px] text-zinc-300">{outcome.path}</code>
              <span className="shrink-0 rounded border border-amber-500/20 bg-amber-500/[0.06] px-2 py-0.5 text-[10px] text-amber-300">
                {outcome.reason ? REASON_LABELS[outcome.reason] : outcome.status}
              </span>
              {outcome.detail && <p className="w-full break-words text-[10px] leading-4 text-zinc-500">{outcome.detail}</p>}
            </li>
          ))}
          {partiallyOrUnprocessedMetadata.map((outcome) => (
            <li key={`metadata:${outcome.path}`} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
              <code className="min-w-0 break-all text-[11px] text-zinc-300">{outcome.path}</code>
              <span className="shrink-0 rounded border border-sky-500/20 bg-sky-500/[0.06] px-2 py-0.5 text-[10px] text-sky-300">
                {outcome.status === "partially-inspected" ? "Partially inspected" : outcome.status === "failed" ? "Metadata processing failed" : "Metadata not processed"}
              </span>
              <p className="w-full break-words text-[10px] leading-4 text-zinc-500">{outcome.detail ?? "Metadata processing did not fully parse this file."}</p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
