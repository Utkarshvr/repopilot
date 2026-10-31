import type { FileClassification } from "./analysis";

export type ChangeSource = "manual" | "github-comparison";
export type ChangedFileStatus = "added" | "modified" | "removed" | "renamed" | "copied" | "selected" | "other";

export interface ChangedFile {
  /** New/current path, or the removed path for deletions. */
  path: string;
  /** Old path retained for renames (and GitHub-provided previous names). */
  previousPath: string | null;
  status: ChangedFileStatus;
  rawStatus?: string;
  additions: number | null;
  deletions: number | null;
  changes: number | null;
  patch: string | null;
  patchAvailable: boolean;
  /** Extension-based best effort. Null means GitHub did not provide enough to know. */
  isBinary: boolean | null;
  classification: FileClassification;
  isInAnalyzedGraph: boolean;
  analysisEligible: boolean;
  ineligibilityReason: "not-in-graph" | "unsupported-file-type" | null;
  selectedForImpact: boolean;
}

export interface ChangeSet {
  id: string;
  repositoryId: string;
  repositoryFullName: string;
  source: ChangeSource;
  baseRevision: string | null;
  headRevision: string | null;
  baseSha: string | null;
  headSha: string | null;
  baseTreeSha: string | null;
  headTreeSha: string | null;
  baseSnapshotReused?: boolean | null;
  headSnapshotReused?: boolean | null;
  baseSnapshotError?: string | null;
  headSnapshotError?: string | null;
  totalCommits: number | null;
  files: ChangedFile[];
  isComplete: boolean;
  completenessWarning: string | null;
  createdAt: string;
}

export interface GitHubComparedFile {
  filename: string;
  previous_filename?: string;
  status: string;
  additions?: number;
  deletions?: number;
  changes?: number;
  patch?: string;
}

export interface GitHubCompareResult {
  baseSha: string | null;
  headSha: string | null;
  baseTreeSha: string | null;
  headTreeSha: string | null;
  totalCommits: number | null;
  files: GitHubComparedFile[];
  isComplete: boolean;
  completenessWarning: string | null;
}

export interface ChangeSetSummary {
  total: number;
  added: number;
  modified: number;
  removed: number;
  renamed: number;
  copied: number;
  other: number;
  selected: number;
  eligible: number;
  outsideGraph: number;
}

export function summarizeChangeSet(files: ChangedFile[]): ChangeSetSummary {
  return {
    total: files.length,
    added: files.filter((file) => file.status === "added").length,
    modified: files.filter((file) => file.status === "modified").length,
    removed: files.filter((file) => file.status === "removed").length,
    renamed: files.filter((file) => file.status === "renamed").length,
    copied: files.filter((file) => file.status === "copied").length,
    other: files.filter((file) => file.status === "other").length,
    selected: files.filter((file) => file.selectedForImpact).length,
    eligible: files.filter((file) => file.analysisEligible).length,
    outsideGraph: files.filter((file) => !file.isInAnalyzedGraph).length,
  };
}

export function serializeChangeSet(changeSet: ChangeSet): string {
  return JSON.stringify(changeSet);
}

export function deserializeChangeSet(serialized: string): ChangeSet | null {
  try {
    const value: unknown = JSON.parse(serialized);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<ChangeSet>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.repositoryId !== "string" ||
      typeof candidate.repositoryFullName !== "string" ||
      (candidate.source !== "manual" && candidate.source !== "github-comparison") ||
      !Array.isArray(candidate.files) ||
      typeof candidate.isComplete !== "boolean" ||
      typeof candidate.createdAt !== "string"
    ) return null;
    return candidate as ChangeSet;
  } catch {
    return null;
  }
}
