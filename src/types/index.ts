/** Shared domain types for RepoPilot Phase I.
 * Designed so Phase II can swap mock sources for real analysis results.
 */

export type FileKind =
  | "entry"
  | "app"
  | "page"
  | "layout"
  | "component"
  | "store"
  | "utility"
  | "data"
  | "ui";

export type Language =
  | "TypeScript"
  | "JavaScript"
  | "TSX"
  | "CSS"
  | "JSON";

export type RepositoryStatus = "indexed" | "indexing" | "pending" | "error";

export type DataProvenance = "mock" | "simulated" | "analyzed";

export type ImpactSeverity = "low" | "medium" | "high" | "critical";

export interface SourceFile {
  id: string;
  name: string;
  path: string;
  kind: FileKind;
  language: Language;
  /** Number of outgoing import edges (dependencies). */
  dependencyCount: number;
  /** Number of incoming import edges (dependents). */
  dependentCount: number;
  linesOfCode?: number;
}

/** Directed edge: `source` imports `target`. */
export interface DependencyEdge {
  id: string;
  source: string;
  target: string;
}

export interface DependencyGraphData {
  files: SourceFile[];
  edges: DependencyEdge[];
  /** Layout positions keyed by file id — presentation concern, optional. */
  positions: Record<string, { x: number; y: number }>;
  provenance: DataProvenance;
  repositoryId: string;
  generatedAt: string;
  note: string;
}

export interface Repository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  language: Language;
  fileCount: number;
  dependencyCount: number;
  stars: number;
  updatedAt: string;
  status: RepositoryStatus;
  branch: string;
  isPrimary?: boolean;
  provenance: DataProvenance;
}

export interface WorkspaceStats {
  repositories: number;
  filesIndexed: number;
  dependencies: number;
  potentialRisks: number;
  provenance: DataProvenance;
}

export interface AffectedFile {
  fileId: string;
  path: string;
  name: string;
  kind: FileKind;
  /** 1 = direct dependent; >1 = transitive. */
  depth: number;
  /** Why this file is in the impact set. */
  reason: string;
  /** Hop path from the changed file to this file (ids). */
  pathFromSource: string[];
  severity: ImpactSeverity;
}

export interface ChangeImpactResult {
  selectedFileId: string;
  selectedFile: SourceFile;
  directDependents: AffectedFile[];
  transitiveDependents: AffectedFile[];
  /** Max depth among all affected files. */
  maxDepth: number;
  /** All potentially affected modules (direct + transitive). */
  affectedModules: AffectedFile[];
  overallSeverity: ImpactSeverity;
  provenance: DataProvenance;
  note: string;
}

export interface GraphSelectionHighlight {
  selectedId: string | null;
  /** Selected node + direct dependencies + direct dependents. */
  highlightedNodeIds: Set<string>;
  /** Edges that participate in the direct relationship. */
  highlightedEdgeIds: Set<string>;
  dependencyIds: Set<string>;
  dependentIds: Set<string>;
}

export interface NavItem {
  name: string;
  href: string;
  icon: string;
}
