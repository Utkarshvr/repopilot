import type { ResolvedImport } from "@/types/analysis";
import type {
  DependencyGraphData,
  DependencyEdge,
  FileKind,
  SourceFile,
} from "@/types";
import { getExtension, getFileName } from "./fileFilter";

/**
 * Determine a coarse file "kind" from its path and extension.
 * This is a heuristic; not semantically precise.
 */
function inferFileKind(path: string): FileKind {
  const p = path.toLowerCase();
  if (p.includes("/store") || p.includes("/stores") || p.includes("store.ts") || p.includes("slice.ts")) return "store";
  if (p.includes("/pages/") || p.endsWith("page.tsx") || p.endsWith("page.ts")) return "page";
  if (p.includes("/layouts/") || p.includes("/layout/")) return "layout";
  if (p.includes("/components/") || p.includes("/ui/")) return "component";
  if (p.includes("/lib/") || p.includes("/utils/") || p.includes("/helpers/") || p.includes("/util/")) return "utility";
  if (p.includes("main.ts") || p.includes("main.tsx") || p.includes("index.ts") || p.includes("index.tsx")) return "entry";
  if (p.includes("/data/") || p.includes("/mock") || p.includes("fixtures")) return "data";
  return "utility";
}

function inferLanguage(path: string): SourceFile["language"] {
  const ext = getExtension(path);
  if (ext === ".tsx") return "TSX";
  if (ext === ".ts") return "TypeScript";
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs" || ext === ".jsx") return "JavaScript";
  return "TypeScript";
}

/** Simple auto-layout: place nodes in a grid */
function autoLayout(
  fileIds: string[],
): Record<string, { x: number; y: number }> {
  const cols = Math.max(1, Math.ceil(Math.sqrt(fileIds.length)));
  const positions: Record<string, { x: number; y: number }> = {};
  fileIds.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[id] = {
      x: col * 220 + (row % 2 === 0 ? 0 : 110),
      y: row * 120,
    };
  });
  return positions;
}

/**
 * Build a `DependencyGraphData` from resolved imports.
 *
 * Only internal (resolved) imports create edges. Importer → dependency is the
 * single direction used throughout the graph service and UI. External and
 * unresolved imports remain available on the analysis result, outside topology.
 */
export function buildDependencyGraph(
  filePaths: string[],
  resolvedImports: ResolvedImport[],
  repositoryId: string,
  fileSizes: Record<string, number> = {},
): DependencyGraphData {
  // Count outgoing (dependency) and incoming (dependent) edges per file
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();

  for (const path of filePaths) {
    outgoing.set(path, 0);
    incoming.set(path, 0);
  }

  const rawEdges: Array<{ source: string; target: string; imp: ResolvedImport }> = [];

  for (const imp of resolvedImports) {
    if (imp.status !== "resolved" || !imp.resolvedPath) continue;

    const source = imp.importingFile;
    const target = imp.resolvedPath;

    // Both must exist in our file set
    if (!outgoing.has(source) || !incoming.has(target)) continue;
    rawEdges.push({ source, target, imp });
  }

  // A relationship is one unique importer/dependency pair. Repeated import
  // statements do not inflate graph statistics or create parallel edges.
  rawEdges.sort((a, b) => a.source.localeCompare(b.source) || a.target.localeCompare(b.target) ||
    a.imp.line - b.imp.line || a.imp.column - b.imp.column || a.imp.specifier.localeCompare(b.imp.specifier));
  const uniqueEdges = rawEdges.filter((edge, index) => index === 0 ||
    edge.source !== rawEdges[index - 1].source || edge.target !== rawEdges[index - 1].target);

  const outgoingFiles = new Map<string, Set<string>>();
  const incomingFiles = new Map<string, Set<string>>();
  for (const { source, target } of uniqueEdges) {
    if (!outgoingFiles.has(source)) outgoingFiles.set(source, new Set());
    if (!incomingFiles.has(target)) incomingFiles.set(target, new Set());
    outgoingFiles.get(source)?.add(target);
    incomingFiles.get(target)?.add(source);
  }
  for (const [path, targets] of outgoingFiles) outgoing.set(path, targets.size);
  for (const [path, sources] of incomingFiles) incoming.set(path, sources.size);

  const files: SourceFile[] = filePaths.map((path) => ({
    id: path,
    name: getFileName(path),
    path,
    kind: inferFileKind(path),
    language: inferLanguage(path),
    dependencyCount: outgoing.get(path) ?? 0,
    dependentCount: incoming.get(path) ?? 0,
    extension: getExtension(path),
    size: fileSizes[path],
  }));

  const edges: DependencyEdge[] = uniqueEdges.map(({ source, target, imp }, i) => ({
    id: `e-${i}`,
    source,
    target,
    specifier: imp.specifier,
    importedSymbols: imp.importedSymbols,
    importKind: imp.kind,
    line: imp.line,
    column: imp.column,
  }));

  const fileIds = filePaths;
  const positions = autoLayout(fileIds);

  return {
    repositoryId,
    provenance: "analyzed",
    generatedAt: new Date().toISOString(),
    note: `Analyzed ${files.length} source files, ${edges.length} internal dependencies.`,
    files,
    edges,
    positions,
  };
}
