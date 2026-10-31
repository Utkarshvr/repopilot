import type { DependencyGraphData, SourceFile } from "@/types";

/**
 * Mock dependency graph mirroring the RepoPilot Phase I frontend.
 * Edge direction: source imports target (source → target).
 *
 * Phase II can replace this module with AST-derived graph data
 * without changing visualization or impact UI consumers.
 */

const files: SourceFile[] = [
  {
    id: "main",
    name: "main.tsx",
    path: "src/main.tsx",
    kind: "entry",
    language: "TSX",
    dependencyCount: 2,
    dependentCount: 0,
    linesOfCode: 10,
  },
  {
    id: "app",
    name: "App.tsx",
    path: "src/App.tsx",
    kind: "app",
    language: "TSX",
    dependencyCount: 6,
    dependentCount: 1,
    linesOfCode: 48,
  },
  {
    id: "layout",
    name: "AppLayout.tsx",
    path: "src/components/layout/AppLayout.tsx",
    kind: "layout",
    language: "TSX",
    dependencyCount: 2,
    dependentCount: 1,
    linesOfCode: 24,
  },
  {
    id: "sidebar",
    name: "Sidebar.tsx",
    path: "src/components/layout/Sidebar.tsx",
    kind: "layout",
    language: "TSX",
    dependencyCount: 1,
    dependentCount: 1,
    linesOfCode: 90,
  },
  {
    id: "header",
    name: "Header.tsx",
    path: "src/components/layout/Header.tsx",
    kind: "layout",
    language: "TSX",
    dependencyCount: 1,
    dependentCount: 1,
    linesOfCode: 55,
  },
  {
    id: "overview",
    name: "Overview.tsx",
    path: "src/pages/Overview.tsx",
    kind: "page",
    language: "TSX",
    dependencyCount: 4,
    dependentCount: 1,
    linesOfCode: 80,
  },
  {
    id: "repos-page",
    name: "Repositories.tsx",
    path: "src/pages/Repositories.tsx",
    kind: "page",
    language: "TSX",
    dependencyCount: 2,
    dependentCount: 1,
    linesOfCode: 60,
  },
  {
    id: "graph-page",
    name: "DependencyGraphPage.tsx",
    path: "src/pages/DependencyGraphPage.tsx",
    kind: "page",
    language: "TSX",
    dependencyCount: 2,
    dependentCount: 1,
    linesOfCode: 40,
  },
  {
    id: "impact-page",
    name: "ImpactAnalysis.tsx",
    path: "src/pages/ImpactAnalysis.tsx",
    kind: "page",
    language: "TSX",
    dependencyCount: 3,
    dependentCount: 1,
    linesOfCode: 70,
  },
  {
    id: "settings-page",
    name: "Settings.tsx",
    path: "src/pages/Settings.tsx",
    kind: "page",
    language: "TSX",
    dependencyCount: 1,
    dependentCount: 1,
    linesOfCode: 90,
  },
  {
    id: "dep-graph",
    name: "DependencyGraph.tsx",
    path: "src/components/graph/DependencyGraph.tsx",
    kind: "component",
    language: "TSX",
    dependencyCount: 5,
    dependentCount: 2,
    linesOfCode: 220,
  },
  {
    id: "file-node",
    name: "FileNode.tsx",
    path: "src/components/graph/FileNode.tsx",
    kind: "component",
    language: "TSX",
    dependencyCount: 1,
    dependentCount: 1,
    linesOfCode: 75,
  },
  {
    id: "impact-panel",
    name: "ImpactPanel.tsx",
    path: "src/components/impact/ImpactPanel.tsx",
    kind: "component",
    language: "TSX",
    dependencyCount: 3,
    dependentCount: 2,
    linesOfCode: 160,
  },
  {
    id: "repo-list",
    name: "RepositoryList.tsx",
    path: "src/components/repositories/RepositoryList.tsx",
    kind: "component",
    language: "TSX",
    dependencyCount: 2,
    dependentCount: 2,
    linesOfCode: 50,
  },
  {
    id: "store",
    name: "useAppStore.ts",
    path: "src/store/useAppStore.ts",
    kind: "store",
    language: "TypeScript",
    dependencyCount: 1,
    dependentCount: 4,
    linesOfCode: 40,
  },
  {
    id: "graph-lib",
    name: "graph.ts",
    path: "src/lib/graph.ts",
    kind: "utility",
    language: "TypeScript",
    dependencyCount: 1,
    dependentCount: 3,
    linesOfCode: 220,
  },
  {
    id: "utils",
    name: "utils.ts",
    path: "src/lib/utils.ts",
    kind: "utility",
    language: "TypeScript",
    dependencyCount: 0,
    dependentCount: 5,
    linesOfCode: 4,
  },
  {
    id: "mock-graph",
    name: "mockDependencyGraph.ts",
    path: "src/data/mockDependencyGraph.ts",
    kind: "data",
    language: "TypeScript",
    dependencyCount: 0,
    dependentCount: 3,
    linesOfCode: 180,
  },
];

