import type { AnalysisLimits, FileAnalysisOutcome, FileAnalysisReason, RepoTreeEntry } from "@/types/analysis";
import type { FileClassification } from "@/types/analysis";

export const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
]);

const IGNORED_DIR_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "build",
  ".next",
  ".git",
  "coverage",
  "vendor",
  "out",
  ".turbo",
  ".cache",
  ".vercel",
  ".output",
  "storybook-static",
  "__snapshots__",
  "generated",
  ".storybook",
]);
const GENERATED_DIR_SEGMENTS = new Set([
  "dist", "build", ".next", "coverage", "out", ".turbo", ".cache",
  ".output", "storybook-static", "__snapshots__", "generated",
]);

const IGNORED_FILE_NAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "composer.lock",
  ".ds_store",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".svg",
  ".bmp",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".mp3",
  ".mp4",
  ".webm",
  ".wasm",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
]);

export function getExtension(path: string): string {
  const base = path.split("/").pop() ?? path;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  return base.slice(dot).toLowerCase();
}

export function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

export function isIgnoredPath(path: string): boolean {
  const segments = path.toLowerCase().split("/");
  for (const segment of segments) {
    if (IGNORED_DIR_SEGMENTS.has(segment)) return true;
    if (segment.startsWith(".") && segment !== "." && segment !== "..") {
      // allow files like `.eslintrc.js` at root-ish, but skip hidden dirs
      if (!segment.includes(".") || segment.lastIndexOf(".") === 0) {
        // `.git`, `.next` already covered; skip other hidden directories
        if (!SOURCE_EXTENSIONS.has(getExtension(segment)) && !segment.includes(".")) {
          return true;
        }
      }
    }
  }

  const name = getFileName(path).toLowerCase();
  if (IGNORED_FILE_NAMES.has(name)) return true;

  const ext = getExtension(path);
  if (BINARY_EXTENSIONS.has(ext)) return true;

  // declaration files / generated noise
  if (name.endsWith(".d.ts") || name.endsWith(".min.js") || name.endsWith(".min.css") || name.includes(".generated.") || name.endsWith(".gen.ts") || name.endsWith(".gen.js")) {
    return true;
  }

  return false;
}

export function classifyFilePath(path: string): FileAnalysisReason | null {
  const ext = getExtension(path);
  if (BINARY_EXTENSIONS.has(ext)) return "binary-file";

  const lowerPath = path.toLowerCase();
  const segments = lowerPath.split("/");
  if (segments.some((segment) => GENERATED_DIR_SEGMENTS.has(segment))) return "generated-file";
  if (segments.some((segment) => IGNORED_DIR_SEGMENTS.has(segment))) return "ignored-directory";

  const name = getFileName(path).toLowerCase();
  if (
    name.endsWith(".d.ts") || /\.(?:min|gen|generated)\.(?:js|jsx|mjs|cjs|ts|tsx)$/.test(name)
  ) return "generated-file";

  if (segments.slice(0, -1).some((segment) => segment.startsWith("."))) return "ignored-directory";

  if (!SOURCE_EXTENSIONS.has(ext)) return "unsupported-extension";
  return null;
}

const METADATA_FILE_NAMES = new Set([
  "package.json", "package-lock.json", "tsconfig.json", "jsconfig.json",
  "pnpm-lock.yaml", "yarn.lock", "bun.lock", "bun.lockb",
]);
const DOCUMENTATION_EXTENSIONS = new Set([".md", ".mdx", ".rst", ".adoc"]);

export function classifyRepositoryFile(path: string): FileClassification {
  const name = getFileName(path).toLowerCase();
  const parentSegments = path.toLowerCase().split("/").slice(0, -1);
  const insideIgnoredContainer = parentSegments.some((segment) =>
    IGNORED_DIR_SEGMENTS.has(segment) || segment.startsWith("."),
  );
  if (
    METADATA_FILE_NAMES.has(name) ||
    /^(?:tsconfig|jsconfig)\..+\.json$/.test(name)
  ) return insideIgnoredContainer ? "other" : "metadata";
  const ext = getExtension(path);
  if (DOCUMENTATION_EXTENSIONS.has(ext) || parentSegments.includes("docs")) return "documentation";
  if (SOURCE_EXTENSIONS.has(ext)) return "source";
  return "other";
}

