import type { DependencyGraphData, SourceFile } from "@/types";
import type { AnalyzedRepository, ResolvedImport } from "@/types/analysis";
import type { ChangeSet, ChangedFile, ChangedFileStatus } from "@/types/changes";
import { buildGraphIndex, getShortestDependencyPaths, getTransitiveDependentDistances, type GraphIndex } from "@/lib/graph";

export interface ImpactGraphSnapshot {
  graph: DependencyGraphData;
  role: "base" | "head" | "current";
  label?: string;
  revision?: { ref: string | null; commitSha: string | null; treeSha: string | null };
  complete?: boolean;
  limitations?: string[];
}

export interface ImpactAnalysisInput {
  changeSet: ChangeSet;
  currentGraph?: ImpactGraphSnapshot;
  baseGraph?: ImpactGraphSnapshot;
  headGraph?: ImpactGraphSnapshot;
  unresolvedImports?: ResolvedImport[];
}

export type ImpactRiskLevel = "low" | "medium" | "high" | "critical";
export type ImpactScope = "direct" | "transitive";

export interface ImpactRiskConfig {
  thresholds: { medium: number; high: number; critical: number };
  caps: { directDependents: number; transitiveDependents: number; dependencyFanOut: number; depth: number; alternatePaths: number };
  weights: { directDependents: number; transitiveDependents: number; dependencyFanOut: number; depth: number; circular: number; alternatePaths: number };
}

export const DEFAULT_IMPACT_RISK_CONFIG: ImpactRiskConfig = {
  thresholds: { medium: 25, high: 50, critical: 75 },
  caps: { directDependents: 8, transitiveDependents: 25, dependencyFanOut: 12, depth: 8, alternatePaths: 5 },
  weights: { directDependents: 25, transitiveDependents: 20, dependencyFanOut: 15, depth: 10, circular: 15, alternatePaths: 15 },
} as const;

export interface ImpactRiskFactor {
  key: keyof typeof DEFAULT_IMPACT_RISK_CONFIG.weights;
  label: string;
  contribution: number;
  explanation: string;
}

export interface ImpactRiskAssessment {
  score: number;
  level: ImpactRiskLevel;
  factors: ImpactRiskFactor[];
  note: string;
}

export interface ImpactPathExplanation {
  changedFileId: string;
  changedPath: string;
  graphRole: "base" | "head" | "current";
  graphLabel: string;
  paths: string[][];
  additionalPathsTruncated: boolean;
}

export interface ImpactAffectedFile {
  path: string;
  scope: ImpactScope;
  distance: number;
  responsibleChangeIds: string[];
  responsibleChangedPaths: string[];
  dependencyPaths: ImpactPathExplanation[];
  circularDependencyGroup: string[] | null;
  graphMetadata: SourceFile;
  riskLevel: ImpactRiskLevel;
  riskScore: number;
}

export type ImpactExclusionReason = "not-selected" | "unsupported-file-type" | "missing-changed-file-node" | "required-revision-graph-unavailable";
export interface ImpactExcludedChange {
  changeId: string;
  path: string;
  reason: ImpactExclusionReason;
  detail: string;
}

export interface PerChangeImpact {
  changeId: string;
  originalPath: string | null;
  currentPath: string;
  status: ChangedFileStatus;
  directDependents: string[];
  transitiveDependents: string[];
  totalAffectedFiles: number;
  analysisLimitations: string[];
  graphRevisionsUsed: string[];
  risk: ImpactRiskAssessment;
}

export interface ImpactReport {
  changeSetId: string;
  repositoryId: string;
  repositoryFullName: string;
  baseRevision: string | null;
  headRevision: string | null;
  generatedAt: string;
  summary: {
    changedFilesCount: number;
    detectedChangedFilesCount: number;
    directlyAffectedFilesCount: number;
    transitivelyAffectedFilesCount: number;
    totalUniqueAffectedFiles: number;
    unresolvedImpactRelationships: number;
    filesExcludedFromImpactAnalysis: number;
    graphRevisionUsed: string;
    graphRevisionVerified: boolean;
    analysisComplete: boolean;
    completeness: "complete" | "partial" | "unavailable";
  };
  risk: ImpactRiskAssessment;
  affectedFiles: ImpactAffectedFile[];
  perChange: PerChangeImpact[];
  exclusions: ImpactExcludedChange[];
  limitations: string[];
}

