import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AnalyzedRepository, AnalysisProgress, RepositoryGraphSnapshot } from "@/types/analysis";
import { emptyProgress } from "@/types/analysis";
import type { DependencyGraphData } from "@/types";
import type { ChangeSet } from "@/types/changes";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface RepositoryStoreState {
  /** All analyzed repositories, keyed by id */
  analyzedRepositories: Record<string, AnalyzedRepository>;
  changeSets: Record<string, ChangeSet>;
  activeChangeSetId: string | null;
  revisionSnapshots: Record<string, RepositoryGraphSnapshot[]>;

  /** Currently active repository id */
  activeRepositoryId: string | null;

  /** Analysis is currently running */
  isAnalyzing: boolean;

  /** Current analysis progress */
  progress: AnalysisProgress;

  /** Last analysis error */
  analysisError: string | null;

  /** AbortController for cancellation */
  abortController: AbortController | null;
}

export interface RepositoryStoreActions {
  /** Start tracking a new analysis */
  startAnalysis: () => AbortController;

  /** Update progress during analysis */
  updateProgress: (progress: AnalysisProgress) => void;

  /** Store a completed analysis result */
  storeAnalysis: (result: AnalyzedRepository) => void;
  storeChangeSet: (changeSet: ChangeSet) => void;
  setActiveChangeSet: (id: string | null) => void;
  clearActiveChangeSet: () => void;
  storeRevisionSnapshot: (snapshot: RepositoryGraphSnapshot) => void;
  getRevisionSnapshot: (repositoryId: string, commitSha: string | null | undefined) => RepositoryGraphSnapshot | null;
  getRevisionSnapshots: (repositoryId: string) => RepositoryGraphSnapshot[];

  /** Mark analysis as failed */
  failAnalysis: (error: string) => void;

  /** Cancel in-progress analysis */
  cancelAnalysis: () => void;

  /** Set the active repository */
  setActiveRepository: (id: string | null) => void;

  /** Remove an analyzed repository */
  removeRepository: (id: string) => void;

  /** Clear all stored repositories */
  clearAll: () => void;

  /** Get the active repository's graph (empty until one is analyzed) */
  getActiveGraph: () => DependencyGraphData;

  /** Get the active analyzed repository */
  getActiveAnalyzed: () => AnalyzedRepository | null;
  getActiveChangeSet: () => ChangeSet | null;
}

export type RepositoryStore = RepositoryStoreState & RepositoryStoreActions;

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const MAX_STORED_REPOS = 5;
const emptyGraph: DependencyGraphData = { files: [], edges: [], positions: {}, provenance: "simulated", repositoryId: "", generatedAt: new Date(0).toISOString(), note: "Connect a public GitHub repository to build its dependency graph." };

function isValidRevisionSnapshot(value: unknown, repositoryId: string, commitSha: string): value is RepositoryGraphSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RepositoryGraphSnapshot>;
  return candidate.repositoryId === repositoryId && candidate.commitSha?.toLowerCase() === commitSha.toLowerCase() && /^[0-9a-f]{40,64}$/i.test(commitSha) &&
    typeof candidate.id === "string" && candidate.id === `${repositoryId}@${commitSha.toLowerCase()}` &&
    typeof candidate.owner === "string" && typeof candidate.repo === "string" && typeof candidate.ref === "string" && /^[0-9a-f]{40,64}$/i.test(candidate.treeSha ?? "") &&
    Array.isArray(candidate.graph?.files) && candidate.graph.files.every((file) => Boolean(file && typeof file.id === "string" && typeof file.path === "string")) &&
    Array.isArray(candidate.graph?.edges) && candidate.graph.edges.every((edge) => Boolean(edge && typeof edge.source === "string" && typeof edge.target === "string")) &&
    Array.isArray(candidate.unresolvedImports) && Array.isArray(candidate.fileOutcomes) &&
    candidate.graph.revision?.commitSha?.toLowerCase() === commitSha.toLowerCase() && candidate.graph.revision.treeSha === candidate.treeSha &&
    Boolean(candidate.stats && Number.isFinite(candidate.stats.filesAnalyzed) && Number.isFinite(candidate.stats.filesDiscovered)) &&
    typeof candidate.complete === "boolean" && Array.isArray(candidate.limitations) &&
    (!candidate.complete || (candidate.stats?.filesSkipped === 0 && candidate.stats.failedDownloads === 0 && candidate.stats.failedParsing === 0 && candidate.stats.unresolved === 0 && candidate.stats.truncatedTree === false && candidate.limitations.length === 0));
}