export function isAnalyzableSourceFile(path: string): boolean {
  if (isIgnoredPath(path)) return false;
  return SOURCE_EXTENSIONS.has(getExtension(path));
}

export interface FilteredTreeResult {
  selected: RepoTreeEntry[];
  eligible: RepoTreeEntry[];
  outcomes: FileAnalysisOutcome[];
  skippedForSize: number;
  skippedForLimit: number;
  excluded: number;
  unsupported: number;
  generated: number;
  binary: number;
  hitFileLimit: boolean;
}

/**
 * Filter tree blobs to analyzable JS/TS sources within size/count limits.
 */
export function filterSourceFiles(
  entries: RepoTreeEntry[],
  limits: AnalysisLimits,
): FilteredTreeResult {
  const outcomes: FileAnalysisOutcome[] = [];
  const eligible: RepoTreeEntry[] = [];
  let unsupported = 0;
  let generated = 0;
  let binary = 0;

  for (const entry of entries) {
    const classification = classifyRepositoryFile(entry.path);
    if (classification !== "source") {
      const reason: FileAnalysisReason = classification === "metadata"
        ? "metadata-file"
        : classification === "documentation"
          ? "documentation-file"
          : classifyFilePath(entry.path) === "binary-file"
            ? "binary-file"
            : "other-file";
      if (classification === "other" && reason === "other-file") unsupported++;
      else if (reason === "binary-file") binary++;
      outcomes.push({ path: entry.path, status: "not-analyzed", reason });
      continue;
    }
    const reason = classifyFilePath(entry.path);
    if (!reason) {
      eligible.push(entry);
      continue;
    }
    if (reason === "unsupported-extension") unsupported++;
    else if (reason === "generated-file") generated++;
    else if (reason === "binary-file") binary++;
    outcomes.push({ path: entry.path, status: "excluded", reason });
  }

  const withinSize: RepoTreeEntry[] = [];
  let skippedForSize = 0;
  for (const entry of eligible) {
    if (entry.size > limits.maxFileBytes) {
      skippedForSize++;
      outcomes.push({ path: entry.path, status: "skipped", reason: "file-too-large" });
    } else withinSize.push(entry);
  }

  // A configured cap is the only condition that selects a subset by path.
  // Sorting is deterministic so repeated analyses choose the same files.
  const ranked = [...withinSize].sort((a, b) => a.path.localeCompare(b.path));
  const selectedCount = limits.maxSourceFiles == null
    ? ranked.length
    : Math.max(0, Math.floor(limits.maxSourceFiles));
  const selected = ranked.slice(0, selectedCount);
  const selectedPaths = new Set(selected.map((entry) => entry.path));
  let skippedForLimit = 0;
  for (const entry of ranked) {
    if (!selectedPaths.has(entry.path)) {
      skippedForLimit++;
      outcomes.push({ path: entry.path, status: "skipped", reason: "maximum-analysis-limit" });
    }
  }

  return {
    selected,
    eligible,
    outcomes,
    skippedForSize,
    skippedForLimit,
    excluded: outcomes.filter((outcome) => outcome.status === "excluded" || outcome.status === "not-analyzed").length,
    unsupported,
    generated,
    binary,
    hitFileLimit: skippedForLimit > 0,
  };
}

export function isConfigPath(path: string): boolean {
  const name = getFileName(path).toLowerCase();
  return (
    name === "tsconfig.json" || name === "jsconfig.json" ||
    /^(?:tsconfig|jsconfig)\..+\.json$/.test(name)
  );
}

