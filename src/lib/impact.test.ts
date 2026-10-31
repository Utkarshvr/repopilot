import { describe, expect, it } from "vitest";
import type { AnalyzedRepository, ExtractedImport, ResolvedImport } from "@/types/analysis";
import type { DependencyGraphData } from "@/types";
import type { ChangeSet, ChangedFile, GitHubCompareResult } from "@/types/changes";
import { buildDependencyGraphFixture, FIXTURE_FILE_PATHS } from "@/lib/analysis/fixtures/dependencyGraphFixture";
import { buildDependencyGraph } from "@/lib/analysis/graphBuilder";
import { resolveAllImports } from "@/lib/analysis/dependencyResolver";
import { createGitHubChangeSet } from "@/lib/changes";
import { analyzeChangeImpact, assessStructuralRisk, currentGraphSnapshot, DEFAULT_IMPACT_RISK_CONFIG } from "./impact";

const { graph: fixtureGraph, imports: fixtureImports, resolvedImports } = buildDependencyGraphFixture();
const analyzed = {
  id: "github:fixture/repo",
  metadata: { fullName: "fixture/repo", htmlUrl: "https://github.com/fixture/repo" },
  branch: "main",
  graph: fixtureGraph,
} as AnalyzedRepository;

function compareSet(files: Array<{ filename: string; status: string; previous_filename?: string }>, complete = true): ChangeSet {
  const result: GitHubCompareResult = {
    baseSha: "base-commit", headSha: "head-commit",
    baseTreeSha: "base-tree", headTreeSha: "head-tree",
    totalCommits: 3, isComplete: complete,
    completenessWarning: complete ? null : "GitHub comparison may be incomplete.",
    files: files.map((file) => ({ ...file, additions: 1, deletions: 0, changes: 1 })),
  };
  const set = createGitHubChangeSet(analyzed, "main", "feature", result, "test-change", "2026-01-01T00:00:00.000Z");
  return { ...set, files: set.files.map((file) => ({ ...file, selectedForImpact: true })) };
}

function graphAt(graph: DependencyGraphData, role: "base" | "head" | "current", treeSha: string) {
  const copy = { ...graph, revision: { ref: role === "base" ? "main" : "feature", commitSha: null, treeSha } };
  return { graph: copy, role, revision: copy.revision };
}

const baseGraph = graphAt(fixtureGraph, "base", "base-tree");
const headGraph = graphAt(fixtureGraph, "head", "head-tree");

