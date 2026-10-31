import { create } from "zustand";
import { primaryRepository } from "@/data/mockRepositories";
import { repoPilotGraph } from "@/data/mockDependencyGraph";

interface AppState {
  selectedRepositoryId: string;
  selectedFileId: string | null;
  setSelectedRepositoryId: (id: string) => void;
  setSelectedFileId: (id: string | null) => void;
  clearSelection: () => void;
}

/**
 * UI selection state shared across graph and impact views.
 * Phase II can extend this with real repository / analysis session state.
 */
export const useAppStore = create<AppState>((set) => ({
  selectedRepositoryId: primaryRepository.id,
  selectedFileId: repoPilotGraph.files.find((f) => f.id === "utils")?.id ?? null,
  setSelectedRepositoryId: (id) => set({ selectedRepositoryId: id }),
  setSelectedFileId: (id) => set({ selectedFileId: id }),
  clearSelection: () => set({ selectedFileId: null }),
}));
