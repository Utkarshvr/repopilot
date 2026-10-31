import type {
  DataProvenance,
  DependencyGraphData,
  Repository,
  RepositoryStatus,
} from "@/types";

export type ImportKind =
  | "static"
  | "export-named"
  | "export-star"
  | "dynamic"
  | "require"
  | "import-type";

export type ResolutionStatus = "resolved" | "external" | "unresolved";
export type FileClassification = "source" | "metadata" | "documentation" | "other";

export type AnalysisStage =
  | "idle"
  | "validating"
  | "fetching-metadata"
  | "fetching-tree"
  | "metadata"
  | "fetching-contents"
  | "parsing"
  | "resolving"
  | "building-graph"
  | "complete"
  | "error"
  | "cancelled";

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
  url: string;
}

export interface GitHubRepoMetadata {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  defaultBranch: string;
  language: string | null;
  stars: number;
  forks: number;
  updatedAt: string;
  private: boolean;
  visibility: string;
  htmlUrl: string;
}

export interface RepoTreeEntry {
  path: string;
  sha: string;
  size: number;
  type: "blob" | "tree";
}

export interface SourceFileContent {
  path: string;
  name: string;
  extension: string;
  content: string;
  sha: string;
  size: number;
}

export interface ExtractedImport {
  importingFile: string;
  specifier: string;
  kind: ImportKind;
  importedSymbols: string[];
  line: number;
  column: number;
  isTypeOnly: boolean;
}

export interface ResolvedImport extends ExtractedImport {
  status: ResolutionStatus;
  resolvedPath: string | null;
  packageName: string | null;
}

export interface TsconfigPathsConfig {
  baseUrl: string | null;
  paths: Record<string, string[]>;
}

export interface AnalysisLimits {
  /** null means analyze every eligible file */
  maxSourceFiles: number | null;
  maxFileBytes: number;
  contentConcurrency: number;
  parseBatchSize: number;
}

export type FileAnalysisStatus = "not-analyzed" | "excluded" | "skipped" | "failed-download" | "failed-parsing" | "parsed";
export type FileAnalysisReason =
  | "unsupported-extension"
  | "generated-file"
  | "binary-file"
  | "ignored-directory"
  | "file-too-large"
  | "maximum-analysis-limit"
  | "fetch-failed"
  | "parse-failed"
  | "metadata-file"
  | "documentation-file"
  | "other-file"
  ;

export interface FileAnalysisOutcome {
  path: string;
  status: FileAnalysisStatus;
  reason?: FileAnalysisReason;
  detail?: string;
}

export interface RepositoryFileClassification {
  path: string;
  classification: FileClassification;
}

export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun";

export interface PackageDependencyInfo {
  name: string;
  versionRange: string;
}

export interface PackageManifestAnalysis {
  path: string;
  name: string | null;
  version: string | null;
  description: string | null;
  entryPoints: {
    main: string | null;
    module: string | null;
    browser: unknown;
    exports: unknown;
  };
  packageType: string | null;
  dependencies: PackageDependencyInfo[];
  devDependencies: PackageDependencyInfo[];
  peerDependencies: PackageDependencyInfo[];
  optionalDependencies: PackageDependencyInfo[];
  scripts: Record<string, string>;
  nodeEngine: string | null;
  declaredPackageManager: string | null;
}

export interface TypeScriptConfigAnalysis {
  path: string;
  extends: string | string[] | null;
  baseUrl: string | null;
  paths: Record<string, string[]>;
  target: string | null;
  module: string | null;
  moduleResolution: string | null;
  jsx: string | null;
  strict: boolean | null;
  allowJs: boolean | null;
  resolveJsonModule: boolean | null;
  include: string[] | null;
  exclude: string[] | null;
}

export interface MetadataFileOutcome {
  path: string;
  status: "fully-parsed" | "partially-inspected" | "failed" | "not-processed";
  failureType?: "fetch" | "parse";
  detail?: string;
}

export interface ProjectMetadataAnalysis {
  packageManifest: PackageManifestAnalysis | null;
  packageManifests: PackageManifestAnalysis[];
  packageManager: {
    declared: string | null;
    detected: PackageManagerName[];
    multipleLockfiles: boolean;
  };
  tsConfigs: TypeScriptConfigAnalysis[];
  fileClassifications: RepositoryFileClassification[];
  outcomes: MetadataFileOutcome[];
  stats: {
    metadataFilesDiscovered: number;
    metadataFilesFullyParsed: number;
    metadataFilesPartiallyInspected: number;
    metadataFilesFailed: number;
    metadataFilesNotProcessed: number;
    // Compatibility counters retained for existing callers and saved data.
    metadataFilesParsed: number;
    metadataParsingFailures: number;
    metadataFetchFailures: number;
    metadataFilesSkipped: number;
  };
  resolverConfig: TsconfigPathsConfig | null;
}

