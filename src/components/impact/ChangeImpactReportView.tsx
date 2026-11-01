import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDot, GitBranch } from "lucide-react";
import DependencyGraph, { type GraphImpactHighlight } from "@/components/graph/DependencyGraph";
import type { AnalyzedRepository } from "@/types/analysis";
import type { RepositoryGraphSnapshot } from "@/types/analysis";
import type { ChangeSet } from "@/types/changes";
import type { DependencyGraphData } from "@/types";
import type { ImpactAffectedFile, ImpactReport, ImpactRiskLevel } from "@/lib/impact";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

type ScopeFilter = "all" | "direct" | "transitive";
type RiskFilter = "all" | ImpactRiskLevel;

export function ChangeImpactReportView({ analyzed, report, changeSet, availableChangeSets, baseSnapshot, headSnapshot, onSelectChangeSet, onClearChangeSet }: {
  analyzed: AnalyzedRepository;
  report: ImpactReport;
  changeSet: ChangeSet;
  availableChangeSets: ChangeSet[];
  baseSnapshot: RepositoryGraphSnapshot | null;
  headSnapshot: RepositoryGraphSnapshot | null;
  onSelectChangeSet: (id: string) => void;
  onClearChangeSet: () => void;
}) {
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [changedFilter, setChangedFilter] = useState("all");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const setSelectedFileId = useAppStore((state) => state.setSelectedFileId);
  const impactGraph = useMemo(() => mergeImpactGraphs(baseSnapshot, headSnapshot, analyzed.graph), [baseSnapshot, headSnapshot, analyzed.graph]);

  useEffect(() => {
    // This setter synchronizes the shared graph-selection store with the newly keyed report view.
    setSelectedFileId(null);
  }, [report.changeSetId, setSelectedFileId]);

  const filteredFiles = useMemo(() => report.affectedFiles.filter((file) =>
    (scopeFilter === "all" || file.scope === scopeFilter) &&
    (riskFilter === "all" || file.riskLevel === riskFilter) &&
    (changedFilter === "all" || file.responsibleChangeIds.includes(changedFilter)),
  ), [report.affectedFiles, scopeFilter, riskFilter, changedFilter]);

  const selectedAffected = report.affectedFiles.find((file) => file.path === selectedPath) ?? null;
  const graphHighlight = useMemo(() => makeGraphHighlight(impactGraph, report, selectedAffected), [impactGraph, report, selectedAffected]);
  const riskClass = riskColor(report.risk.level);

  const selectAffected = (file: ImpactAffectedFile) => {
    setSelectedPath(file.path);
    const graphFile = analyzed.graph.files.find((candidate) => candidate.path === file.path);
    if (graphFile) setSelectedFileId(graphFile.id);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">Change Impact Intelligence</h1><span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${riskClass}`}>{report.risk.level} risk · {report.risk.score}</span></div>
          <p className="mt-2 text-sm text-zinc-500">Structural impact assessment for <span className="text-zinc-300">{report.repositoryFullName}</span>. Risk is a graph-based heuristic, not a probability of runtime failure.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {availableChangeSets.length > 1 && <label className="flex items-center gap-2 text-[10px] text-zinc-500">Saved change set
            <select aria-label="Switch saved change set" value={changeSet.id} onChange={(event) => onSelectChangeSet(event.target.value)} className="max-w-64 rounded-lg border border-white/10 bg-[#15151b] px-2.5 py-2 text-xs text-zinc-300">
              {availableChangeSets.map((item) => <option key={item.id} value={item.id}>{item.source === "manual" ? "Manual" : `${item.baseRevision ?? "Base"} → ${item.headRevision ?? "Head"}`} · {item.files.filter((file) => file.selectedForImpact).length} selected</option>)}
            </select>
          </label>}
          <button type="button" onClick={onClearChangeSet} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200">Return to single-file analysis</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryCard label="Changed files" value={report.summary.changedFilesCount} detail={`${report.summary.detectedChangedFilesCount} detected`} />
        <SummaryCard label="Directly affected" value={report.summary.directlyAffectedFilesCount} />
        <SummaryCard label="Transitively affected" value={report.summary.transitivelyAffectedFilesCount} />
        <SummaryCard label="Unique affected" value={report.summary.totalUniqueAffectedFiles} />
        <SummaryCard label="Unresolved imports" value={report.summary.unresolvedImpactRelationships} warn={report.summary.unresolvedImpactRelationships > 0} />
        <div className="rounded-xl border border-white/[0.07] bg-[#101014] px-4 py-3">
          <p className="text-[10px] text-zinc-500">Analysis completeness</p>
          <p className={`mt-1 text-sm font-semibold capitalize ${report.summary.analysisComplete ? "text-emerald-400" : report.summary.completeness === "unavailable" ? "text-red-300" : "text-amber-300"}`}>{report.summary.completeness}</p>
          <p className="mt-1 text-[9px] text-zinc-600">{report.summary.graphRevisionVerified ? "Graph revision verified" : "Graph revision unverified"}</p>
        </div>
      </section>

      {changeSet.source === "github-comparison" && <section className="grid gap-3 md:grid-cols-2">
        <RevisionSnapshotCard label="Base commit" sha={changeSet.baseSha} snapshot={baseSnapshot} reused={changeSet.baseSnapshotReused} error={changeSet.baseSnapshotError} />
        <RevisionSnapshotCard label="Head commit" sha={changeSet.headSha} snapshot={headSnapshot} reused={changeSet.headSnapshotReused} error={changeSet.headSnapshotError} />
      </section>}

      <section className="rounded-xl border border-white/[0.07] bg-[#101014] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-sm font-semibold">Risk assessment</h2><p className="mt-1 text-[10px] text-zinc-500">Deterministic score from graph structure and bounded factor caps.</p></div>
          <span className={`text-xl font-semibold tabular-nums ${riskClass.split(" ").at(-1)}`}>{report.risk.score}<span className="text-xs text-zinc-600">/100</span></span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {report.risk.factors.map((factor) => <div key={factor.key} className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3"><div className="flex items-center justify-between gap-2"><span className="text-[11px] text-zinc-300">{factor.label}</span><span className="text-[10px] tabular-nums text-zinc-400">+{factor.contribution.toFixed(0)}</span></div><div className="mt-2 h-1 rounded bg-white/[0.06]"><div className="h-full rounded bg-indigo-400" style={{ width: `${Math.min(100, factor.contribution / 25 * 100)}%` }} /></div><p className="mt-2 text-[10px] leading-4 text-zinc-600">{factor.explanation}</p></div>)}
        </div>
        <p className="mt-3 text-[10px] text-zinc-600">{report.risk.note}</p>
      </section>

      <section className="rounded-xl border border-white/[0.07] bg-[#101014] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Per-file impact</h2><p className="mt-1 text-[10px] text-zinc-500">Affected files are unique across the complete change set.</p></div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Filter by impact scope" value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)} className="rounded border border-white/10 bg-[#15151b] px-2.5 py-2 text-[10px] text-zinc-300"><option value="all">All impact</option><option value="direct">Direct</option><option value="transitive">Transitive</option></select>
            <select aria-label="Filter by changed file" value={changedFilter} onChange={(event) => setChangedFilter(event.target.value)} className="max-w-56 rounded border border-white/10 bg-[#15151b] px-2.5 py-2 text-[10px] text-zinc-300"><option value="all">All changed files</option>{report.perChange.map((change) => <option key={change.changeId} value={change.changeId}>{change.currentPath} · {change.status}</option>)}</select>
            <select aria-label="Filter by risk level" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as RiskFilter)} className="rounded border border-white/10 bg-[#15151b] px-2.5 py-2 text-[10px] text-zinc-300"><option value="all">All risk levels</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select>
          </div>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="max-h-[540px] overflow-auto rounded-lg border border-white/[0.05]">
            {filteredFiles.length === 0 ? <p className="p-8 text-center text-xs text-zinc-600">No affected files match these filters.</p> : <ul className="divide-y divide-white/[0.04]">{filteredFiles.map((file) => <li key={file.path}><button type="button" onClick={() => selectAffected(file)} className={cn("w-full px-3 py-3 text-left transition", selectedPath === file.path ? "bg-indigo-500/[0.08]" : "hover:bg-white/[0.02]")}><div className="flex items-start justify-between gap-2"><code className="min-w-0 break-all text-xs text-zinc-200">{file.path}</code><span className={cn("shrink-0 rounded border px-2 py-0.5 text-[9px] uppercase", file.scope === "direct" ? "border-amber-500/20 bg-amber-500/[0.05] text-amber-300" : "border-orange-500/20 bg-orange-500/[0.05] text-orange-300")}>{file.scope}</span></div><div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-600"><span>Distance {file.distance}</span><span>{file.graphMetadata.kind} · {file.graphMetadata.language}</span><span className={riskColor(file.riskLevel)}>{file.riskLevel} risk {file.riskScore}</span><span>Caused by {file.responsibleChangedPaths.join(", ")}</span></div></button></li>)}</ul>}
          </div>
          <ExplainabilityPanel file={selectedAffected} report={report} />
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.07] bg-[#101014] p-5">
        <div className="flex items-center gap-2"><GitBranch size={14} className="text-indigo-300" /><h2 className="text-sm font-semibold">Dependency graph impact view</h2></div>
        <p className="mt-1 text-[10px] text-zinc-500">{report.summary.graphRevisionUsed}</p>
        <div className="mt-3"><DependencyGraph graph={impactGraph} heightClass="h-[min(70vh,680px)]" highlightedImpact={graphHighlight} /></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/[0.07] bg-[#101014] p-5"><h2 className="text-sm font-semibold">Changed files analyzed</h2><ul className="mt-3 divide-y divide-white/[0.04]">{report.perChange.map((change) => <li key={change.changeId} className="py-2.5"><div className="flex flex-wrap items-center justify-between gap-2"><code className="text-xs text-zinc-300">{change.originalPath ? `${change.originalPath} → ${change.currentPath}` : change.currentPath}</code><span className="text-[10px] capitalize text-zinc-500">{change.status} · {change.totalAffectedFiles} affected</span></div>{change.graphRevisionsUsed.length > 0 && <p className="mt-1 text-[9px] text-zinc-600">{change.graphRevisionsUsed.join("; ")}</p>}{change.analysisLimitations.map((item) => <p key={item} className="mt-1 text-[10px] text-amber-400">{item}</p>)}</li>)}</ul></div>
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.025] p-5"><div className="flex items-center gap-2"><AlertTriangle size={14} className="text-amber-300" /><h2 className="text-sm font-semibold">Analysis limitations</h2></div>{report.limitations.length ? <ul className="mt-3 space-y-2">{report.limitations.map((item) => <li key={item} className="text-[11px] leading-5 text-amber-100/70">{item}</li>)}</ul> : <p className="mt-3 flex items-center gap-2 text-xs text-emerald-400"><CheckCircle2 size={13} />No known graph or comparison limitations.</p>}{report.exclusions.filter((item) => item.reason !== "not-selected").length > 0 && <div className="mt-4 border-t border-amber-500/10 pt-3"><h3 className="text-[10px] font-semibold text-amber-200/80">Files excluded</h3><ul className="mt-2 space-y-1">{report.exclusions.filter((item) => item.reason !== "not-selected").map((item, i) => <li key={`${item.changeId}:${item.path}:${i}`} className="break-words text-[10px] text-zinc-500"><code className="text-zinc-400">{item.path}</code> — {item.detail}</li>)}</ul></div>}</div>
      </section>
    </div>
  );
}

function RevisionSnapshotCard({ label, sha, snapshot, reused, error }: { label: string; sha: string | null; snapshot: RepositoryGraphSnapshot | null; reused: boolean | null | undefined; error?: string | null }) {
  const status = !sha ? "Commit SHA unavailable" : snapshot ? snapshot.complete ? "Complete snapshot" : "Partial snapshot" : "Snapshot unavailable";
  return <section className={cn("rounded-xl border p-4", !snapshot ? "border-amber-500/20 bg-amber-500/[0.03]" : snapshot.complete ? "border-white/[0.07] bg-[#101014]" : "border-amber-500/20 bg-amber-500/[0.03]")}>
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xs font-semibold text-zinc-200">{label}</h2><span className={cn("text-[10px]", snapshot?.complete ? "text-emerald-400" : "text-amber-300")}>{status}</span></div>
    <p className="mt-1 font-mono text-[10px] text-zinc-500">{sha ?? "Not returned by GitHub"}</p>
    <p className="mt-2 text-[10px] text-zinc-500">{snapshot ? `${snapshot.stats.filesAnalyzed} source files parsed · ${snapshot.stats.filesDiscovered} paths discovered · ${reused == null ? "cache status unknown" : reused ? "reused from snapshot cache" : "built for this comparison"}` : error ?? "The revision graph could not be built or is not stored in this browser."}</p>
    {snapshot?.limitations.map((limitation) => <p key={limitation} className="mt-1 text-[10px] text-amber-300/80">{limitation}</p>)}
  </section>;
}

function ExplainabilityPanel({ file, report }: { file: ImpactAffectedFile | null; report: ImpactReport }) {
  if (!file) return <aside className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-4 text-xs text-zinc-600">Select an affected file to see why it is connected to the change set.</aside>;
  const uniquePaths = new Map<string, { path: string[]; label: string; changedPath: string }>();
  for (const item of file.dependencyPaths) for (const path of item.paths) uniquePaths.set(path.join("\0"), { path, label: item.graphLabel, changedPath: item.changedPath });
  const causes = report.perChange.filter((change) => file.responsibleChangeIds.includes(change.changeId));
  return <aside className="max-h-[540px] overflow-y-auto rounded-lg border border-indigo-500/15 bg-indigo-500/[0.025] p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-300">Why this file is affected</p><code className="mt-2 block break-all text-xs text-zinc-200">{file.path}</code><p className="mt-2 text-[10px] text-zinc-500">{file.scope === "direct" ? "Direct dependent" : `Transitive dependent at distance ${file.distance}`} · {file.graphMetadata.kind} · {file.graphMetadata.language}</p><div className="mt-3"><p className="text-[10px] text-zinc-400">Changed files responsible</p>{causes.map((change) => <p key={change.changeId} className="mt-1 break-all font-mono text-[10px] text-amber-300">{change.originalPath ? `${change.originalPath} → ${change.currentPath}` : change.currentPath} <span className="font-sans capitalize text-zinc-600">({change.status})</span></p>)}</div><div className="mt-3"><p className="text-[10px] text-zinc-400">Shortest dependency path{uniquePaths.size === 1 ? "" : "s"}{uniquePaths.size > 1 ? ` (${uniquePaths.size}${file.dependencyPaths.some((item) => item.additionalPathsTruncated) ? "+" : ""})` : ""}</p>{[...uniquePaths.values()].map((item, index) => <div key={`${item.path.join(":")}:${index}`} className="mt-2 rounded border border-white/[0.05] bg-black/10 p-2"><p className="mb-1 text-[9px] text-zinc-600">{item.label}</p><p className="break-words font-mono text-[10px] leading-5 text-zinc-300">{item.path.map((part, i) => <span key={`${part}:${i}`}>{i > 0 && <span className="text-indigo-400"> → </span>}{part === item.changedPath ? <strong className="text-amber-300">{part} [CHANGED]</strong> : part}</span>)}</p></div>)}</div><div className="mt-3 flex items-center gap-1.5 text-[10px]">{file.circularDependencyGroup ? <><CircleDot size={12} className="text-rose-300" /><span className="text-rose-300">Participates in a circular group: {file.circularDependencyGroup.join(", ")}</span></> : <span className="text-zinc-600">No circular dependency group detected.</span>}</div></aside>;
}

function makeGraphHighlight(graph: DependencyGraphData, report: ImpactReport, selected: ImpactAffectedFile | null): GraphImpactHighlight {
  const graphPaths = new Set(graph.files.map((file) => file.path));
  const changed = new Set(report.perChange.flatMap((change) => [change.currentPath, change.originalPath].filter((path): path is string => Boolean(path && graphPaths.has(path)))));
  const direct = new Set(report.affectedFiles.filter((file) => file.scope === "direct").map((file) => file.path));
  const transitive = new Set(report.affectedFiles.filter((file) => file.scope === "transitive").map((file) => file.path));
  const explanations = selected ? [selected] : report.affectedFiles;
  const pathNodeIds = new Set<string>();
  const pathKeys = new Set<string>();
  const paths = explanations.flatMap((file) => file.dependencyPaths.flatMap((item) => item.paths));
  for (const path of paths) {
    for (const node of path) if (graphPaths.has(node)) pathNodeIds.add(node);
    for (let i = 0; i < path.length - 1; i++) pathKeys.add(`${path[i]}\0${path[i + 1]}`);
  }
  const pathEdgeIds = new Set(graph.edges.filter((edge) => pathKeys.has(`${edge.source}\0${edge.target}`)).map((edge) => edge.id));
  return { changed, direct, transitive, pathNodeIds, pathEdgeIds };
}

function mergeImpactGraphs(base: RepositoryGraphSnapshot | null, head: RepositoryGraphSnapshot | null, fallback: DependencyGraphData): DependencyGraphData {
  if (!base || !head) return head?.graph ?? base?.graph ?? fallback;
  const files = new Map(base.graph.files.map((file) => [file.id, file]));
  for (const file of head.graph.files) files.set(file.id, file);
  const edgeMap = new Map<string, DependencyGraphData["edges"][number]>();
  for (const edge of [...base.graph.edges, ...head.graph.edges]) edgeMap.set(`${edge.source}\0${edge.target}`, edge);
  const edges = [...edgeMap.entries()].map(([key, edge], index) => ({ ...edge, id: `revision-${index}-${key.replaceAll("\0", "-")}` }));
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const edge of edges) {
    outgoing.set(edge.source, (outgoing.get(edge.source) ?? 0) + 1);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }
  const filesWithCounts = [...files.values()].map((file) => ({
    ...file,
    dependencyCount: outgoing.get(file.id) ?? 0,
    dependentCount: incoming.get(file.id) ?? 0,
  }));
  const columns = Math.max(1, Math.ceil(Math.sqrt(filesWithCounts.length)));
  const positions = Object.fromEntries(filesWithCounts.map((file, index) => [file.id, { x: (index % columns) * 240, y: Math.floor(index / columns) * 130 }]));
  return {
    ...head.graph,
    files: filesWithCounts,
    edges,
    positions,
    note: `Combined dependency relationships from base ${base.commitSha.slice(0, 12)} and head ${head.commitSha.slice(0, 12)} commits.`,
  };
}

function SummaryCard({ label, value, detail, warn = false }: { label: string; value: number; detail?: string; warn?: boolean }) {
  return <div className="rounded-xl border border-white/[0.07] bg-[#101014] px-4 py-3"><p className="text-[10px] text-zinc-500">{label}</p><p className={cn("mt-1 text-xl font-semibold tabular-nums", warn && value > 0 ? "text-amber-300" : "text-zinc-100")}>{value.toLocaleString()}</p>{detail && <p className="mt-1 text-[9px] text-zinc-600">{detail}</p>}</div>;
}

function riskColor(level: ImpactRiskLevel): string {
  return ({ low: "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-300", medium: "border-sky-500/20 bg-sky-500/[0.05] text-sky-300", high: "border-amber-500/20 bg-amber-500/[0.05] text-amber-300", critical: "border-red-500/20 bg-red-500/[0.05] text-red-300" })[level];
}
