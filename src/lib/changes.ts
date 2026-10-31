import type { AnalyzedRepository } from "@/types/analysis";
import type { ChangeSet, ChangedFile, ChangedFileStatus, GitHubCompareResult, GitHubComparedFile } from "@/types/changes";
import { classifyFilePath, classifyRepositoryFile, getExtension } from "@/lib/analysis/fileFilter";

const SHA_PATTERN = /^[0-9a-fA-F]{7,40}$/;
const FORBIDDEN_REF_CHARS = "~^:?*[\\";

export function validateGitHubRevision(value: string): string | null {
  const ref = value.trim();
  if (!ref) return "Enter a branch name or commit SHA.";
  if (ref === "@") return "Enter a valid branch name or commit SHA.";
  if (ref.length > 255) return "Revision references must be 255 characters or fewer.";
  if (/[\u0000-\u0020\u007f]/.test(ref)) return "Revision references cannot contain whitespace or control characters.";
  if (ref.startsWith("/") || ref.endsWith("/") || ref.includes("//") || ref.includes("..") || ref.includes("@{")) {
    return "Enter a valid branch name or commit SHA.";
  }
  if ([...ref].some((character) => FORBIDDEN_REF_CHARS.includes(character))) return "Enter a valid branch name or commit SHA.";
  const segments = ref.split("/");
  if (segments.some((segment) => !segment || segment.startsWith(".") || segment.endsWith(".") || segment.endsWith(".lock"))) {
    return "Enter a valid branch name or commit SHA.";
  }
  if (SHA_PATTERN.test(ref)) return null;
  return null;
}

function normalizeStatus(status: string): { status: ChangedFileStatus; rawStatus?: string } {
  switch (status.toLowerCase()) {
    case "added": return { status: "added" };
    case "modified": return { status: "modified" };
    case "removed": return { status: "removed" };
    case "renamed": return { status: "renamed" };
    case "copied": return { status: "copied" };
    default: return { status: "other", rawStatus: status };
  }
}

function makeChangedFile(
  file: GitHubComparedFile,
  graphPaths: Set<string>,
): ChangedFile {
  const path = file.filename;
  const previousPath = file.previous_filename ?? null;
  const status = normalizeStatus(file.status);
  const classification = classifyRepositoryFile(path);
  const graphPath = [path, previousPath].find((candidate) => candidate != null && graphPaths.has(candidate));
  const isInAnalyzedGraph = graphPath != null;
  const analysisEligible = classification === "source" && isInAnalyzedGraph;
  const extension = getExtension(path) || (previousPath ? getExtension(previousPath) : "");
  const binary = classifyFilePath(path) === "binary-file" || (previousPath != null && classifyFilePath(previousPath) === "binary-file");

  return {
    path,
    previousPath,
    status: status.status,
    rawStatus: status.rawStatus,
    additions: Number.isFinite(file.additions) ? file.additions! : null,
    deletions: Number.isFinite(file.deletions) ? file.deletions! : null,
    changes: Number.isFinite(file.changes) ? file.changes! : null,
    patch: typeof file.patch === "string" ? file.patch : null,
    patchAvailable: typeof file.patch === "string",
    isBinary: binary ? true : extension ? false : null,
    classification,
    isInAnalyzedGraph,
    analysisEligible,
    ineligibilityReason: analysisEligible ? null : classification !== "source" ? "unsupported-file-type" : "not-in-graph",
    selectedForImpact: analysisEligible,
  };
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `change-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createGitHubChangeSet(
  analyzed: AnalyzedRepository,
  baseRevision: string,
  headRevision: string,
  result: GitHubCompareResult,
  id = newId(),
  createdAt = new Date().toISOString(),
): ChangeSet {
  const graphPaths = new Set(analyzed.graph.files.map((file) => file.path));
  const files = result.files.map((file) => makeChangedFile(file, graphPaths))
    .sort((a, b) => a.path.localeCompare(b.path) || (a.previousPath ?? "").localeCompare(b.previousPath ?? ""));
  return {
    id,
    repositoryId: analyzed.id,
    repositoryFullName: analyzed.metadata.fullName,
    source: "github-comparison",
    baseRevision,
    headRevision,
    baseSha: result.baseSha,
    headSha: result.headSha,
    baseTreeSha: result.baseTreeSha,
    headTreeSha: result.headTreeSha,
    totalCommits: result.totalCommits,
    files,
    isComplete: result.isComplete,
    completenessWarning: result.completenessWarning,
    createdAt,
  };
}

export function createManualChangeSet(
  analyzed: AnalyzedRepository,
  selectedPaths: string[],
  id = newId(),
  createdAt = new Date().toISOString(),
): ChangeSet {
  const selected = new Set(selectedPaths);
  const files: ChangedFile[] = analyzed.graph.files
    .filter((file) => selected.has(file.path))
    .map((file) => ({
      path: file.path,
      previousPath: null,
      status: "selected" as const,
      additions: null,
      deletions: null,
      changes: null,
      patch: null,
      patchAvailable: false,
      isBinary: false,
      classification: "source" as const,
      isInAnalyzedGraph: true,
      analysisEligible: true,
      ineligibilityReason: null,
      selectedForImpact: true,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return {
    id,
    repositoryId: analyzed.id,
    repositoryFullName: analyzed.metadata.fullName,
    source: "manual",
    baseRevision: null,
    headRevision: analyzed.graph.revision?.ref ?? analyzed.branch,
    baseSha: null,
    headSha: analyzed.graph.revision?.commitSha ?? null,
    baseTreeSha: null,
    headTreeSha: analyzed.graph.revision?.treeSha ?? null,
    totalCommits: null,
    files,
    isComplete: true,
    completenessWarning: null,
    createdAt,
  };
}

export function toggleFileSelection(selected: Set<string>, path: string): Set<string> {
  const next = new Set(selected);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  return next;
}

export function clearFileSelection(): Set<string> {
  return new Set();
}
