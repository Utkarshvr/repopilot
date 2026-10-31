import { afterEach, describe, expect, it, vi } from "vitest";
import type { RepoTreeEntry } from "@/types/analysis";
import { clearContentAnalysisCache } from "@/lib/analysis/contentAnalysisCache";

const { fetchRepositoryMetadata, fetchRepositoryTree, fetchRawFileContent } = vi.hoisted(() => ({
  fetchRepositoryMetadata: vi.fn(), fetchRepositoryTree: vi.fn(), fetchRawFileContent: vi.fn(),
}));

vi.mock("./githubApi", async () => {
  const actual = await vi.importActual<typeof import("./githubApi")>("./githubApi");
  return { ...actual, fetchRepositoryMetadata, fetchRepositoryTree, fetchRawFileContent };
});

import { runAnalysisPipeline } from "./repositoryService";

const commitSha = "a".repeat(40);
const treeSha = "b".repeat(40);
const parsed = { owner: "acme", repo: "demo", url: "https://github.com/acme/demo" };
const entries: RepoTreeEntry[] = [
  { path: "package.json", sha: "package", size: 20, type: "blob" },
  { path: "tsconfig.json", sha: "config", size: 40, type: "blob" },
  { path: "src/app.ts", sha: "app", size: 25, type: "blob" },
  { path: "src/helper.ts", sha: "helper", size: 15, type: "blob" },
];

afterEach(() => { vi.clearAllMocks(); clearContentAnalysisCache(); });

describe("revision-specific repository pipeline", () => {
  it("fetches the tree and every metadata/source blob at the requested immutable commit", async () => {
    fetchRepositoryMetadata.mockResolvedValue({ id: 1, name: "demo", fullName: "acme/demo", description: null, defaultBranch: "main", language: "TypeScript", stars: 0, forks: 0, updatedAt: "", private: false, visibility: "public", htmlUrl: "https://github.com/acme/demo" });
    fetchRepositoryTree.mockResolvedValue({ entries, truncated: false, treeSha });
    fetchRawFileContent.mockImplementation(async (_owner: string, _repo: string, ref: string, path: string) => {
      expect(ref).toBe(commitSha);
      if (path === "package.json") return '{"name":"demo"}';
      if (path === "tsconfig.json") return '{"compilerOptions": {"baseUrl": ".", "paths": {"@/*": ["src/*"]}}}';
      if (path === "src/app.ts") return 'import "@/helper";';
      return "export const helper = 1;";
    });

    const result = await runAnalysisPipeline(parsed, undefined, vi.fn(), undefined, { ref: "feature", commitSha });
    expect(fetchRepositoryTree).toHaveBeenCalledWith("acme", "demo", commitSha, undefined);
    expect(fetchRawFileContent).toHaveBeenCalledTimes(entries.length);
    expect(result.analyzed.graph.revision).toEqual({ ref: "feature", commitSha, treeSha });
    expect(result.analyzed.graph.edges).toHaveLength(1);
    expect(result.analyzed.graph.edges[0]).toMatchObject({ source: "src/app.ts", target: "src/helper.ts" });
    expect(result.analyzed.projectMetadata?.resolverConfig?.paths).toEqual({ "@/*": ["src/*"] });
  });

  it("reuses unchanged Git blob contents across revisions while rebuilding revision-specific resolution", async () => {
    fetchRepositoryMetadata.mockResolvedValue({ id: 1, name: "demo", fullName: "acme/demo", description: null, defaultBranch: "main", language: "TypeScript", stars: 0, forks: 0, updatedAt: "", private: false, visibility: "public", htmlUrl: "https://github.com/acme/demo" });
    fetchRepositoryTree.mockImplementation(async (_owner: string, _repo: string, ref: string) => ({ entries, truncated: false, treeSha: ref === commitSha ? treeSha : "c".repeat(40) }));
    fetchRawFileContent.mockImplementation(async (_owner: string, _repo: string, _ref: string, path: string) => {
      if (path === "package.json") return '{"name":"demo"}';
      if (path === "tsconfig.json") return '{"compilerOptions": {"baseUrl": ".", "paths": {"@/*": ["src/*"]}}}';
      if (path === "src/app.ts") return 'import "@/helper";';
      return "export const helper = 1;";
    });

    await runAnalysisPipeline(parsed, undefined, vi.fn(), undefined, { ref: "main", commitSha });
    const nextCommit = "d".repeat(40);
    const next = await runAnalysisPipeline(parsed, undefined, vi.fn(), undefined, { ref: "feature", commitSha: nextCommit });
    expect(fetchRawFileContent).toHaveBeenCalledTimes(entries.length);
    expect(fetchRepositoryTree).toHaveBeenCalledTimes(2);
    expect(next.analyzed.graph.revision?.commitSha).toBe(nextCommit);
    expect(next.analyzed.graph.edges).toHaveLength(1);
  });
});
