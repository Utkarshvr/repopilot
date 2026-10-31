import {
  fetchRepositoryMetadata,
  fetchRepositoryTree,
  fetchRawFileContent,
  mapPool,
  GitHubApiError,
} from "@/services/github/githubApi";
import { classifyRepositoryFile, filterSourceFiles, getFileName, isConfigPath } from "@/lib/analysis/fileFilter";
import { analyzeProjectMetadata, type MetadataContentResult } from "@/lib/analysis/projectMetadata";
import { extractImportsFromSource } from "@/lib/analysis/astParser";
import { resolveAllImports } from "@/lib/analysis/dependencyResolver";
import { buildDependencyGraph } from "@/lib/analysis/graphBuilder";
import { toRepositoryView } from "@/types/analysis";
import type {
  AnalysisLimits,
  AnalysisProgress,
  AnalysisPipelineResult,
  AnalysisStage,
  ExtractedImport,
  GitHubRepoMetadata,
  ResolvedImport,
  FileAnalysisOutcome,
  SourceFileContent,
} from "@/types/analysis";
import type { ParsedGitHubUrl } from "@/types/analysis";
import { DEFAULT_ANALYSIS_LIMITS, emptyProgress } from "@/types/analysis";

export type ProgressCallback = (progress: AnalysisProgress) => void;

function updateProgress(
  current: AnalysisProgress,
  patch: Partial<AnalysisProgress>,
): AnalysisProgress {
  return { ...current, ...patch };
}

function withStage(
  current: AnalysisProgress,
  stage: AnalysisStage,
  message: string,
): AnalysisProgress {
  return { ...current, stage, message };
}

/**
 * Main analysis pipeline.
 * Fetches a GitHub repository, extracts imports using AST parsing,
 * resolves dependencies, and builds a graph.
 */
