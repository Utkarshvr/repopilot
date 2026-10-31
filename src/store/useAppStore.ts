import { create } from "zustand";

interface AppState {
  selectedRepositoryId: string;
  selectedFileId: string | null;
  setSelectedRepositoryId: (id: string) => void;
  setSelectedFileId: (id: string | null) => void;
  clearSelection: () => void;
}

/**
 * UI selection state shared across graph and impact views.
 * Graph and impact pages now pull graph data from repositoryStore.
 */
export const useAppStore = create<AppState>((set) => ({
  selectedRepositoryId: "",
  selectedFileId: null,
  setSelectedRepositoryId: (id) => set({ selectedRepositoryId: id }),
  setSelectedFileId: (id) => set({ selectedFileId: id }),
  clearSelection: () => set({ selectedFileId: null }),
}));