// Persist only the serializable parts (not AbortController)
type PersistedState = Pick<
  RepositoryStoreState,
  "analyzedRepositories" | "activeRepositoryId" | "changeSets" | "activeChangeSetId"
  | "revisionSnapshots"
>;

// ------------------------------------------------------------------
// Store
// ------------------------------------------------------------------

export const useRepositoryStore = create<RepositoryStore>()(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────
      analyzedRepositories: {},
      changeSets: {},
      activeChangeSetId: null,
      revisionSnapshots: {},
      activeRepositoryId: null,
      isAnalyzing: false,
      progress: emptyProgress(),
      analysisError: null,
      abortController: null,

      // ── Actions ────────────────────────────────────────────────────────

      startAnalysis() {
        const controller = new AbortController();
        set({
          isAnalyzing: true,
          progress: emptyProgress("validating", "Starting analysis…"),
          analysisError: null,
          abortController: controller,
        });
        return controller;
      },

      updateProgress(progress) {
        set({ progress });
      },

      storeAnalysis(result) {
        set((state) => {
          const existing = { ...state.analyzedRepositories };

          // Enforce storage limit: evict oldest if at cap
          const keys = Object.keys(existing);
          if (keys.length >= MAX_STORED_REPOS && !existing[result.id]) {
            // Find and remove the oldest by analyzedAt
            let oldest = keys[0];
            for (const k of keys) {
              if ((existing[k]?.analyzedAt ?? "") < (existing[oldest]?.analyzedAt ?? "")) {
                oldest = k;
              }
            }
            delete existing[oldest];
          }

          existing[result.id] = result;

          return {
            analyzedRepositories: existing,
            activeRepositoryId: result.id,
            isAnalyzing: false,
            abortController: null,
          };
        });
      },

      storeChangeSet(changeSet) {
        set((state) => {
          const changeSets = { ...state.changeSets, [changeSet.id]: changeSet };
          const sorted = Object.values(changeSets).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          while (sorted.length > 20) {
            const removed = sorted.shift();
            if (removed) delete changeSets[removed.id];
          }
          return { changeSets, activeChangeSetId: changeSet.id };
        });
      },

      setActiveChangeSet(id) {
        set((state) => ({
          activeChangeSetId: id && state.changeSets[id] ? id : null,
        }));
      },

      clearActiveChangeSet() {
        set({ activeChangeSetId: null });
      },

      storeRevisionSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== "object" || typeof snapshot.repositoryId !== "string" || typeof snapshot.commitSha !== "string" || !isValidRevisionSnapshot(snapshot, snapshot.repositoryId, snapshot.commitSha)) return;
        set((state) => {
          const snapshots = state.revisionSnapshots && typeof state.revisionSnapshots === "object" ? { ...state.revisionSnapshots } : {};
          const existingSnapshots = Array.isArray(snapshots[snapshot.repositoryId]) ? snapshots[snapshot.repositoryId] : [];
          const repositorySnapshots = existingSnapshots
            .filter((item) => item.commitSha !== snapshot.commitSha);
          repositorySnapshots.push(snapshot);
          repositorySnapshots.sort((a, b) => a.analyzedAt.localeCompare(b.analyzedAt));
          snapshots[snapshot.repositoryId] = repositorySnapshots.slice(-2);
          return { revisionSnapshots: snapshots };
        });
      },

      getRevisionSnapshot(repositoryId, commitSha) {
        if (!commitSha) return null;
        const cache: unknown = get().revisionSnapshots;
        const stored: unknown = cache && typeof cache === "object" ? (cache as Record<string, unknown>)[repositoryId] : undefined;
        const candidate = (Array.isArray(stored) ? stored : []).find((item: unknown) =>
          Boolean(item && typeof item === "object" && (item as RepositoryGraphSnapshot).commitSha?.toLowerCase() === commitSha.toLowerCase()),
        );
        return candidate && isValidRevisionSnapshot(candidate, repositoryId, commitSha) ? candidate : null;
      },

      getRevisionSnapshots(repositoryId) {
        const cache: unknown = get().revisionSnapshots;
        const stored: unknown = cache && typeof cache === "object" ? (cache as Record<string, unknown>)[repositoryId] : undefined;
        return Array.isArray(stored) ? stored.filter((item): item is RepositoryGraphSnapshot => {
          if (!item || typeof item !== "object") return false;
          const commitSha = (item as Partial<RepositoryGraphSnapshot>).commitSha;
          return typeof commitSha === "string" && isValidRevisionSnapshot(item, repositoryId, commitSha);
        }) : [];
      },

      failAnalysis(error) {
        set({
          isAnalyzing: false,
          analysisError: error,
          progress: emptyProgress("error", error),
          abortController: null,
        });
      },

      cancelAnalysis() {
        const { abortController } = get();
        abortController?.abort();
        set({
          isAnalyzing: false,
          progress: emptyProgress("cancelled", "Analysis cancelled."),
          abortController: null,
        });
      },

      setActiveRepository(id) {
        set({ activeRepositoryId: id });
      },

      removeRepository(id) {
        set((state) => {
          const next = { ...state.analyzedRepositories };
          delete next[id];
          const changeSets = Object.fromEntries(Object.entries(state.changeSets).filter(([, changeSet]) => changeSet.repositoryId !== id));
          const revisionSnapshots = { ...state.revisionSnapshots };
          delete revisionSnapshots[id];
          return {
            analyzedRepositories: next,
            changeSets,
            revisionSnapshots,
            activeChangeSetId: state.activeChangeSetId && !changeSets[state.activeChangeSetId] ? null : state.activeChangeSetId,
            activeRepositoryId:
              state.activeRepositoryId === id ? null : state.activeRepositoryId,
          };
        });
      },

      clearAll() {
        set({
          analyzedRepositories: {},
          changeSets: {},
          revisionSnapshots: {},
          activeRepositoryId: null,
          activeChangeSetId: null,
        });
      },

      getActiveGraph() {
        const { activeRepositoryId, analyzedRepositories } = get();
        if (activeRepositoryId && analyzedRepositories[activeRepositoryId]) {
          return analyzedRepositories[activeRepositoryId].graph;
        }
        return emptyGraph;
      },

      getActiveAnalyzed() {
        const { activeRepositoryId, analyzedRepositories } = get();
        if (activeRepositoryId && analyzedRepositories[activeRepositoryId]) {
          return analyzedRepositories[activeRepositoryId];
        }
        return null;
      },

      getActiveChangeSet() {
        const { activeChangeSetId, changeSets } = get();
        return activeChangeSetId ? changeSets[activeChangeSetId] ?? null : null;
      },
    }),

    {
      name: "repopilot-repositories",
      storage: createJSONStorage(() => localStorage),

      // Only persist the repository catalog + active id; not analysis state
      partialize: (state): PersistedState => ({
        analyzedRepositories: state.analyzedRepositories,
        activeRepositoryId: state.activeRepositoryId,
        changeSets: state.changeSets,
        activeChangeSetId: state.activeChangeSetId,
        revisionSnapshots: state.revisionSnapshots,
      }),

      // Limit stored size: strip graph positions and file content proxies
      // (graphs can be large; we persist only what we need)
      version: 1,
    },
  ),
);