export async function runAnalysisPipeline(
  parsed: ParsedGitHubUrl,
  limits: AnalysisLimits = DEFAULT_ANALYSIS_LIMITS,
  onProgress: ProgressCallback = () => {},
  signal?: AbortSignal,
): Promise<AnalysisPipelineResult> {
  const startMs = Date.now();
  let progress = emptyProgress("validating", "Validating repository URL…");
  onProgress(progress);

  // ── Stage 1: Fetch metadata ──────────────────────────────────────────────
  progress = withStage(progress, "fetching-metadata", "Fetching repository metadata…");
  onProgress(progress);

  let metadata: GitHubRepoMetadata;
  try {
    metadata = await fetchRepositoryMetadata(parsed.owner, parsed.repo, signal);
  } catch (err) {
    if (err instanceof GitHubApiError) throw err;
    throw new GitHubApiError("Failed to fetch repository metadata.", 0);
  }

  // ── Stage 2: Fetch file tree ─────────────────────────────────────────────
  progress = withStage(progress, "fetching-tree", `Fetching file tree (${metadata.defaultBranch})…`);
  onProgress(progress);

  const { entries, truncated } = await fetchRepositoryTree(
    parsed.owner,
    parsed.repo,
    metadata.defaultBranch,
    signal,
  );

  progress = updateProgress(progress, {
    filesDiscovered: entries.length,
    truncatedTree: truncated,
    message: `Received ${entries.length} repository files${truncated ? " (tree truncated)" : ""}.`,
  });
  onProgress(progress);

  if (entries.length === 0) throw new GitHubApiError("This repository is empty or its default branch has no files.", 404);

  // ── Stage 3: Project metadata ────────────────────────────────────────────
  progress = withStage(progress, "metadata", "Inspecting recognized manifests and configuration files…");
  onProgress(progress);

  const metadataEntries = entries.filter((entry) =>
    classifyRepositoryFile(entry.path) === "metadata" &&
    (getFileName(entry.path).toLowerCase() === "package.json" || isConfigPath(entry.path)) &&
    entry.size <= limits.maxFileBytes,
  );
  const metadataContents: Record<string, MetadataContentResult> = {};
  await mapPool(metadataEntries, Math.min(limits.contentConcurrency, 4), async (entry) => {
    try {
      const content = await fetchRawFileContent(
        parsed.owner, parsed.repo, metadata.defaultBranch, entry.path, signal,
      );
      metadataContents[entry.path] = { content };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      metadataContents[entry.path] = {
        error: error instanceof Error ? error.message : "Metadata download failed.",
      };
    }
    return undefined;
  }, signal);

  const projectMetadata = analyzeProjectMetadata(entries, metadataContents, limits.maxFileBytes);
  progress = updateProgress(progress, {
    metadataFilesDiscovered: projectMetadata.stats.metadataFilesDiscovered,
    metadataFilesParsed: projectMetadata.stats.metadataFilesParsed,
    metadataParsingFailures: projectMetadata.stats.metadataParsingFailures,
    metadataOutcomes: projectMetadata.outcomes,
    message: `Project metadata: ${projectMetadata.stats.metadataFilesParsed} parsed, ${projectMetadata.stats.metadataParsingFailures} parse failures.`,
  });
  onProgress(progress);

  // ── Stage 4: Filter source files ─────────────────────────────────────────
  const filtered = filterSourceFiles(entries, limits);
  const { selected, eligible, hitFileLimit } = filtered;
  const fileOutcomes = [...filtered.outcomes];

  progress = updateProgress(progress, {
    eligibleSourceFiles: eligible.length,
    filesSelected: selected.length,
    skippedFiles: filtered.skippedForSize + filtered.skippedForLimit,
    excludedFiles: filtered.excluded,
    unsupportedFiles: filtered.unsupported,
    generatedFiles: filtered.generated,
    binaryFiles: filtered.binary,
    filesTooLarge: filtered.skippedForSize,
    maximumLimitFiles: filtered.skippedForLimit,
    fileOutcomes,
    message: `Found ${eligible.length} eligible source files; selected ${selected.length}; skipped ${filtered.skippedForSize + filtered.skippedForLimit}.`,
  });
  onProgress(progress);

  const tsconfig = projectMetadata.resolverConfig;

  // ── Stage 5: Fetch file contents ─────────────────────────────────────────
  progress = withStage(progress, "fetching-contents", `Fetching ${selected.length} source files…`);
  onProgress(progress);

  const fetchErrors: string[] = [];
  let fetched = 0;
  let completedFetchAttempts = 0;

  const sourceFiles = await mapPool(
    selected,
    limits.contentConcurrency,
    async (entry): Promise<SourceFileContent | null> => {
      if (signal?.aborted) {
        throw new DOMException("Analysis cancelled", "AbortError");
      }
      try {
        const content = await fetchRawFileContent(
          parsed.owner,
          parsed.repo,
          metadata.defaultBranch,
          entry.path,
          signal,
        );
        fetched++;
        if (new TextEncoder().encode(content).byteLength > limits.maxFileBytes) {
          fileOutcomes.push({ path: entry.path, status: "skipped", reason: "file-too-large", detail: `Fetched content exceeds ${limits.maxFileBytes.toLocaleString()} bytes.` });
          return null;
        }
        const name = entry.path.split("/").pop() ?? entry.path;
        const dotIdx = name.lastIndexOf(".");
        const extension = dotIdx > 0 ? name.slice(dotIdx) : "";
        return {
          path: entry.path,
          name,
          extension,
          content,
          sha: entry.sha,
          size: entry.size,
        };
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
        const detail = err instanceof Error ? err.message : "Download failed.";
        fileOutcomes.push({ path: entry.path, status: "failed-download", reason: "fetch-failed", detail });
        fetchErrors.push(`${entry.path}: ${detail}`);
        return null;
      } finally {
        completedFetchAttempts++;
        if (completedFetchAttempts % 10 === 0 || completedFetchAttempts === selected.length) {
          const summary = summarizeFileOutcomes(fileOutcomes);
          progress = updateProgress(progress, {
            filesFetched: fetched,
            skippedFiles: summary.skippedFiles,
            failedDownloads: summary.failedDownloads,
            filesTooLarge: summary.filesTooLarge,
            fileOutcomes: [...fileOutcomes],
            errors: [...fetchErrors],
            message: `Completed ${completedFetchAttempts}/${selected.length} download attempts.`,
          });
          onProgress(progress);
        }
      }
    },
    signal,
  );

  const validSourceFiles = sourceFiles.filter((f): f is SourceFileContent => f !== null);
  const successfullyFetched = fetched;

  progress = updateProgress(progress, {
    filesFetched: successfullyFetched,
    skippedFiles: summarizeFileOutcomes(fileOutcomes).skippedFiles,
    failedDownloads: summarizeFileOutcomes(fileOutcomes).failedDownloads,
    filesTooLarge: summarizeFileOutcomes(fileOutcomes).filesTooLarge,
    fileOutcomes: [...fileOutcomes],
    errors: fetchErrors,
    message: `Successfully fetched ${successfullyFetched} selected source files.`,
  });
  onProgress(progress);

  // ── Stage 6: AST parsing ─────────────────────────────────────────────────
  progress = withStage(progress, "parsing", `Parsing ${validSourceFiles.length} source files…`);
  onProgress(progress);

  const allImports: ExtractedImport[] = [];
  let parsed_ = 0;
  const parsedSourceFiles: SourceFileContent[] = [];

  for (let i = 0; i < validSourceFiles.length; i += limits.parseBatchSize) {
    if (signal?.aborted) {
      throw new DOMException("Analysis cancelled", "AbortError");
    }

    const batch = validSourceFiles.slice(i, i + limits.parseBatchSize);
    for (const file of batch) {
      try {
        const imports = await extractImportsFromSource(file.path, file.content);
        allImports.push(...imports);
        parsedSourceFiles.push(file);
        fileOutcomes.push({ path: file.path, status: "parsed" });
        parsed_++;
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Parser failed.";
        fileOutcomes.push({ path: file.path, status: "failed-parsing", reason: "parse-failed", detail });
        fetchErrors.push(`${file.path}: ${detail}`);
      }
    }

    progress = updateProgress(progress, {
      filesParsed: parsed_,
      failedParsing: summarizeFileOutcomes(fileOutcomes).failedParsing,
      fileOutcomes: [...fileOutcomes],
      errors: [...fetchErrors],
      importsExtracted: allImports.length,
      message: `Parsed ${parsed_}/${validSourceFiles.length} files, ${allImports.length} imports found.`,
    });
    onProgress(progress);

    // Yield to event loop between batches
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  // ── Stage 7: Dependency resolution ───────────────────────────────────────
  progress = withStage(progress, "resolving", `Resolving ${allImports.length} imports…`);
  onProgress(progress);

  const filePaths = parsedSourceFiles.map((f) => f.path);
  const resolved: ResolvedImport[] = resolveAllImports(allImports, filePaths, tsconfig);

  const resolvedCount = resolved.filter((r) => r.status === "resolved").length;
  const unresolvedCount = resolved.filter((r) => r.status === "unresolved").length;
  const externalCount = resolved.filter((r) => r.status === "external").length;

  const unresolvedImports = resolved.filter((r) => r.status === "unresolved");
  const externalPackages = [
    ...new Set(
      resolved
        .filter((r) => r.status === "external" && r.packageName)
        .map((r) => r.packageName as string),
    ),
  ].sort();

  progress = updateProgress(progress, {
    resolvedImports: resolvedCount,
    unresolvedImports: unresolvedCount,
    externalImports: externalCount,
    message: `Resolved ${resolvedCount} internal, ${externalCount} external, ${unresolvedCount} unresolved.`,
  });
  onProgress(progress);

  // ── Stage 8: Build graph ──────────────────────────────────────────────────
  progress = withStage(progress, "building-graph", "Building dependency graph…");
  onProgress(progress);

  const repositoryId = `github:${metadata.fullName}`;
  const fileSizes = Object.fromEntries(parsedSourceFiles.map((file) => [file.path, file.size]));
  const graph = buildDependencyGraph(filePaths, resolved, repositoryId, fileSizes);

  progress = updateProgress(progress, {
    edgesBuilt: graph.edges.length,
    message: `Graph built: ${graph.files.length} nodes, ${graph.edges.length} edges.`,
  });
  onProgress(progress);

  // ── Stage 9: Assemble result ──────────────────────────────────────────────
  const durationMs = Date.now() - startMs;
  const finalOutcomeSummary = summarizeFileOutcomes(fileOutcomes);
  const accountedEligible =
    parsedSourceFiles.length + finalOutcomeSummary.failedDownloads +
    finalOutcomeSummary.failedParsing + finalOutcomeSummary.skippedFiles;
  if (accountedEligible !== eligible.length || fileOutcomes.length !== entries.length) {
    throw new Error(
      `File accounting invariant failed: ${eligible.length} eligible, ${accountedEligible} accounted, ${fileOutcomes.length}/${entries.length} tree files classified.`,
    );
  }
  const repository = toRepositoryView(
    metadata,
    "indexed",
    parsedSourceFiles.length,
    graph.edges.length,
  );

  progress = withStage(
    progress,
    "complete",
    `Analysis complete in ${(durationMs / 1000).toFixed(1)}s`,
  );
  onProgress(progress);

  return {
    analyzed: {
      id: repositoryId,
      metadata,
      repository,
      graph,
      unresolvedImports,
      externalPackages,
      fileOutcomes: fileOutcomes.sort((a, b) => a.path.localeCompare(b.path)),
      projectMetadata,
      stats: {
        filesDiscovered: entries.length,
        eligibleSourceFiles: eligible.length,
        filesSelected: selected.length,
        filesFetched: successfullyFetched,
        filesAnalyzed: parsedSourceFiles.length,
        filesSkipped: finalOutcomeSummary.skippedFiles,
        excludedFiles: filtered.excluded,
        failedDownloads: finalOutcomeSummary.failedDownloads,
        failedParsing: finalOutcomeSummary.failedParsing,
        unsupportedFiles: filtered.unsupported,
        generatedFiles: filtered.generated,
        binaryFiles: filtered.binary,
        filesTooLarge: finalOutcomeSummary.filesTooLarge,
        maximumLimitFiles: filtered.skippedForLimit,
        importsExtracted: allImports.length,
        resolvedInternal: resolvedCount,
        externalPackages: externalPackages.length,
        unresolved: unresolvedCount,
        edges: graph.edges.length,
        truncatedTree: truncated,
        hitFileLimit,
        durationMs,
      },
      analyzedAt: new Date().toISOString(),
      branch: metadata.defaultBranch,
    },
    progress,
  };
}

function summarizeFileOutcomes(outcomes: FileAnalysisOutcome[]) {
  return {
    skippedFiles: outcomes.filter((item) => item.status === "skipped").length,
    failedDownloads: outcomes.filter((item) => item.status === "failed-download").length,
    failedParsing: outcomes.filter((item) => item.status === "failed-parsing").length,
    filesTooLarge: outcomes.filter((item) => item.reason === "file-too-large").length,
  };
}


