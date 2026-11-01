import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangeSet } from "@/types/changes";
import type { RepositoryGraphSnapshot } from "@/types/analysis";
import type { AnalyzedRepository } from "@/types/analysis";

const changeSet: ChangeSet = {
  id: "change-test", repositoryId: "github:owner/repo", repositoryFullName: "owner/repo",
  source: "manual", baseRevision: null, headRevision: null, baseSha: null, headSha: null,
  baseTreeSha: null, headTreeSha: null,
  totalCommits: null, files: [], isComplete: true, completenessWarning: null, createdAt: "2026-01-01T00:00:00.000Z",
};

let store: typeof import("./repositoryStore")["useRepositoryStore"] | undefined;
const memoryStorage = new Map<string, string>();

afterEach(() => {
  store?.getState().clearAll();
  store = undefined;
  vi.unstubAllGlobals();
  vi.resetModules();
  memoryStorage.clear();
});

describe("repository store change set persistence", () => {
  it("stores the unified change set in the repository catalog persistence payload", async () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => memoryStorage.set(key, value),
      removeItem: (key: string) => memoryStorage.delete(key),
    });
    const module = await import("./repositoryStore");
    store = module.useRepositoryStore;
    store.getState().storeChangeSet(changeSet);
    expect(store.getState().getActiveChangeSet()).toEqual(changeSet);
    const state = store.getState();
    const persisted = store.persist.getOptions().partialize?.(state) as Record<string, unknown>;
    expect(persisted).toMatchObject({
      activeChangeSetId: changeSet.id,
      changeSets: { [changeSet.id]: changeSet },
    });
    const raw = memoryStorage.get("repopilot-repositories");
    expect(raw).toContain('"change-test"');
    expect(raw).toContain('"activeChangeSetId":"change-test"');
  });

  it("retrieves snapshots by exact repo and commit and retains only two recent revisions", async () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => memoryStorage.set(key, value),
      removeItem: (key: string) => memoryStorage.delete(key),
    });
    const module = await import("./repositoryStore");
    store = module.useRepositoryStore;
    const makeSnapshot = (commitSha: string, analyzedAt: string) => ({
      id: `github:owner/repo@${commitSha}`, repositoryId: "github:owner/repo", repositoryFullName: "owner/repo",
      owner: "owner", repo: "repo", commitSha, ref: "main", treeSha: "f".repeat(40), analyzedAt,
      graph: { files: [], edges: [], revision: { commitSha, treeSha: "f".repeat(40) } }, unresolvedImports: [], fileOutcomes: [], stats: { filesAnalyzed: 0, filesDiscovered: 0, filesSkipped: 0, failedDownloads: 0, failedParsing: 0, unresolved: 0, truncatedTree: false },
      complete: true, limitations: [],
    }) as unknown as RepositoryGraphSnapshot;
    store.getState().storeRevisionSnapshot(makeSnapshot("a".repeat(40), "2026-01-01"));
    store.getState().storeRevisionSnapshot(makeSnapshot("b".repeat(40), "2026-01-02"));
    store.getState().storeRevisionSnapshot(makeSnapshot("c".repeat(40), "2026-01-03"));
    expect(store.getState().getRevisionSnapshot("github:owner/repo", "a".repeat(40))).toBeNull();
    expect(store.getState().getRevisionSnapshot("github:owner/repo", "b".repeat(40))?.commitSha).toBe("b".repeat(40));
    expect(store.getState().getRevisionSnapshot("github:other/repo", "b".repeat(40))).toBeNull();
    expect(store.getState().getRevisionSnapshots("github:owner/repo")).toHaveLength(2);
  });

  it("keeps revision snapshots in the serializable persisted repository payload", async () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => memoryStorage.set(key, value),
      removeItem: (key: string) => memoryStorage.delete(key),
    });
    const module = await import("./repositoryStore");
    store = module.useRepositoryStore;
    const commitSha = "d".repeat(40);
    const snapshot = { id: `github:owner/repo@${commitSha}`, repositoryId: "github:owner/repo", repositoryFullName: "owner/repo", owner: "owner", repo: "repo", commitSha, ref: "main", treeSha: "f".repeat(40), analyzedAt: "now", graph: { files: [], edges: [], revision: { commitSha, treeSha: "f".repeat(40) } }, unresolvedImports: [], fileOutcomes: [], stats: { filesAnalyzed: 0, filesDiscovered: 0, filesSkipped: 0, failedDownloads: 0, failedParsing: 0, unresolved: 0, truncatedTree: false }, complete: true, limitations: [] } as unknown as RepositoryGraphSnapshot;
    store.getState().storeRevisionSnapshot(snapshot);
    const persisted = store.persist.getOptions().partialize?.(store.getState()) as Record<string, unknown>;
    expect(persisted.revisionSnapshots).toEqual({ "github:owner/repo": [snapshot] });
  });

  it("hydrates a legacy repository catalog without revision history", async () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => key === "repopilot-repositories" ? JSON.stringify({ state: { analyzedRepositories: {}, activeRepositoryId: null, changeSets: {}, activeChangeSetId: null }, version: 1 }) : null,
      setItem: (key: string, value: string) => memoryStorage.set(key, value),
      removeItem: (key: string) => memoryStorage.delete(key),
    });
    const module = await import("./repositoryStore");
    store = module.useRepositoryStore;
    expect(store.getState().getRevisionSnapshots("github:legacy/repo")).toEqual([]);
  });

  it("ignores malformed revision cache entries safely", async () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => memoryStorage.set(key, value),
      removeItem: (key: string) => memoryStorage.delete(key),
    });
    const module = await import("./repositoryStore");
    store = module.useRepositoryStore;
    store.setState({ revisionSnapshots: { "github:owner/repo": { bad: "entry" } } as never });
    expect(store.getState().getRevisionSnapshot("github:owner/repo", "e".repeat(40))).toBeNull();
    expect(store.getState().getRevisionSnapshots("github:owner/repo")).toEqual([]);
  });

  it("switches repositories and active change sets without mixing their stored data", async () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => memoryStorage.set(key, value),
      removeItem: (key: string) => memoryStorage.delete(key),
    });
    const module = await import("./repositoryStore");
    store = module.useRepositoryStore;
    const repoA = { id: "github:owner/repo", analyzedAt: "2026-01-01", graph: { repositoryId: "github:owner/repo" } } as unknown as AnalyzedRepository;
    const repoB = { id: "github:other/repo", analyzedAt: "2026-01-02", graph: { repositoryId: "github:other/repo" } } as unknown as AnalyzedRepository;
    store.getState().storeAnalysis(repoA);
    store.getState().storeAnalysis(repoB);
    const setA = { ...changeSet, id: "change-a", repositoryId: repoA.id };
    const setB = { ...changeSet, id: "change-b", repositoryId: repoB.id };
    store.getState().storeChangeSet(setA);
    store.getState().storeChangeSet(setB);
    expect(store.getState().getActiveChangeSet()?.id).toBe("change-b");
    store.getState().setActiveRepository(repoA.id);
    expect(store.getState().getActiveAnalyzed()?.id).toBe(repoA.id);
    expect(store.getState().getActiveChangeSet()?.repositoryId).toBe(repoB.id);
    store.getState().storeChangeSet(setA);
    expect(store.getState().getActiveChangeSet()?.repositoryId).toBe(repoA.id);
    store.getState().setActiveChangeSet(setB.id);
    expect(store.getState().getActiveChangeSet()?.id).toBe(setB.id);
    store.getState().setActiveChangeSet(setA.id);
    expect(store.getState().getActiveChangeSet()?.id).toBe(setA.id);
    store.getState().setActiveChangeSet("missing-change-set");
    expect(store.getState().getActiveChangeSet()).toBeNull();
    expect(store.getState().changeSets[setB.id]).toEqual(setB);
  });
});