interface IndexedSnapshot {
  snapshot: ImpactGraphSnapshot;
  index: GraphIndex;
  role: "base" | "head" | "current";
  verified: boolean;
}

interface MutableAffected {
  path: string;
  graphMetadata: SourceFile;
  circularDependencyGroup: string[] | null;
  shortestDistance: number;
  direct: boolean;
  responsible: Map<string, { changedPath: string; graphRole: "base" | "head" | "current"; graphLabel: string; paths: string[][]; truncated: boolean }>;
}

function changeId(file: ChangedFile): string {
  return `${file.status}:${file.previousPath ?? ""}->${file.path}`;
}

function graphRevision(snapshot: ImpactGraphSnapshot) {
  return snapshot.revision ?? snapshot.graph.revision ?? { ref: null, commitSha: null, treeSha: null };
}

function revisionMatch(snapshot: ImpactGraphSnapshot, changeSet: ChangeSet): "base" | "head" | null {
  const revision = graphRevision(snapshot);
  if (revision.commitSha && revision.commitSha === changeSet.baseSha) return "base";
  if (revision.commitSha && revision.commitSha === changeSet.headSha) return "head";
  if (revision.treeSha && revision.treeSha === changeSet.baseTreeSha) return "base";
  if (revision.treeSha && revision.treeSha === changeSet.headTreeSha) return "head";
  return null;
}

function makeSnapshots(input: ImpactAnalysisInput): { snapshots: IndexedSnapshot[]; currentRole: "base" | "head" | null; verified: boolean } {
  const raw: ImpactGraphSnapshot[] = [];
  if (input.baseGraph) raw.push({ ...input.baseGraph, role: "base" });
  if (input.headGraph) raw.push({ ...input.headGraph, role: "head" });
  if (input.currentGraph) raw.push(input.currentGraph);
  const snapshots: IndexedSnapshot[] = [];
  let currentRole: "base" | "head" | null = null;
  let currentVerified = false;
  for (const snapshot of raw) {
    const match = revisionMatch(snapshot, input.changeSet);
    const hasRevision = Boolean(graphRevision(snapshot).commitSha || graphRevision(snapshot).treeSha);
    const isExplicit = (snapshot.role === "base" && input.baseGraph != null) || (snapshot.role === "head" && input.headGraph != null);
    const isCurrent = snapshot === input.currentGraph;
    const verified = match != null || (isCurrent && input.changeSet.source === "manual");
    const assignedRole = isExplicit && (match == null || match === snapshot.role)
      ? snapshot.role
      : isCurrent && input.changeSet.source === "manual" ? "current" : match ?? "current";
    if (isCurrent) {
      currentRole = match;
      currentVerified = verified;
      // Manual selections are created from the selected graph itself; its stored tree identity pins that snapshot.
      if (input.changeSet.source === "manual" && input.changeSet.headTreeSha && graphRevision(snapshot).treeSha === input.changeSet.headTreeSha) {
        currentRole = "head";
        currentVerified = true;
      }
      if (!match && !hasRevision && snapshot.role === "current") currentVerified = false;
    }
    snapshots.push({ snapshot, index: buildGraphIndex(snapshot.graph), role: assignedRole, verified });
  }
  return { snapshots, currentRole, verified: currentVerified };
}

function graphLabel(snapshot: IndexedSnapshot): string {
  const revision = graphRevision(snapshot.snapshot);
  const ref = revision.ref ? `ref ${revision.ref}` : "ref unknown";
  const sha = revision.commitSha ? `commit ${revision.commitSha.slice(0, 12)}` : revision.treeSha ? `tree ${revision.treeSha.slice(0, 12)}` : "revision unknown";
  return snapshot.snapshot.label ?? `${snapshot.role} graph (${ref}, ${sha}${snapshot.verified ? ", verified" : ", unverified"})`;
}

function getSnapshotForRole(
  snapshots: IndexedSnapshot[],
  role: "base" | "head" | "current",
  currentRole: "base" | "head" | null,
): IndexedSnapshot | undefined {
  const exact = role === "current"
    ? snapshots.find((item) => item.snapshot.role === "current")
    : snapshots.find((item) => item.role === role);
  if (exact) return exact;
  // An unknown current snapshot can be used as a best effort for both sides,
  // but it remains explicitly unverified. A verified base/head snapshot is never misused for the other side.
  return snapshots.find((item) => item.snapshot.role === "current" && currentRole == null);
}

