import type { RepositoryGraphSnapshot } from "@/types/analysis";
import type { ParsedGitHubUrl } from "@/types/analysis";
import { runAnalysisPipeline, type ProgressCallback } from "./repositoryService";
import { DEFAULT_ANALYSIS_LIMITS, type AnalysisLimits } from "@/types/analysis";

const inFlightSnapshots = new Map<string, Promise<RepositoryGraphSnapshot>>();

export function revisionSnapshotId(repositoryId: string, commitSha: string): string {
  return `${repositoryId}@${commitSha.toLowerCase()}`;
}

export function createRepositoryGraphSnapshot(
  analyzed: Awaited<ReturnType<typeof runAnalysisPipeline>>["analyzed"],
  parsed: ParsedGitHubUrl,
  commitSha: string,
  ref: string,
): RepositoryGraphSnapshot {
  const normalizedSha = commitSha.toLowerCase();
  if (!/^[0-9a-f]{40,64}$/.test(normalizedSha)) throw new Error("A full immutable commit SHA is required to create a revision snapshot.");
  const limitations: string[] = [];
  if (analyzed.stats.truncatedTree) limitations.push("GitHub truncated the recursive tree response; some repository paths may be absent.");
  if (analyzed.stats.filesSkipped) limitations.push(`${analyzed.stats.filesSkipped} eligible source file(s) were skipped by safety limits.`);
  if (analyzed.stats.failedDownloads) limitations.push(`${analyzed.stats.failedDownloads} source file download(s) failed.`);
  if (analyzed.stats.failedParsing) limitations.push(`${analyzed.stats.failedParsing} source file(s) failed parsing.`);
  if (analyzed.stats.unresolved) limitations.push(`${analyzed.stats.unresolved} import(s) could not be resolved.`);
  const metadataUnavailable = analyzed.projectMetadata?.outcomes?.filter((outcome) => outcome.status === "failed" || outcome.status === "not-processed") ?? [];
  if (metadataUnavailable.length) limitations.push(`${metadataUnavailable.length} metadata/configuration file(s) could not be fully processed; import resolution may be incomplete.`);
  return {
    id: revisionSnapshotId(analyzed.id, normalizedSha),
    repositoryId: analyzed.id,
    repositoryFullName: analyzed.metadata.fullName,
    owner: parsed.owner,
    repo: parsed.repo,
    commitSha: normalizedSha,
    ref,
    treeSha: analyzed.graph.revision?.treeSha ?? "",
    analyzedAt: analyzed.analyzedAt,
    stats: analyzed.stats,
    fileOutcomes: analyzed.fileOutcomes,
    fileClassifications: analyzed.projectMetadata?.fileClassifications ?? [],
    graph: { ...analyzed.graph, positions: {} },
    externalPackages: analyzed.externalPackages,
    unresolvedImports: analyzed.unresolvedImports,
    projectMetadata: analyzed.projectMetadata ?? null,
    complete: limitations.length === 0,
    limitations,
    parserMetadata: { name: "typescript-compiler-api", cacheVersion: 1 },
  };
}

export async function buildRepositoryGraphSnapshot(
  parsed: ParsedGitHubUrl,
  commitSha: string,
  ref: string,
  onProgress: ProgressCallback = () => {},
  signal?: AbortSignal,
  limits: AnalysisLimits = DEFAULT_ANALYSIS_LIMITS,
): Promise<RepositoryGraphSnapshot> {
  const normalizedSha = commitSha.toLowerCase();
  if (!/^[0-9a-f]{40,64}$/.test(normalizedSha)) throw new Error("A full immutable commit SHA is required to analyze a revision.");
  const createSnapshot = () => runAnalysisPipeline(parsed, limits, onProgress, signal, { ref, commitSha: normalizedSha })
    .then((result) => createRepositoryGraphSnapshot(result.analyzed, parsed, normalizedSha, ref));
  // A shared request cannot safely inherit one caller's cancellation signal.
  // Keep coalescing for non-cancellable callers; UI requests keep independent
  // abort lifecycles so leaving or switching the comparison can stop its work.
  if (signal) return createSnapshot();
  const key = revisionSnapshotId(`github:${parsed.owner}/${parsed.repo}`, normalizedSha);
  const existing = inFlightSnapshots.get(key);
  if (existing) return existing;
  const pending = createSnapshot().finally(() => inFlightSnapshots.delete(key));
  inFlightSnapshots.set(key, pending);
  return pending;
}