export interface AnalysisProgress {
  stage: AnalysisStage;
  message: string;
  filesDiscovered: number;
  eligibleSourceFiles: number;
  filesSelected: number;
  filesFetched: number;
  filesParsed: number;
  importsExtracted: number;
  resolvedImports: number;
  unresolvedImports: number;
  externalImports: number;
  edgesBuilt: number;
  skippedFiles: number;
  excludedFiles: number;
  failedDownloads: number;
  failedParsing: number;
  unsupportedFiles: number;
  generatedFiles: number;
  binaryFiles: number;
  filesTooLarge: number;
  maximumLimitFiles: number;
  metadataFilesDiscovered: number;
  metadataFilesParsed: number;
  metadataParsingFailures: number;
  metadataOutcomes: MetadataFileOutcome[];
  fileOutcomes: FileAnalysisOutcome[];
  truncatedTree: boolean;
  errors: string[];
}

export interface AnalysisStats {
  filesDiscovered: number;
  eligibleSourceFiles: number;
  filesSelected: number;
  filesFetched: number;
  filesAnalyzed: number;
  filesSkipped: number;
  excludedFiles: number;
  failedDownloads: number;
  failedParsing: number;
  unsupportedFiles: number;
  generatedFiles: number;
  binaryFiles: number;
  filesTooLarge: number;
  maximumLimitFiles: number;
  importsExtracted: number;
  resolvedInternal: number;
  externalPackages: number;
  unresolved: number;
  edges: number;
  truncatedTree: boolean;
  hitFileLimit: boolean;
  durationMs: number;
}

export interface AnalyzedRepository {
  id: string;
  metadata: GitHubRepoMetadata;
  repository: Repository;
  graph: DependencyGraphData;
  unresolvedImports: ResolvedImport[];
  externalPackages: string[];
  fileOutcomes: FileAnalysisOutcome[];
  projectMetadata?: ProjectMetadataAnalysis;
  stats: AnalysisStats;
  analyzedAt: string;
  branch: string;
}

export interface AnalysisPipelineResult {
  analyzed: AnalyzedRepository;
  progress: AnalysisProgress;
}

export const DEFAULT_ANALYSIS_LIMITS: AnalysisLimits = {
  maxSourceFiles: null,
  maxFileBytes: 200_000,
  contentConcurrency: 6,
  parseBatchSize: 25,
};

export function emptyProgress(
  stage: AnalysisStage = "idle",
  message = "",
): AnalysisProgress {
  return {
    stage,
    message,
    filesDiscovered: 0,
    eligibleSourceFiles: 0,
    filesSelected: 0,
    filesFetched: 0,
    filesParsed: 0,
    importsExtracted: 0,
    resolvedImports: 0,
    unresolvedImports: 0,
    externalImports: 0,
    edgesBuilt: 0,
    skippedFiles: 0,
    excludedFiles: 0,
    failedDownloads: 0,
    failedParsing: 0,
    unsupportedFiles: 0,
    generatedFiles: 0,
    binaryFiles: 0,
    filesTooLarge: 0,
    maximumLimitFiles: 0,
    metadataFilesDiscovered: 0,
    metadataFilesParsed: 0,
    metadataParsingFailures: 0,
    metadataOutcomes: [],
    fileOutcomes: [],
    truncatedTree: false,
    errors: [],
  };
}

export function toRepositoryView(
  meta: GitHubRepoMetadata,
  status: RepositoryStatus,
  fileCount: number,
  dependencyCount: number,
): Repository {
  return {
    id: `github:${meta.fullName}`,
    name: meta.name,
    fullName: meta.fullName,
    description: meta.description ?? "No description provided.",
    language: mapLanguage(meta.language),
    fileCount,
    dependencyCount,
    stars: meta.stars,
    forks: meta.forks,
    updatedAt: meta.updatedAt,
    status,
    branch: meta.defaultBranch,
    provenance: "analyzed" as DataProvenance,
  };
}

function mapLanguage(
  language: string | null,
): Repository["language"] {
  switch (language) {
    case "TypeScript":
      return "TypeScript";
    case "JavaScript":
      return "JavaScript";
    default:
      return "Unknown";
  }
}