function pathsForChange(file: ChangedFile): Array<{ role: "base" | "head" | "current"; path: string }> {
  switch (file.status) {
    case "removed": return [{ role: "base", path: file.previousPath ?? file.path }];
    case "added":
    case "copied": return [{ role: "head", path: file.path }];
    case "renamed": return [
      { role: "base", path: file.previousPath ?? file.path },
      { role: "head", path: file.path },
    ];
    case "selected": return [{ role: "current", path: file.path }];
    case "modified":
    case "other": return [{ role: "base", path: file.path }, { role: "head", path: file.path }];
  }
}

function riskLevel(score: number, thresholds = DEFAULT_IMPACT_RISK_CONFIG.thresholds): ImpactRiskLevel {
  if (score >= thresholds.critical) return "critical";
  if (score >= thresholds.high) return "high";
  if (score >= thresholds.medium) return "medium";
  return "low";
}

export function assessStructuralRisk(
  metrics: { directDependents: number; transitiveDependents: number; dependencyFanOut: number; maxDepth: number; circular: boolean; alternatePaths: number },
  config: ImpactRiskConfig = DEFAULT_IMPACT_RISK_CONFIG,
): ImpactRiskAssessment {
  const scale = (value: number, cap: number) => Math.min(1, Math.max(0, value) / cap);
  const factors: ImpactRiskFactor[] = ([
    { key: "directDependents", label: "Direct dependents", contribution: scale(metrics.directDependents, config.caps.directDependents) * config.weights.directDependents, explanation: `${metrics.directDependents} directly dependent file(s), capped at ${config.caps.directDependents} for scoring.` },
    { key: "transitiveDependents", label: "Transitive reach", contribution: scale(metrics.transitiveDependents, config.caps.transitiveDependents) * config.weights.transitiveDependents, explanation: `${metrics.transitiveDependents} additional transitive file(s), capped at ${config.caps.transitiveDependents}.` },
    { key: "dependencyFanOut", label: "Dependency fan-out", contribution: scale(metrics.dependencyFanOut, config.caps.dependencyFanOut) * config.weights.dependencyFanOut, explanation: `The changed module imports ${metrics.dependencyFanOut} distinct internal file(s), capped at ${config.caps.dependencyFanOut}.` },
    { key: "depth", label: "Dependency depth", contribution: scale(metrics.maxDepth, config.caps.depth) * config.weights.depth, explanation: `The deepest affected path has ${metrics.maxDepth} hop(s), capped at ${config.caps.depth}.` },
    { key: "circular", label: "Circular dependency", contribution: metrics.circular ? config.weights.circular : 0, explanation: metrics.circular ? "The changed file participates in a strongly connected dependency group." : "The changed file is not in a detected circular group." },
    { key: "alternatePaths", label: "Independent paths", contribution: scale(metrics.alternatePaths, config.caps.alternatePaths) * config.weights.alternatePaths, explanation: `${metrics.alternatePaths} additional shortest path(s) were found, capped at ${config.caps.alternatePaths}.` },
  ] as ImpactRiskFactor[]).map((factor) => ({ ...factor, contribution: Math.round(factor.contribution * 100) / 100 }));
  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, factor) => sum + factor.contribution, 0))));
  return {
    score,
    level: riskLevel(score, config.thresholds),
    factors,
    note: "Structural risk estimate based on graph shape. It is not a probability of runtime failure.",
  };
}

function isSourceChange(file: ChangedFile): boolean {
  return file.classification === "source";
}

