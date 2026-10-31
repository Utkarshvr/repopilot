import type {
  AffectedFile,
  ChangeImpactResult,
  DependencyEdge,
  DependencyGraphData,
  GraphSelectionHighlight,
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
  circularDependencyGroups: string[][];
  circularGroupByFile: Map<string, string[]>;
}

function pairKey(source: string, target: string): string {
  return JSON.stringify([source, target]);
}

export function buildGraphIndex(graph: DependencyGraphData): GraphIndex {
  const filesById = new Map(graph.files.map((f) => [f.id, f]));
  const dependencies = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  const dependencySets = new Map<string, Set<string>>();
  const dependentSets = new Map<string, Set<string>>();
  const edgeByPair = new Map<string, DependencyEdge>();

  for (const file of graph.files) {
    dependencies.set(file.id, []);
    dependents.set(file.id, []);
    dependencySets.set(file.id, new Set());
    dependentSets.set(file.id, new Set());
  }

  for (const edge of graph.edges) {
    if (!filesById.has(edge.source) || !filesById.has(edge.target)) continue;
    dependencySets.get(edge.source)?.add(edge.target);
    dependentSets.get(edge.target)?.add(edge.source);
    if (!edgeByPair.has(pairKey(edge.source, edge.target))) edgeByPair.set(pairKey(edge.source, edge.target), edge);
  }

  for (const [id, neighbors] of dependencySets) dependencies.set(id, [...neighbors].sort((a, b) => a.localeCompare(b)));
  for (const [id, neighbors] of dependentSets) dependents.set(id, [...neighbors].sort((a, b) => a.localeCompare(b)));
  const circularDependencyGroups = findCircularGroups(dependencies, dependents);
  const circularGroupByFile = new Map<string, string[]>();
  for (const group of circularDependencyGroups) for (const id of group) circularGroupByFile.set(id, group);

  return {
    filesById,
    dependencies,
    dependents,
    edges: graph.edges,
    edgeByPair,
    circularDependencyGroups,
    circularGroupByFile,
  };
}

export function getDirectDependencies(
  index: GraphIndex,
  fileId: string,
): string[] {
  return [...(index.dependencies.get(fileId) ?? [])];
}

export function getDirectDependents(
  index: GraphIndex,
  fileId: string,
): string[] {
  return [...(index.dependents.get(fileId) ?? [])];
}

