import { describe, expect, it } from "vitest";
import type { DependencyGraphData } from "@/types";
import type { ResolvedImport } from "@/types/analysis";
import { buildGraphIndex, computeChangeImpact, computeSelectionHighlight, getCircularDependencyGroup, getDependencyGraphStatistics, getDependencyPath, getDirectDependencies, getDirectDependents, getTransitiveDependencies, getTransitiveDependents } from "./graph";
import { buildDependencyGraphFixture } from "./analysis/fixtures/dependencyGraphFixture";
import { buildDependencyGraph } from "./analysis/graphBuilder";

const fixture = buildDependencyGraphFixture();
const index = buildGraphIndex(fixture.graph);

describe("dependency graph service", () => {
  it("uses importer to dependency direction for direct lookups", () => {
    expect(getDirectDependencies(index, "src/index.ts")).toEqual(["src/app.ts"]);
    expect(getDirectDependents(index, "src/utils/logger.ts")).toEqual([
      "src/auth/authService.ts", "src/users/userService.ts",
    ]);
  });

  it("traverses dependencies and dependents transitively without duplicates", () => {
    expect([...getTransitiveDependencies(index, "src/index.ts").keys()]).toEqual([
      "src/app.ts", "src/auth/authController.ts", "src/users/userController.ts",
      "src/auth/authService.ts", "src/users/userService.ts", "src/utils/logger.ts",
    ]);
    expect(new Set(getTransitiveDependents(index, "src/utils/logger.ts").keys())).toEqual(new Set([
      "src/auth/authService.ts", "src/users/userService.ts", "src/auth/authController.ts",
      "src/users/userController.ts", "src/app.ts", "src/index.ts",
    ]));
  });

  it("reconstructs shortest dependency paths in importer-to-dependency order", () => {
    expect(getDependencyPath(index, "src/index.ts", "src/utils/logger.ts")).toEqual([
      "src/index.ts", "src/app.ts", "src/auth/authController.ts",
      "src/auth/authService.ts", "src/utils/logger.ts",
    ]);
    expect(getDependencyPath(index, "src/isolated.ts", "src/utils/logger.ts")).toBeNull();
  });

  it("finds strongly connected groups and treats self-import as a one-file cycle", () => {
    expect(index.circularDependencyGroups).toEqual([
      ["src/cycle/cycleA.ts", "src/cycle/cycleB.ts"], ["src/self.ts"],
    ]);
    expect(getCircularDependencyGroup(index, "src/cycle/cycleA.ts")).toEqual([
      "src/cycle/cycleA.ts", "src/cycle/cycleB.ts",
    ]);
    expect(getCircularDependencyGroup(index, "src/self.ts")).toEqual(["src/self.ts"]);
    expect(getDirectDependencies(index, "src/self.ts")).toEqual(["src/self.ts"]);
  });

  it("deduplicates repeated import relationships while retaining unresolved and external imports separately", () => {
    expect(fixture.graph.edges.filter((edge) => edge.source === "src/app.ts" && edge.target === "src/auth/authController.ts")).toHaveLength(1);
    expect(fixture.resolvedImports.find((item) => item.specifier === "./notFound")?.status).toBe("unresolved");
    expect(fixture.resolvedImports.find((item) => item.specifier === "react")).toMatchObject({ status: "external", packageName: "react" });
    expect(fixture.graph.files.some((file) => file.path === "react")).toBe(false);
  });

  it("computes change impact across both logger branches and excludes unrelated files", () => {
    const impact = computeChangeImpact(fixture.graph, "src/utils/logger.ts");
    expect(new Set(impact?.affectedModules.map((item) => item.path))).toEqual(new Set([
      "src/auth/authService.ts", "src/auth/authController.ts", "src/users/userService.ts",
      "src/users/userController.ts", "src/app.ts", "src/index.ts",
    ]));
    expect(impact?.totalAffected).toBe(6);
    expect(impact?.affectedModules.some((item) => item.path === "src/isolated.ts")).toBe(false);
  });

  it("reports accurate internal graph statistics", () => {
    const stats = getDependencyGraphStatistics(index);
    expect(stats.totalInternalFiles).toBe(11);
    expect(stats.totalInternalEdges).toBe(10);
    expect(stats.filesWithNoDependencies).toEqual(["src/isolated.ts", "src/utils/logger.ts"]);
    expect(stats.filesWithNoDependents).toEqual(["src/index.ts", "src/isolated.ts"]);
    expect(stats.mostImportedFiles[0]).toEqual({ fileId: "src/utils/logger.ts", dependentCount: 2 });
    expect(stats.highestDependencyCounts[0]).toEqual({ fileId: "src/app.ts", dependencyCount: 2 });
    expect(stats.circularDependencyGroups).toHaveLength(2);
  });

  it("supports selection highlights for dependency-only, dependent-only, and full neighborhoods", () => {
    expect(computeSelectionHighlight(index, "src/app.ts", "dependencies").highlightedNodeIds).toContain("src/utils/logger.ts");
    expect(computeSelectionHighlight(index, "src/app.ts", "dependencies").highlightedNodeIds).not.toContain("src/index.ts");
    expect(computeSelectionHighlight(index, "src/app.ts", "dependents").highlightedNodeIds).toEqual(new Set(["src/app.ts", "src/index.ts"]));
    expect(computeSelectionHighlight(index, "src/app.ts", "neighborhood").highlightedNodeIds).toContain("src/index.ts");
  });

  it("handles empty graphs", () => {
    const empty: DependencyGraphData = { repositoryId: "empty", provenance: "analyzed", generatedAt: "", note: "", files: [], edges: [], positions: {} };
    const emptyIndex = buildGraphIndex(empty);
    expect(getDependencyGraphStatistics(emptyIndex)).toMatchObject({ totalInternalFiles: 0, totalInternalEdges: 0, filesWithNoDependencies: [], filesWithNoDependents: [], circularDependencyGroups: [] });
    expect(getDependencyPath(emptyIndex, "missing", "missing")).toBeNull();
  });

  it("handles a large deep chain without recursive SCC traversal", () => {
    const size = 5000;
    const paths = Array.from({ length: size }, (_, i) => `src/${String(i).padStart(5, "0")}.ts`);
    const imports: ResolvedImport[] = paths.slice(0, -1).map((path, i) => ({ importingFile: path, specifier: `./${String(i + 1).padStart(5, "0")}`, kind: "static", importedSymbols: [], line: 1, column: 1, isTypeOnly: false, status: "resolved", resolvedPath: paths[i + 1], packageName: null }));
    const graph = buildDependencyGraph(paths, imports, "large");
    const largeIndex = buildGraphIndex(graph);
    expect(getDependencyPath(largeIndex, paths[0], paths.at(-1)!)).toHaveLength(size);
    expect(largeIndex.circularDependencyGroups).toEqual([]);
    expect(getTransitiveDependencies(largeIndex, paths[0]).size).toBe(size - 1);
  });
});