export function analyzeChangeImpact(input: ImpactAnalysisInput): ImpactReport {
  const { changeSet } = input;
  const { snapshots, currentRole, verified: currentVerified } = makeSnapshots(input);
  const allDetectedPaths = new Set(changeSet.files.flatMap((file) => [file.path, file.previousPath].filter((path): path is string => Boolean(path))));
  const exclusions: ImpactExcludedChange[] = [];
  const limitations: string[] = [];
  const mutableAffected = new Map<string, MutableAffected>();
  const mutablePerChange = new Map<string, {
    file: ChangedFile; direct: Set<string>; transitive: Set<string>; limitations: string[]; graphLabels: Set<string>;
    maxDepth: number; fanOut: number; circular: boolean; alternatePathKeys: Set<string>;
  }>();
  const usedSnapshots = new Set<IndexedSnapshot>();
  const selectedFiles = changeSet.files.filter((file) => file.selectedForImpact);
  const unresolvedImports = input.unresolvedImports ?? [];
  const processedTargetGraphs = new Set<string>();

  for (const file of changeSet.files) {
    const id = changeId(file);
    const perChange = { file, direct: new Set<string>(), transitive: new Set<string>(), limitations: [] as string[], graphLabels: new Set<string>(), maxDepth: 0, fanOut: 0, circular: false, alternatePathKeys: new Set<string>() };
    mutablePerChange.set(id, perChange);
    if (!file.selectedForImpact) {
      exclusions.push({ changeId: id, path: file.path, reason: "not-selected", detail: "This detected change was not selected for the impact analysis." });
      continue;
    }
    if (!isSourceChange(file)) {
      const detail = `Classified as ${file.classification}; only JS/TS source files can participate in source-level graph analysis.`;
      exclusions.push({ changeId: id, path: file.path, reason: "unsupported-file-type", detail });
      perChange.limitations.push(detail);
      continue;
    }

    let analyzedAnyPath = false;
    for (const target of pathsForChange(file)) {
      const candidate = target.role === "current"
        ? getSnapshotForRole(snapshots, "current", currentRole)
        : getSnapshotForRole(snapshots, target.role, currentRole);
      if (!candidate) {
        const detail = `A ${target.role} revision graph is unavailable for ${target.path}.`;
        exclusions.push({ changeId: id, path: target.path, reason: "required-revision-graph-unavailable", detail });
        perChange.limitations.push(detail);
        continue;
      }
      const sourceFile = candidate.index.filesById.get(target.path);
      if (!sourceFile) {
        const detail = `${target.path} is not present in the ${candidate.role} graph (${graphLabel(candidate)}).`;
        exclusions.push({ changeId: id, path: target.path, reason: "missing-changed-file-node", detail });
        perChange.limitations.push(detail);
        continue;
      }

      const targetGraphKey = `${changeId(file)}\0${target.path}\0${candidate.role}\0${candidate.snapshot.graph.generatedAt}`;
      if (processedTargetGraphs.has(targetGraphKey)) continue;
      processedTargetGraphs.add(targetGraphKey);

      analyzedAnyPath = true;
      usedSnapshots.add(candidate);
      perChange.graphLabels.add(graphLabel(candidate));
      perChange.fanOut = Math.max(perChange.fanOut, sourceFile.dependencyCount);
      const cycleGroup = candidate.index.circularGroupByFile.get(target.path) ?? null;
      perChange.circular ||= cycleGroup != null;
      const dependents = getTransitiveDependentDistances(candidate.index, target.path);

      for (const [affectedPath, depth] of dependents) {
        if (allDetectedPaths.has(affectedPath)) continue;
        const affectedFile = candidate.index.filesById.get(affectedPath);
        if (!affectedFile) continue;
        const shortest = getShortestDependencyPaths(candidate.index, affectedPath, target.path, 3, dependents);
        if (shortest.paths.length === 0) continue;
        const key = `${id}\0${target.path}\0${candidate.role}\0${affectedPath}`;
        let affected = mutableAffected.get(affectedPath);
        if (!affected) {
          affected = {
            path: affectedPath,
            graphMetadata: affectedFile,
            circularDependencyGroup: candidate.index.circularGroupByFile.get(affectedPath) ?? null,
            shortestDistance: depth,
            direct: depth === 1,
            responsible: new Map(),
          };
          mutableAffected.set(affectedPath, affected);
        } else {
          affected.shortestDistance = Math.min(affected.shortestDistance, depth);
          affected.direct ||= depth === 1;
          if (!affected.circularDependencyGroup) affected.circularDependencyGroup = candidate.index.circularGroupByFile.get(affectedPath) ?? null;
        }
        affected.responsible.set(key, { changedPath: target.path, graphRole: candidate.role, graphLabel: graphLabel(candidate), paths: shortest.paths, truncated: shortest.truncated });
        if (depth === 1) perChange.direct.add(affectedPath);
        else perChange.transitive.add(affectedPath);
        perChange.maxDepth = Math.max(perChange.maxDepth, depth);
        for (const path of shortest.paths.slice(1)) perChange.alternatePathKeys.add(path.join("\0"));
      }
    }
    if (!analyzedAnyPath && perChange.limitations.length === 0) {
      const detail = "No graph snapshot could be used for this changed source file.";
      perChange.limitations.push(detail);
      exclusions.push({ changeId: id, path: file.path, reason: "required-revision-graph-unavailable", detail });
    }
  }

  const affectedFiles = [...mutableAffected.values()].map((affected) => {
    const dependencyPaths: ImpactPathExplanation[] = [];
    const responsibleChangeIds = new Set<string>();
    const responsibleChangedPaths = new Set<string>();
    let riskScore = 0;
    for (const [key, responsible] of affected.responsible) {
      const [id] = key.split("\0");
      responsibleChangeIds.add(id);
      responsibleChangedPaths.add(responsible.changedPath);
      dependencyPaths.push({
        changedFileId: id,
        changedPath: responsible.changedPath,
        graphRole: responsible.graphRole,
        graphLabel: responsible.graphLabel,
        paths: responsible.paths,
        additionalPathsTruncated: responsible.truncated,
      });
      const perChange = mutablePerChange.get(id);
      if (perChange) {
        const assessment = assessStructuralRisk({
          directDependents: perChange.direct.size,
          transitiveDependents: perChange.transitive.size,
          dependencyFanOut: perChange.fanOut,
          maxDepth: perChange.maxDepth,
          circular: perChange.circular,
          alternatePaths: perChange.alternatePathKeys.size,
        });
        riskScore = Math.max(riskScore, assessment.score);
      }
    }
    dependencyPaths.sort((a, b) => a.changedPath.localeCompare(b.changedPath) || a.graphRole.localeCompare(b.graphRole));
    const risk = riskLevel(riskScore);
    return {
      path: affected.path,
      scope: affected.direct ? "direct" as const : "transitive" as const,
      distance: affected.shortestDistance,
      responsibleChangeIds: [...responsibleChangeIds].sort(),
      responsibleChangedPaths: [...responsibleChangedPaths].sort(),
      dependencyPaths,
      circularDependencyGroup: affected.circularDependencyGroup,
      graphMetadata: affected.graphMetadata,
      riskLevel: risk,
      riskScore,
    };
  }).sort((a, b) => a.distance - b.distance || a.path.localeCompare(b.path));

  const directPaths = new Set(affectedFiles.filter((file) => file.scope === "direct").map((file) => file.path));
  const transitivePaths = new Set(affectedFiles.filter((file) => file.scope === "transitive").map((file) => file.path));
  const perChange: PerChangeImpact[] = [...mutablePerChange.entries()].map(([id, item]) => {
    const assessment = assessStructuralRisk({
      directDependents: item.direct.size,
      transitiveDependents: item.transitive.size,
      dependencyFanOut: item.fanOut,
      maxDepth: item.maxDepth,
      circular: item.circular,
      alternatePaths: item.alternatePathKeys.size,
    });
    return {
      changeId: id,
      originalPath: item.file.previousPath,
      currentPath: item.file.path,
      status: item.file.status,
      directDependents: [...item.direct].sort(),
      transitiveDependents: [...item.transitive].filter((path) => !item.direct.has(path)).sort(),
      totalAffectedFiles: new Set([...item.direct, ...item.transitive]).size,
      analysisLimitations: [...new Set(item.limitations)],
      graphRevisionsUsed: [...item.graphLabels].sort(),
      risk: assessment,
    };
  });

  if (!snapshots.length) limitations.push("No dependency graph is available for this repository.");
  for (const snapshot of usedSnapshots) {
    if (snapshot.snapshot.complete === false) {
      limitations.push(`${graphLabel(snapshot)} is incomplete${snapshot.snapshot.limitations?.length ? `: ${snapshot.snapshot.limitations.join("; ")}` : "."}`);
    }
  }
  const explicitBaseVerifiedForReport = snapshots.some((item) => item.snapshot.role === "base" && item.verified);
  const explicitHeadVerifiedForReport = snapshots.some((item) => item.snapshot.role === "head" && item.verified);
  if (input.changeSet.source === "github-comparison" && input.currentGraph && !currentVerified && !(explicitBaseVerifiedForReport && explicitHeadVerifiedForReport)) {
    limitations.push("The stored graph revision could not be verified against the GitHub comparison’s base or head tree. Results use the available graph only where paths exist.");
  }
  if ([...usedSnapshots].some((item) => item.snapshot.role !== "current" && !item.verified)) {
    limitations.push("At least one supplied base/head graph snapshot could not be verified against the comparison revision.");
  }
  if (!changeSet.isComplete && changeSet.completenessWarning) limitations.push(changeSet.completenessWarning);
  if (unresolvedImports.length) limitations.push(`${unresolvedImports.length} unresolved import(s) may conceal dependency relationships not present in the graph.`);
  if (exclusions.some((item) => item.reason === "unsupported-file-type")) limitations.push("Some selected changes are metadata, documentation, binary, or otherwise unsupported source types.");
  if (exclusions.some((item) => item.reason === "missing-changed-file-node")) limitations.push("Some changed source paths are absent from the graph snapshot used for this analysis.");
  if (exclusions.some((item) => item.reason === "required-revision-graph-unavailable")) limitations.push("A required base or head revision graph is unavailable; those changes could not be analyzed on the correct side of the comparison.");

  const unresolvedSet = new Set(unresolvedImports.map((item) => `${item.importingFile}\0${item.specifier}`));
  const allChangePathsAnalyzed = selectedFiles.every((file) => {
    if (!isSourceChange(file)) return false;
    const id = changeId(file);
    return !exclusions.some((excluded) => excluded.changeId === id && excluded.reason !== "not-selected");
  });
  const explicitBase = snapshots.find((item) => item.snapshot.role === "base");
  const explicitHead = snapshots.find((item) => item.snapshot.role === "head");
  const usedGraphsVerified = [...usedSnapshots].every((item) => item.verified);
  const verified = input.changeSet.source === "manual"
    ? Boolean(input.currentGraph)
    : currentVerified || (usedSnapshots.size > 0 && usedGraphsVerified) || Boolean(explicitBase?.verified && explicitHead?.verified);
  const usedSnapshotsComplete = [...usedSnapshots].every((item) => item.snapshot.complete !== false);
  const analysisComplete = snapshots.length > 0 && verified && usedSnapshotsComplete && changeSet.isComplete && unresolvedSet.size === 0 && allChangePathsAnalyzed && exclusions.every((item) => item.reason === "not-selected");
  const completeness = snapshots.length === 0 ? "unavailable" : analysisComplete ? "complete" : "partial";

  const risk = assessStructuralRisk({
    directDependents: directPaths.size,
    transitiveDependents: [...transitivePaths].filter((path) => !directPaths.has(path)).length,
    dependencyFanOut: Math.max(0, ...[...mutablePerChange.values()].map((item) => item.fanOut)),
    maxDepth: Math.max(0, ...affectedFiles.map((file) => file.distance)),
    circular: [...mutablePerChange.values()].some((item) => item.circular) || affectedFiles.some((file) => file.circularDependencyGroup != null),
    alternatePaths: [...mutablePerChange.values()].reduce((sum, item) => sum + item.alternatePathKeys.size, 0),
  });

  const graphRevisionUsed = usedSnapshots.size
    ? [...usedSnapshots].map(graphLabel).sort().join("; ")
    : snapshots.length ? "No graph nodes matched the selected changes" : "No graph available";

  return {
    changeSetId: changeSet.id,
    repositoryId: changeSet.repositoryId,
    repositoryFullName: changeSet.repositoryFullName,
    baseRevision: changeSet.baseRevision,
    headRevision: changeSet.headRevision,
    generatedAt: new Date().toISOString(),
    summary: {
      changedFilesCount: selectedFiles.length,
      detectedChangedFilesCount: changeSet.files.length,
      directlyAffectedFilesCount: directPaths.size,
      transitivelyAffectedFilesCount: [...transitivePaths].filter((path) => !directPaths.has(path)).length,
      totalUniqueAffectedFiles: affectedFiles.length,
      unresolvedImpactRelationships: unresolvedSet.size,
      filesExcludedFromImpactAnalysis: new Set(exclusions.filter((item) => item.reason !== "not-selected").map((item) => item.changeId)).size,
      graphRevisionUsed,
      graphRevisionVerified: verified,
      analysisComplete,
      completeness,
    },
    risk,
    affectedFiles,
    perChange: perChange.sort((a, b) => a.currentPath.localeCompare(b.currentPath) || a.status.localeCompare(b.status)),
    exclusions,
    limitations: [...new Set(limitations)],
  };
}

export function currentGraphSnapshot(analyzed: AnalyzedRepository): ImpactGraphSnapshot {
  return {
    graph: analyzed.graph,
    role: "current",
    revision: analyzed.graph.revision ?? { ref: analyzed.branch, commitSha: null, treeSha: null },
  };
}
