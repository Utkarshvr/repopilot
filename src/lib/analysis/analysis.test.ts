import { describe, expect, it } from "vitest";
import { extractImportsFromSource } from "./astParser";
import { resolveAllImports } from "./dependencyResolver";
import { buildDependencyGraph } from "./graphBuilder";
import { computeChangeImpact } from "@/lib/graph";
import type { DependencyGraphData } from "@/types";
import { filterSourceFiles } from "./fileFilter";
import { DEFAULT_ANALYSIS_LIMITS } from "@/types/analysis";
import { parseTsconfigPaths } from "./dependencyResolver";

describe("repository dependency analysis", () => {
  it("classifies eligible, oversized, capped, generated, binary, and unsupported files once", () => {
    const files = [
      { path: "src/A.ts", size: 10 },
      { path: "src/B.ts", size: 10 },
      { path: "src/C.ts", size: 10 },
      { path: "src/Large.ts", size: 101 },
      { path: "dist/bundle.js", size: 10 },
      { path: "assets/logo.svg", size: 10 },
      { path: "README.md", size: 10 },
      { path: ".gitignore", size: 10 },
    ].map((file, index) => ({ ...file, sha: String(index), type: "blob" as const }));
    const result = filterSourceFiles(files, {
      maxSourceFiles: 1, maxFileBytes: 100, contentConcurrency: 2, parseBatchSize: 4,
    });
    expect(result.eligible).toHaveLength(4);
    expect(result.selected.map((file) => file.path)).toEqual(["src/A.ts"]);
    expect(result.skippedForSize).toBe(1);
    expect(result.skippedForLimit).toBe(2);
    expect(result.unsupported).toBe(1);
    expect(result.generated).toBe(1);
    expect(result.binary).toBe(1);
    expect(new Set(result.outcomes.map((item) => item.path)).size).toBe(result.outcomes.length);
  });

  it("selects every eligible file by default", () => {
    const entries = ["a.ts", "b.ts", "c.ts"].map((path) => ({
      path, size: 10, sha: path, type: "blob" as const,
    }));
    const result = filterSourceFiles(entries, DEFAULT_ANALYSIS_LIMITS);
    expect(DEFAULT_ANALYSIS_LIMITS.maxSourceFiles).toBeNull();
    expect(result.selected).toHaveLength(3);
    expect(result.hitFileLimit).toBe(false);
  });

  it("extracts imports with the TypeScript AST and resolves internal versus external modules", async () => {
    const imports = await extractImportsFromSource(
      "src/App.tsx",
      'import Button from "./Button";\nimport React from "react";\nexport * from "../utils";\nconst x = require("./legacy");',
    );
    expect(imports.map((item) => item.kind)).toEqual([
      "static", "static", "export-star", "require",
    ]);
    const resolved = resolveAllImports(
      imports,
      ["src/App.tsx", "src/Button.tsx", "utils/index.ts", "src/legacy.js"],
      null,
    );
    expect(resolved.map((item) => item.status)).toEqual([
      "resolved", "external", "resolved", "resolved",
    ]);
  });

  it("counts syntax diagnostics as parsing failures", async () => {
    await expect(extractImportsFromSource("src/broken.ts", "const = ;")).rejects.toThrow("Syntax parse failed");
  });

  it("keeps import direction and metadata on graph edges", async () => {
    const imports = resolveAllImports(
      await extractImportsFromSource("src/A.ts", 'import { B } from "./B";'),
      ["src/A.ts", "src/B.ts"],
      null,
    );
    const graph = buildDependencyGraph(["src/A.ts", "src/B.ts"], imports, "test");
    expect(graph.edges[0]).toMatchObject({
      source: "src/A.ts", target: "src/B.ts", specifier: "./B", importedSymbols: ["B"],
    });
  });

  it("resolves aliases only from configured paths", () => {
    const imports = [{
      importingFile: "src/App.tsx", specifier: "@/Button", kind: "static" as const,
      importedSymbols: [], line: 1, column: 1, isTypeOnly: false,
    }];
    expect(resolveAllImports(imports, ["src/App.tsx", "src/Button.tsx"], null)[0].status)
      .toBe("unresolved");
    expect(resolveAllImports(imports, ["src/App.tsx", "src/Button.tsx"], {
      baseUrl: ".", paths: { "@/*": ["src/*"] },
    })[0].resolvedPath).toBe("src/Button.tsx");
  });

  it("keeps the existing resolver compatible with JSONC path configuration", () => {
    const config = parseTsconfigPaths(`{
      // compiler aliases
      "compilerOptions": { "baseUrl": "..", "paths": { "@/*": ["src/*",], }, },
    }`, "config/tsconfig.json");
    expect(config).toEqual({ baseUrl: ".", paths: { "@/*": ["src/*"] } });
  });

  it("finds reverse dependents once through cycles and reports importer-to-target paths", () => {
    const graph: DependencyGraphData = {
      repositoryId: "test", provenance: "analyzed", generatedAt: "", note: "",
      positions: {},
      files: ["A", "B", "C"].map((path) => ({
        id: path, name: `${path}.ts`, path: `${path}.ts`, kind: "utility",
        language: "TypeScript", dependencyCount: 1, dependentCount: 1,
      })),
      edges: [
        { id: "ab", source: "A", target: "B" },
        { id: "bc", source: "B", target: "C" },
        { id: "ca", source: "C", target: "A" },
      ],
    };
    const impact = computeChangeImpact(graph, "B");
    expect(impact?.directDependents.map((file) => file.fileId)).toEqual(["A"]);
    expect(impact?.transitiveDependents.map((file) => file.fileId)).toEqual(["C"]);
    expect(impact?.totalAffected).toBe(2);
    expect(impact?.transitiveDependents[0].dependencyPath).toEqual(["C.ts", "A.ts", "B.ts"]);
    expect(computeChangeImpact(graph, "missing")).toBeNull();
  });
});

