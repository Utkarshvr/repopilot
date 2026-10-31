import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyzedRepository, AnalysisProgress } from "@/types/analysis";

const { runAnalysisPipeline } = vi.hoisted(() => ({ runAnalysisPipeline: vi.fn() }));
vi.mock("./repositoryService", () => ({ runAnalysisPipeline }));

import { buildRepositoryGraphSnapshot, createRepositoryGraphSnapshot, revisionSnapshotId } from "./revisionSnapshotService";

const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);
const parsed = { owner: "acme", repo: "demo", url: "https://github.com/acme/demo" };

function analyzed(commitSha: string, complete = true): AnalyzedRepository {
  const stats = {
    filesDiscovered: 4, eligibleSourceFiles: 2, filesSelected: 2, filesFetched: 2, filesAnalyzed: 2,
    filesSkipped: 0, excludedFiles: 2, failedDownloads: 0, failedParsing: 0, unsupportedFiles: 0,
    generatedFiles: 0, binaryFiles: 0, filesTooLarge: 0, maximumLimitFiles: 0, importsExtracted: 1,
    resolvedInternal: 1, externalPackages: 0, unresolved: 0, edges: 1, truncatedTree: !complete,
    hitFileLimit: false, durationMs: 10,
  };
  return {
    id: "github:acme/demo", metadata: { id: 1, name: "demo", fullName: "acme/demo", description: null, defaultBranch: "main", language: "TypeScript", stars: 0, forks: 0, updatedAt: "", private: false, visibility: "public", htmlUrl: "https://github.com/acme/demo" },
    repository: {} as AnalyzedRepository["repository"],
    graph: { repositoryId: "github:acme/demo", provenance: "analyzed", generatedAt: "2026-01-01", note: "", positions: {}, files: [], edges: [], revision: { ref: "main", commitSha, treeSha: `tree-${commitSha}` } },
    unresolvedImports: [], externalPackages: [], fileOutcomes: [], projectMetadata: { fileClassifications: [] } as unknown as NonNullable<AnalyzedRepository["projectMetadata"]>,
    stats, analyzedAt: "2026-01-01T00:00:00.000Z", branch: "main",
  };
}

beforeEach(() => runAnalysisPipeline.mockReset());

describe("revision-specific graph snapshots", () => {
  it("isolates snapshot identity by repository and immutable commit SHA", () => {
    expect(revisionSnapshotId("github:acme/demo", SHA_A)).not.toBe(revisionSnapshotId("github:acme/demo", SHA_B));
    expect(revisionSnapshotId("github:other/demo", SHA_A)).not.toBe(revisionSnapshotId("github:acme/demo", SHA_A));
  });

  it("captures commit identity and explicitly marks truncated analysis incomplete", () => {
    const result = createRepositoryGraphSnapshot(analyzed(SHA_A, false), parsed, SHA_A, "main");
    expect(result).toMatchObject({ commitSha: SHA_A, ref: "main", treeSha: `tree-${SHA_A}`, complete: false });
    expect(result.limitations[0]).toContain("truncated");
    expect(result.graph.revision?.commitSha).toBe(SHA_A);
  });

  it("runs the existing analysis pipeline with the requested commit SHA", async () => {
    runAnalysisPipeline.mockResolvedValue({ analyzed: analyzed(SHA_B), progress: {} as AnalysisProgress });
    const result = await buildRepositoryGraphSnapshot(parsed, SHA_B, "feature", vi.fn());
    expect(runAnalysisPipeline).toHaveBeenCalledWith(parsed, expect.anything(), expect.any(Function), undefined, { ref: "feature", commitSha: SHA_B });
    expect(result.commitSha).toBe(SHA_B);
    expect(result.ref).toBe("feature");
  });

  it("coalesces concurrent requests for the same repository commit", async () => {
    runAnalysisPipeline.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ analyzed: analyzed(SHA_A), progress: {} }), 5)));
    const results = await Promise.all([
      buildRepositoryGraphSnapshot(parsed, SHA_A, "main"),
      buildRepositoryGraphSnapshot(parsed, SHA_A, "main"),
    ]);
    expect(runAnalysisPipeline).toHaveBeenCalledTimes(1);
    expect(results[0]).toEqual(results[1]);
  });

  it("rejects abbreviated refs instead of creating mutable snapshot identities", async () => {
    expect(() => createRepositoryGraphSnapshot(analyzed(SHA_A), parsed, "abc1234", "main")).toThrow("full immutable commit SHA");
    await expect(buildRepositoryGraphSnapshot(parsed, "abc1234", "main")).rejects.toThrow("full immutable commit SHA");
  });
});