export function getDependencyPath(index: GraphIndex, fromId: string, toId: string): string[] | null {
  if (!index.filesById.has(fromId) || !index.filesById.has(toId)) return null;
  if (fromId === toId) return [fromId];
  const previous = new Map<string, string | null>([[fromId, null]]);
  const queue = [fromId];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
    for (const next of index.dependencies.get(current) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      if (next === toId) {
        const path = [toId];
        let parent: string | null = current;
        while (parent !== null) {
          path.push(parent);
          parent = previous.get(parent) ?? null;
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}

export function getCircularDependencyGroup(index: GraphIndex, fileId: string): string[] | null {
  return index.circularGroupByFile.get(fileId) ?? null;
}

/** Iterative Kosaraju SCC detection avoids call-stack limits on deep repositories. */
function findCircularGroups(
  dependencies: Map<string, string[]>,
  dependents: Map<string, string[]>,
): string[][] {
  const visited = new Set<string>();
  const finishOrder: string[] = [];
  const ids = [...dependencies.keys()].sort((a, b) => a.localeCompare(b));
  for (const root of ids) {
    if (visited.has(root)) continue;
    visited.add(root);
    const stack: Array<{ id: string; next: number }> = [{ id: root, next: 0 }];
    while (stack.length) {
      const frame = stack[stack.length - 1];
      const neighbors = dependencies.get(frame.id) ?? [];
      if (frame.next < neighbors.length) {
        const next = neighbors[frame.next++];
        if (!visited.has(next)) {
          visited.add(next);
          stack.push({ id: next, next: 0 });
        }
      } else {
        finishOrder.push(frame.id);
        stack.pop();
      }
    }
  }

  visited.clear();
  const groups: string[][] = [];
  for (let i = finishOrder.length - 1; i >= 0; i--) {
    const root = finishOrder[i];
    if (visited.has(root)) continue;
    const group: string[] = [];
    const stack = [root];
    visited.add(root);
    while (stack.length) {
      const id = stack.pop()!;
      group.push(id);
      for (const next of dependents.get(id) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        stack.push(next);
      }
    }
    group.sort((a, b) => a.localeCompare(b));
    if (group.length > 1 || (dependencies.get(root) ?? []).includes(root)) groups.push(group);
  }
  return groups.sort((a, b) => a[0].localeCompare(b[0]));
}

export interface DependencyGraphStatistics {
  totalInternalFiles: number;
  totalInternalEdges: number;
  filesWithNoDependencies: string[];
  filesWithNoDependents: string[];
  mostImportedFiles: Array<{ fileId: string; dependentCount: number }>;
  highestDependencyCounts: Array<{ fileId: string; dependencyCount: number }>;
  circularDependencyGroups: string[][];
}

export function getDependencyGraphStatistics(index: GraphIndex): DependencyGraphStatistics {
  const byCount = (a: { fileId: string; count: number }, b: { fileId: string; count: number }) =>
    b.count - a.count || a.fileId.localeCompare(b.fileId);
  const imports = [...index.dependencies].map(([fileId, neighbors]) => ({ fileId, count: neighbors.length }));
  const dependents = [...index.dependents].map(([fileId, neighbors]) => ({ fileId, count: neighbors.length }));
  return {
    totalInternalFiles: index.filesById.size,
    totalInternalEdges: index.edgeByPair.size,
    filesWithNoDependencies: imports.filter((item) => item.count === 0).map((item) => item.fileId).sort(),
    filesWithNoDependents: dependents.filter((item) => item.count === 0).map((item) => item.fileId).sort(),
    mostImportedFiles: dependents.filter((item) => item.count > 0).sort(byCount).slice(0, 10)
      .map(({ fileId, count }) => ({ fileId, dependentCount: count })),
    highestDependencyCounts: imports.filter((item) => item.count > 0).sort(byCount).slice(0, 10)
      .map(({ fileId, count }) => ({ fileId, dependencyCount: count })),
    circularDependencyGroups: index.circularDependencyGroups,
  };
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

export function getReachableNodeIds(index: GraphIndex, fileId: string, direction: "dependencies" | "dependents"): Set<string> {
  const adjacency = direction === "dependencies" ? index.dependencies : index.dependents;
  const visited = new Set<string>();
  const queue = [fileId];
  if (!adjacency.has(fileId)) return visited;
  visited.add(fileId);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const next of adjacency.get(queue[cursor]) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  visited.delete(fileId);
  return visited;
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

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor];
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
  mode: "dependencies" | "dependents" | "neighborhood" = "neighborhood",
): GraphSelectionHighlight {
  if (!selectedId || !index.filesById.has(selectedId)) {
    return {
      selectedId: null,
      highlightedNodeIds: new Set(),
      highlightedEdgeIds: new Set(),
      dependencyIds: new Set(),
      dependentIds: new Set(),
      transitiveDependencyIds: new Set(),
      transitiveDependentIds: new Set(),
    };
  }

  const dependencyIds = new Set(getDirectDependencies(index, selectedId));
  const dependentIds = new Set(getDirectDependents(index, selectedId));
  const transitiveDependencyIds = getReachableNodeIds(index, selectedId, "dependencies");
  const transitiveDependentIds = getReachableNodeIds(index, selectedId, "dependents");
  const highlightedNodeIds = new Set<string>([selectedId]);
  if (mode !== "dependents") for (const id of transitiveDependencyIds) highlightedNodeIds.add(id);
  if (mode !== "dependencies") for (const id of transitiveDependentIds) highlightedNodeIds.add(id);
  const highlightedEdgeIds = new Set<string>();
  for (const edge of index.edges) {
    if (highlightedNodeIds.has(edge.source) && highlightedNodeIds.has(edge.target)) highlightedEdgeIds.add(edge.id);
  }

  return {
    selectedId,
    highlightedNodeIds,
    highlightedEdgeIds,
    dependencyIds,
    dependentIds,
    transitiveDependencyIds,
    transitiveDependentIds,
  };
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
 * Results describe dependency reachability in the supplied graph.
 */
export function computeChangeImpact(
  graph: DependencyGraphData,
  selectedFileId: string,
): ChangeImpactResult | null {
  const index = buildGraphIndex(graph);
  const selectedFile = index.filesById.get(selectedFileId);
  if (!selectedFile) return null;

  const transitive = getTransitiveDependents(index, selectedFileId);

  const affectedModules: AffectedFile[] = [];

  for (const [fileId, { depth, path }] of transitive) {
    const file = index.filesById.get(fileId);
    if (!file) continue;

    const dependencyPath = [...path].reverse();
    affectedModules.push({
      fileId,
      path: file.path,
      name: file.name,
      kind: file.kind,
      depth,
      reason: describeReason(file, selectedFile, depth, dependencyPath, index.filesById),
      pathFromSource: path,
      dependencyPath: dependencyPath.map((id) => index.filesById.get(id)?.path ?? id),
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
    totalAffected: affectedModules.length,
    provenance: graph.provenance,
    note: "Affected files are calculated by traversing incoming dependency edges. This shows dependency reachability, not runtime behavior or risk.",
  };
}

export function getFileById(
  graph: DependencyGraphData,
  fileId: string,
): SourceFile | undefined {
  return graph.files.find((f) => f.id === fileId);
}
