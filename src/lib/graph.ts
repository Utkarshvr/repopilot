import type {
  AffectedFile,
  ChangeImpactResult,
  DependencyEdge,
  DependencyGraphData,
  GraphSelectionHighlight,
  ImpactSeverity,
  SourceFile,
} from "@/types";

/** Adjacency maps for efficient traversal. */
export interface GraphIndex {
  filesById: Map<string, SourceFile>;
  /** fileId → files it imports (outgoing). */
  dependencies: Map<string, string[]>;
  /** fileId → files that import it (incoming). */
  dependents: Map<string, string[]>;
  edges: DependencyEdge[];
  edgeByPair: Map<string, DependencyEdge>;
}

function pairKey(source: string, target: string): string {
  return `${source}→${target}`;
}

export function buildGraphIndex(graph: DependencyGraphData): GraphIndex {
  const filesById = new Map(graph.files.map((f) => [f.id, f]));
  const dependencies = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  const edgeByPair = new Map<string, DependencyEdge>();

  for (const file of graph.files) {
    dependencies.set(file.id, []);
    dependents.set(file.id, []);
  }

  for (const edge of graph.edges) {
    dependencies.get(edge.source)?.push(edge.target);
    dependents.get(edge.target)?.push(edge.source);
    edgeByPair.set(pairKey(edge.source, edge.target), edge);
  }

  return {
    filesById,
    dependencies,
    dependents,
    edges: graph.edges,
    edgeByPair,
  };
}

export function getDirectDependencies(
  index: GraphIndex,
  fileId: string,
): string[] {
  return index.dependencies.get(fileId) ?? [];
}

export function getDirectDependents(
  index: GraphIndex,
  fileId: string,
): string[] {
  return index.dependents.get(fileId) ?? [];
}

/**
 * BFS over outgoing edges — files this module transitively depends on.
 */
export function getTransitiveDependencies(
  index: GraphIndex,
  fileId: string,
): Map<string, { depth: number; path: string[] }> {
  return traverse(index.dependencies, fileId);
}

/**
 * BFS over incoming edges — files that transitively depend on this module.
 */
export function getTransitiveDependents(
  index: GraphIndex,
  fileId: string,
): Map<string, { depth: number; path: string[] }> {
  return traverse(index.dependents, fileId);
}

function traverse(
  adjacency: Map<string, string[]>,
  startId: string,
): Map<string, { depth: number; path: string[] }> {
  const result = new Map<string, { depth: number; path: string[] }>();
  const queue: Array<{ id: string; depth: number; path: string[] }> = [
    { id: startId, depth: 0, path: [startId] },
  ];
  const visited = new Set<string>([startId]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    const neighbors = adjacency.get(current.id) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      const path = [...current.path, neighbor];
      const depth = current.depth + 1;
      result.set(neighbor, { depth, path });
      queue.push({ id: neighbor, depth, path });
    }
  }

  return result;
}

/**
 * Highlight selected node plus its directly connected dependencies and
 * dependents. Edges are highlighted only when they are incident to the
 * selection (not merely because both endpoints happen to be in the set).
 */
export function computeSelectionHighlight(
  index: GraphIndex,
  selectedId: string | null,
): GraphSelectionHighlight {
  if (!selectedId || !index.filesById.has(selectedId)) {
    return {
      selectedId: null,
      highlightedNodeIds: new Set(),
      highlightedEdgeIds: new Set(),
      dependencyIds: new Set(),
      dependentIds: new Set(),
    };
  }

  const dependencyIds = new Set(getDirectDependencies(index, selectedId));
  const dependentIds = new Set(getDirectDependents(index, selectedId));
  const highlightedNodeIds = new Set<string>([
    selectedId,
    ...dependencyIds,
    ...dependentIds,
  ]);

  const highlightedEdgeIds = new Set<string>();
  for (const dep of dependencyIds) {
    const edge = index.edgeByPair.get(pairKey(selectedId, dep));
    if (edge) highlightedEdgeIds.add(edge.id);
  }
  for (const dependent of dependentIds) {
    const edge = index.edgeByPair.get(pairKey(dependent, selectedId));
    if (edge) highlightedEdgeIds.add(edge.id);
  }

  return {
    selectedId,
    highlightedNodeIds,
    highlightedEdgeIds,
    dependencyIds,
    dependentIds,
  };
}

function severityForDepth(
  depth: number,
  fanOut: number,
): ImpactSeverity {
  if (depth === 1 && fanOut >= 4) return "critical";
  if (depth === 1 && fanOut >= 2) return "high";
  if (depth === 1) return "medium";
  if (depth === 2) return "medium";
  return "low";
}

function overallSeverity(affected: AffectedFile[]): ImpactSeverity {
  if (affected.some((a) => a.severity === "critical")) return "critical";
  if (affected.some((a) => a.severity === "high")) return "high";
  if (affected.some((a) => a.severity === "medium")) return "medium";
  if (affected.length > 0) return "low";
  return "low";
}

function describeReason(
  file: SourceFile,
  selected: SourceFile,
  depth: number,
  pathIds: string[],
  filesById: Map<string, SourceFile>,
): string {
  if (depth === 1) {
    return `${file.name} directly imports ${selected.name}`;
  }

  const hops = pathIds
    .map((id) => filesById.get(id)?.name ?? id)
    .join(" → ");
  return `Indirect dependency via ${hops} (depth ${depth})`;
}

/**
 * Compute change-impact for a selected file using the dependency graph.
 * Results are labeled as simulated — not real static analysis.
 */
export function computeChangeImpact(
  graph: DependencyGraphData,
  selectedFileId: string,
): ChangeImpactResult | null {
  const index = buildGraphIndex(graph);
  const selectedFile = index.filesById.get(selectedFileId);
  if (!selectedFile) return null;

  const transitive = getTransitiveDependents(index, selectedFileId);
  const fanOut = getDirectDependents(index, selectedFileId).length;

  const affectedModules: AffectedFile[] = [];

  for (const [fileId, { depth, path }] of transitive) {
    const file = index.filesById.get(fileId);
    if (!file) continue;

    affectedModules.push({
      fileId,
      path: file.path,
      name: file.name,
      kind: file.kind,
      depth,
      reason: describeReason(file, selectedFile, depth, path, index.filesById),
      pathFromSource: path,
      severity: severityForDepth(depth, fanOut),
    });
  }

  affectedModules.sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));

  const directDependents = affectedModules.filter((a) => a.depth === 1);
  const transitiveDependents = affectedModules.filter((a) => a.depth > 1);
  const maxDepth = affectedModules.reduce(
    (max, a) => Math.max(max, a.depth),
    0,
  );

  return {
    selectedFileId,
    selectedFile,
    directDependents,
    transitiveDependents,
    maxDepth,
    affectedModules,
    overallSeverity: overallSeverity(affectedModules),
    provenance: "simulated",
    note: "Simulated impact based on mock dependency graph — not real code analysis.",
  };
}

export function getFileById(
  graph: DependencyGraphData,
  fileId: string,
): SourceFile | undefined {
  return graph.files.find((f) => f.id === fileId);
}
