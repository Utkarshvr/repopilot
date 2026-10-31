import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AnalyzedRepository, AnalysisProgress } from "@/types/analysis";
import { emptyProgress } from "@/types/analysis";
import type { DependencyGraphData } from "@/types";

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface RepositoryStoreState {
  /** All analyzed repositories, keyed by id */
  analyzedRepositories: Record<string, AnalyzedRepository>;

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
}

export type RepositoryStore = RepositoryStoreState & RepositoryStoreActions;

// ------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------

const MAX_STORED_REPOS = 5;
const emptyGraph: DependencyGraphData = { files: [], edges: [], positions: {}, provenance: "simulated", repositoryId: "", generatedAt: new Date(0).toISOString(), note: "Connect a public GitHub repository to build its dependency graph." };

// Persist only the serializable parts (not AbortController)
type PersistedState = Pick<
  RepositoryStoreState,
  "analyzedRepositories" | "activeRepositoryId"
>;

// ------------------------------------------------------------------
// Store
// ------------------------------------------------------------------

export const useRepositoryStore = create<RepositoryStore>()(
  persist(
    (set, get) => ({
      // ── State ──────────────────────────────────────────────────────────
      analyzedRepositories: {},
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
          return {
            analyzedRepositories: next,
            activeRepositoryId:
              state.activeRepositoryId === id ? null : state.activeRepositoryId,
          };
        });
      },

      clearAll() {
        set({
          analyzedRepositories: {},
          activeRepositoryId: null,
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
    }),

    {
      name: "repopilot-repositories",
      storage: createJSONStorage(() => localStorage),

      // Only persist the repository catalog + active id; not analysis state
      partialize: (state): PersistedState => ({
        analyzedRepositories: state.analyzedRepositories,
        activeRepositoryId: state.activeRepositoryId,
      }),

      // Limit stored size: strip graph positions and file content proxies
      // (graphs can be large; we persist only what we need)
      version: 1,
    },
  ),
);