export const mockDependencyGraph: DependencyGraphData = {
  repositoryId: "repo-repopilot",
  provenance: "mock",
  generatedAt: "2026-10-31T12:00:00Z",
  note: "Mock graph derived from RepoPilot Phase I frontend structure — not AST-parsed.",
  files,
  edges: [
    // Bootstrap
    { id: "e-main-app", source: "main", target: "app" },

    // App shell + routes
    { id: "e-app-layout", source: "app", target: "layout" },
    { id: "e-app-overview", source: "app", target: "overview" },
    { id: "e-app-repos", source: "app", target: "repos-page" },
    { id: "e-app-graph", source: "app", target: "graph-page" },
    { id: "e-app-impact", source: "app", target: "impact-page" },
    { id: "e-app-settings", source: "app", target: "settings-page" },

    // Layout
    { id: "e-layout-sidebar", source: "layout", target: "sidebar" },
    { id: "e-layout-header", source: "layout", target: "header" },
    { id: "e-sidebar-utils", source: "sidebar", target: "utils" },
    { id: "e-header-utils", source: "header", target: "utils" },

    // Overview dashboard
    { id: "e-overview-repo-list", source: "overview", target: "repo-list" },
    { id: "e-overview-impact", source: "overview", target: "impact-panel" },
    { id: "e-overview-dep-graph", source: "overview", target: "dep-graph" },
    { id: "e-overview-store", source: "overview", target: "store" },

    // Repositories page
    { id: "e-repos-list", source: "repos-page", target: "repo-list" },
    { id: "e-repos-store", source: "repos-page", target: "store" },

    // Graph page
    { id: "e-graphpage-dep", source: "graph-page", target: "dep-graph" },
    { id: "e-graphpage-store", source: "graph-page", target: "store" },

    // Impact page
    { id: "e-impactpage-panel", source: "impact-page", target: "impact-panel" },
    { id: "e-impactpage-store", source: "impact-page", target: "store" },
    { id: "e-impactpage-graphlib", source: "impact-page", target: "graph-lib" },

    // Settings
    { id: "e-settings-utils", source: "settings-page", target: "utils" },

    // Graph component internals
    { id: "e-dep-filenode", source: "dep-graph", target: "file-node" },
    { id: "e-dep-graphlib", source: "dep-graph", target: "graph-lib" },
    { id: "e-dep-mock", source: "dep-graph", target: "mock-graph" },
    { id: "e-dep-store", source: "dep-graph", target: "store" },
    { id: "e-dep-utils", source: "dep-graph", target: "utils" },
    { id: "e-filenode-utils", source: "file-node", target: "utils" },

    // Impact panel
    { id: "e-panel-graphlib", source: "impact-panel", target: "graph-lib" },
    { id: "e-panel-store", source: "impact-panel", target: "store" },
    { id: "e-panel-mock", source: "impact-panel", target: "mock-graph" },

    // Repository list
    { id: "e-repolist-utils", source: "repo-list", target: "utils" },
    { id: "e-repolist-mock", source: "repo-list", target: "mock-graph" },

    // Shared libs
    { id: "e-store-mock", source: "store", target: "mock-graph" },
  ],
  positions: {
    main: { x: 40, y: 320 },
    app: { x: 280, y: 320 },
    layout: { x: 540, y: 120 },
    sidebar: { x: 800, y: 40 },
    header: { x: 800, y: 180 },
    overview: { x: 540, y: 280 },
    "repos-page": { x: 540, y: 400 },
    "graph-page": { x: 540, y: 520 },
    "impact-page": { x: 540, y: 640 },
    "settings-page": { x: 540, y: 760 },
    "dep-graph": { x: 820, y: 480 },
    "file-node": { x: 1100, y: 400 },
    "impact-panel": { x: 820, y: 640 },
    "repo-list": { x: 820, y: 320 },
    store: { x: 1100, y: 560 },
    "graph-lib": { x: 1100, y: 680 },
    utils: { x: 1100, y: 200 },
    "mock-graph": { x: 1380, y: 520 },
  },
};

/** Recompute counts from edges so presentation stays consistent. */
export function withComputedCounts(
  graph: DependencyGraphData,
): DependencyGraphData {
  const depCount = new Map<string, number>();
  const dependentCount = new Map<string, number>();

  for (const file of graph.files) {
    depCount.set(file.id, 0);
    dependentCount.set(file.id, 0);
  }

  for (const edge of graph.edges) {
    depCount.set(edge.source, (depCount.get(edge.source) ?? 0) + 1);
    dependentCount.set(edge.target, (dependentCount.get(edge.target) ?? 0) + 1);
  }

  return {
    ...graph,
    files: graph.files.map((file) => ({
      ...file,
      dependencyCount: depCount.get(file.id) ?? 0,
      dependentCount: dependentCount.get(file.id) ?? 0,
    })),
  };
}

export const repoPilotGraph = withComputedCounts(mockDependencyGraph);