describe("change impact engine", () => {
  it("finds the exact direct and transitive logger impact through both branches", () => {
    const changeSet = compareSet([{ filename: "src/utils/logger.ts", status: "modified" }]);
    const report = analyzeChangeImpact({ changeSet, baseGraph, headGraph });
    expect(report.perChange[0].directDependents).toEqual(["src/auth/authService.ts", "src/users/userService.ts"]);
    expect(new Set(report.perChange[0].transitiveDependents)).toEqual(new Set([
      "src/auth/authController.ts", "src/users/userController.ts", "src/app.ts", "src/index.ts",
    ]));
    expect(report.summary).toMatchObject({ directlyAffectedFilesCount: 2, transitivelyAffectedFilesCount: 4, totalUniqueAffectedFiles: 6, analysisComplete: true, graphRevisionVerified: true });
    expect(report.affectedFiles.some((file) => file.path === "src/isolated.ts")).toBe(false);
  });

  it("does not report complete impact when a used revision snapshot is incomplete", () => {
    const incompleteHead = { ...headGraph, complete: false, limitations: ["Recursive tree response was truncated."] };
    const report = analyzeChangeImpact({ changeSet: compareSet([{ filename: "src/utils/logger.ts", status: "modified" }]), baseGraph, headGraph: incompleteHead });
    expect(report.summary.analysisComplete).toBe(false);
    expect(report.summary.completeness).toBe("partial");
    expect(report.limitations.some((item) => item.includes("incomplete") && item.includes("truncated"))).toBe(true);
  });

  it("uses changed dependency relationships from both base and head snapshots", () => {
    const paths = ["src/utils/logger.ts", "src/oldImporter.ts", "src/newImporter.ts"];
    const base = buildDependencyGraph(paths.slice(0, 2), resolveAllImports([{
      importingFile: "src/oldImporter.ts", specifier: "./utils/logger", kind: "static", importedSymbols: [], line: 1, column: 1, isTypeOnly: false,
    }], paths.slice(0, 2), null), "fixture");
    const headWithLogger = buildDependencyGraph(paths, resolveAllImports([{
      importingFile: "src/newImporter.ts", specifier: "./utils/logger", kind: "static", importedSymbols: [], line: 1, column: 1, isTypeOnly: false,
    }], paths, null), "fixture");
    const report = analyzeChangeImpact({ changeSet: compareSet([{ filename: "src/utils/logger.ts", status: "modified" }]), baseGraph: graphAt(base, "base", "base-tree"), headGraph: graphAt(headWithLogger, "head", "head-tree") });
    expect(report.perChange[0].directDependents).toEqual(["src/newImporter.ts", "src/oldImporter.ts"]);
  });

  it("preserves two shortest dependency paths for a shared affected file", () => {
    const report = analyzeChangeImpact({ changeSet: compareSet([{ filename: "src/utils/logger.ts", status: "modified" }]), baseGraph, headGraph });
    const app = report.affectedFiles.find((file) => file.path === "src/app.ts");
    expect(app?.dependencyPaths[0].paths).toEqual(expect.arrayContaining([
      ["src/app.ts", "src/auth/authController.ts", "src/auth/authService.ts", "src/utils/logger.ts"],
      ["src/app.ts", "src/users/userController.ts", "src/users/userService.ts", "src/utils/logger.ts"],
    ]));
  });

  it("deduplicates overall impact for multiple changed files and retains each cause", () => {
    const changeSet = compareSet([
      { filename: "src/utils/logger.ts", status: "modified" },
      { filename: "src/auth/authService.ts", status: "modified" },
    ]);
    const report = analyzeChangeImpact({ changeSet, baseGraph, headGraph });
    const authController = report.affectedFiles.find((file) => file.path === "src/auth/authController.ts");
    expect(authController?.responsibleChangedPaths).toEqual(["src/auth/authService.ts", "src/utils/logger.ts"]);
    expect(report.summary.totalUniqueAffectedFiles).toBe(5);
    expect(new Set(report.affectedFiles.map((file) => file.path)).size).toBe(5);
  });

  it("uses the matching head graph for additions and exposes revision limitations", () => {
    const newPath = "src/newFeature.ts";
    const filePaths = [...FIXTURE_FILE_PATHS, newPath];
    const imports = resolveAllImports([
      ...fixtureImports,
      { importingFile: "src/app.ts", specifier: "./newFeature", kind: "static", importedSymbols: [], line: 50, column: 1, isTypeOnly: false } satisfies ExtractedImport,
    ], filePaths, null);
    const graph = buildDependencyGraph(filePaths, imports, "fixture");
    const matchingHead = graphAt(graph, "head", "head-tree");
    const changeSet = compareSet([{ filename: newPath, status: "added" }]);
    const added = analyzeChangeImpact({ changeSet, currentGraph: matchingHead });
    expect(added.perChange[0].directDependents).toEqual(["src/app.ts"]);
    expect(added.summary).toMatchObject({ graphRevisionVerified: true, analysisComplete: true });

    const wrongRevision = analyzeChangeImpact({ changeSet, currentGraph: graphAt(fixtureGraph, "current", "unrelated-tree") });
    expect(wrongRevision.summary.graphRevisionVerified).toBe(false);
    expect(wrongRevision.summary.analysisComplete).toBe(false);
    expect(wrongRevision.limitations.join(" ")).toContain("could not be verified");
  });

  it("uses a base graph for deletions and both graphs for renames", () => {
    const deleted = analyzeChangeImpact({ changeSet: compareSet([{ filename: "src/utils/logger.ts", status: "removed" }]), currentGraph: baseGraph });
    expect(deleted.perChange[0].directDependents).toContain("src/auth/authService.ts");
    expect(deleted.summary.graphRevisionVerified).toBe(true);

    const renamed = analyzeChangeImpact({
      changeSet: compareSet([{ filename: "src/utils/log.ts", previous_filename: "src/utils/logger.ts", status: "renamed" }]),
      baseGraph, headGraph,
    });
    expect(renamed.perChange[0]).toMatchObject({ originalPath: "src/utils/logger.ts", currentPath: "src/utils/log.ts", status: "renamed" });
    expect(renamed.perChange[0].directDependents).toContain("src/auth/authService.ts");
    expect(renamed.exclusions.some((item) => item.path === "src/utils/log.ts")).toBe(true);
  });

  it("treats copied paths as additions, retains original paths, and excludes unsupported changes", () => {
    const copied = analyzeChangeImpact({
      changeSet: compareSet([{ filename: "src/utils/loggerCopy.ts", previous_filename: "src/utils/logger.ts", status: "copied" }]),
      headGraph,
    });
    expect(copied.perChange[0]).toMatchObject({ originalPath: "src/utils/logger.ts", currentPath: "src/utils/loggerCopy.ts", status: "copied", totalAffectedFiles: 0 });
    expect(copied.exclusions[0].reason).toBe("missing-changed-file-node");

    const unsupportedSet = compareSet([{ filename: "package.json", status: "modified" }]);
    const unsupported = analyzeChangeImpact({ changeSet: unsupportedSet, currentGraph: currentGraphSnapshot(analyzed) });
    expect(unsupported.summary.filesExcludedFromImpactAnalysis).toBe(1);
    expect(unsupported.exclusions[0].reason).toBe("unsupported-file-type");
  });

  it("handles missing nodes, unselected files, unresolved imports, and incomplete comparisons transparently", () => {
    const missing = analyzeChangeImpact({ changeSet: compareSet([{ filename: "src/notAnalyzed.ts", status: "modified" }]), baseGraph, headGraph });
    expect(missing.exclusions.some((item) => item.reason === "missing-changed-file-node")).toBe(true);
    expect(missing.summary.analysisComplete).toBe(false);

    const unselected = compareSet([{ filename: "src/utils/logger.ts", status: "modified" }]);
    unselected.files[0].selectedForImpact = false;
    const empty = analyzeChangeImpact({ changeSet: unselected, baseGraph, headGraph });
    expect(empty.summary.changedFilesCount).toBe(0);
    expect(empty.exclusions[0].reason).toBe("not-selected");

    const unresolved = resolvedImports.filter((item) => item.status === "unresolved");
    const partial = analyzeChangeImpact({ changeSet: compareSet([{ filename: "src/utils/logger.ts", status: "modified" }], false), baseGraph, headGraph, unresolvedImports: unresolved });
    expect(partial.summary.unresolvedImpactRelationships).toBe(1);
    expect(partial.summary.analysisComplete).toBe(false);
    expect(partial.limitations.some((item) => item.includes("incomplete"))).toBe(true);
  });

  it("handles self-import cycles, empty sets, and empty graphs", () => {
    const selfChange = analyzeChangeImpact({ changeSet: compareSet([{ filename: "src/self.ts", status: "modified" }]), baseGraph, headGraph });
    expect(selfChange.perChange[0].totalAffectedFiles).toBe(0);
    expect(selfChange.perChange[0].risk.factors.find((factor) => factor.key === "circular")?.contribution).toBe(DEFAULT_IMPACT_RISK_CONFIG.weights.circular);

    const emptySet = { ...compareSet([]), files: [] };
    expect(analyzeChangeImpact({ changeSet: emptySet, currentGraph: currentGraphSnapshot(analyzed) }).summary.totalUniqueAffectedFiles).toBe(0);
    const emptyGraph: DependencyGraphData = { repositoryId: "empty", provenance: "analyzed", generatedAt: "", note: "", files: [], edges: [], positions: {}, revision: { ref: "main", commitSha: null, treeSha: "base-tree" } };
    const missing = analyzeChangeImpact({ changeSet: compareSet([{ filename: "src/utils/logger.ts", status: "removed" }]), currentGraph: { graph: emptyGraph, role: "current" } });
    expect(missing.summary.completeness).toBe("partial");
    expect(missing.affectedFiles).toEqual([]);
  });

  it("scores risk deterministically and keeps impact breadth from automatically becoming critical", () => {
    const broad = assessStructuralRisk({ directDependents: 8, transitiveDependents: 25, dependencyFanOut: 0, maxDepth: 0, circular: false, alternatePaths: 0 });
    expect(broad.score).toBe(45);
    expect(broad.level).toBe("medium");
    expect(broad.note).toContain("not a probability");
    expect(assessStructuralRisk({ directDependents: 8, transitiveDependents: 25, dependencyFanOut: 4, maxDepth: 0, circular: false, alternatePaths: 0 }).level).toBe("high");
    expect(assessStructuralRisk({ directDependents: 8, transitiveDependents: 25, dependencyFanOut: 4, maxDepth: 8, circular: true, alternatePaths: 0 }).level).toBe("critical");
    expect(assessStructuralRisk({ directDependents: 0, transitiveDependents: 0, dependencyFanOut: 0, maxDepth: 0, circular: false, alternatePaths: 0 }).level).toBe("low");
  });

  it("handles a large reverse-dependency chain using a single graph index", () => {
    const size = 1000;
    const paths = Array.from({ length: size }, (_, i) => `src/${String(i).padStart(4, "0")}.ts`);
    const imports: ResolvedImport[] = paths.slice(0, -1).map((path, i) => ({ importingFile: path, specifier: `./${String(i + 1).padStart(4, "0")}`, kind: "static", importedSymbols: [], line: 1, column: 1, isTypeOnly: false, status: "resolved", resolvedPath: paths[i + 1], packageName: null }));
    const graph = buildDependencyGraph(paths, imports, "large");
    const file: ChangedFile = { path: paths.at(-1)!, previousPath: null, status: "modified", additions: 1, deletions: 0, changes: 1, patch: null, patchAvailable: false, isBinary: false, classification: "source", isInAnalyzedGraph: true, analysisEligible: true, ineligibilityReason: null, selectedForImpact: true };
    const changeSet: ChangeSet = { id: "large", repositoryId: "large", repositoryFullName: "large/repo", source: "manual", baseRevision: null, headRevision: null, baseSha: null, headSha: null, baseTreeSha: null, headTreeSha: null, totalCommits: null, files: [file], isComplete: true, completenessWarning: null, createdAt: "now" };
    const report = analyzeChangeImpact({ changeSet, currentGraph: { graph, role: "current" } });
    expect(report.summary.totalUniqueAffectedFiles).toBe(size - 1);
    expect(report.affectedFiles[0].distance).toBe(1);
    expect(report.affectedFiles.at(-1)?.distance).toBe(size - 1);
  });
});
