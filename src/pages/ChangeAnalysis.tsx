import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, GitCompareArrows, ListChecks, Loader2, Search, Trash2 } from "lucide-react";
import { useRepositoryStore } from "@/store/repositoryStore";
import { compareRepositoryCommits, GitHubApiError, parseGitHubUrl } from "@/services/github/githubApi";
import { clearFileSelection, createGitHubChangeSet, createManualChangeSet, toggleFileSelection, validateGitHubRevision } from "@/lib/changes";
import { summarizeChangeSet, type ChangeSet, type ChangedFile } from "@/types/changes";
import type { SourceFile } from "@/types";
import { cn } from "@/lib/utils";
import { buildRepositoryGraphSnapshot } from "@/services/github/revisionSnapshotService";

type ChangeSource = "manual" | "github-comparison";

export default function ChangeAnalysis() {
  const analyzed = useRepositoryStore((state) => state.getActiveAnalyzed());
  const storeChangeSet = useRepositoryStore((state) => state.storeChangeSet);
  const storeRevisionSnapshot = useRepositoryStore((state) => state.storeRevisionSnapshot);
  const getRevisionSnapshot = useRepositoryStore((state) => state.getRevisionSnapshot);
  const navigate = useNavigate();
  const [source, setSource] = useState<ChangeSource>("manual");
  const [query, setQuery] = useState("");
  const [manualSelection, setManualSelection] = useState<Set<string>>(new Set());
  const [baseRef, setBaseRef] = useState(analyzed?.branch ?? "");
  const [headRef, setHeadRef] = useState("");
  const [comparison, setComparison] = useState<ChangeSet | null>(null);
  const [comparisonError, setComparisonError] = useState<string | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [snapshotProgress, setSnapshotProgress] = useState<Record<"base" | "head", { status: "idle" | "building" | "reused" | "ready" | "failed"; message: string }>>({
    base: { status: "idle", message: "Not requested" },
    head: { status: "idle", message: "Not requested" },
  });

  useEffect(() => {
    setManualSelection(new Set());
    setComparison(null);
    setComparisonError(null);
    setBaseRef(analyzed?.branch ?? "");
    setHeadRef("");
    setSnapshotProgress({ base: { status: "idle", message: "Not requested" }, head: { status: "idle", message: "Not requested" } });
  }, [analyzed?.id, analyzed?.analyzedAt, analyzed?.branch]);

  const filteredFiles = useMemo(() => {
    const files = analyzed?.graph.files ?? [];
    const needle = query.trim().toLowerCase();
    return needle ? files.filter((file) => file.path.toLowerCase().includes(needle)) : files;
  }, [analyzed?.graph.files, query]);

  if (!analyzed) {
    return (
      <section className="mx-auto max-w-3xl rounded-xl border border-white/[0.08] bg-[#101014] p-8 text-center">
        <GitCompareArrows className="mx-auto text-zinc-500" size={24} />
        <h1 className="mt-3 text-lg font-semibold">Change Analysis</h1>
        <p className="mt-2 text-sm text-zinc-500">Analyze a public GitHub repository before selecting or comparing changed files.</p>
        <Link to="/repositories" className="mt-5 inline-flex rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400">Go to repositories</Link>
      </section>
    );
  }

  const selectedCompareCount = comparison?.files.filter((file) => file.selectedForImpact).length ?? 0;
  const toggleCompareFile = (path: string, previousPath: string | null) => {
    setComparison((current) => current ? {
      ...current,
      files: current.files.map((file) => file.path === path && file.previousPath === previousPath
        ? { ...file, selectedForImpact: !file.selectedForImpact }
        : file),
    } : current);
  };

  const runComparison = async (event: React.FormEvent) => {
    event.preventDefault();
    setComparisonError(null);
    const baseError = validateGitHubRevision(baseRef);
    const headError = validateGitHubRevision(headRef);
    if (baseError || headError) {
      setComparisonError(baseError ? `Base revision: ${baseError}` : `Head revision: ${headError}`);
      return;
    }
    if (baseRef.trim() === headRef.trim()) {
      setComparisonError("Base and head revisions must be different.");
      return;
    }

    setIsComparing(true);
    try {
      const repository = parseGitHubUrl(analyzed.metadata.htmlUrl);
      const result = await compareRepositoryCommits(repository.owner, repository.repo, baseRef, headRef);
      const nextChangeSet = { ...createGitHubChangeSet(analyzed, baseRef.trim(), headRef.trim(), result), baseSnapshotReused: null, headSnapshotReused: null, baseSnapshotError: null, headSnapshotError: null };
      setComparison(nextChangeSet);
      const buildSnapshot = async (side: "base" | "head", sha: string | null, ref: string) => {
        if (!sha) {
          const message = "GitHub did not return the resolved commit SHA.";
          setComparison((current) => current ? { ...current, [side === "base" ? "baseSnapshotError" : "headSnapshotError"]: message } : current);
          setSnapshotProgress((current) => ({ ...current, [side]: { status: "failed", message } }));
          return;
        }
        const cached = getRevisionSnapshot(analyzed.id, sha);
        const expectedTreeSha = side === "base" ? result.baseTreeSha : result.headTreeSha;
        if (cached && (!expectedTreeSha || cached.treeSha === expectedTreeSha)) {
          setComparison((current) => current ? { ...current, [side === "base" ? "baseSnapshotReused" : "headSnapshotReused"]: true, [side === "base" ? "baseSnapshotError" : "headSnapshotError"]: null } : current);
          setSnapshotProgress((current) => ({ ...current, [side]: { status: "reused", message: `${cached.stats.filesAnalyzed} files · analyzed ${new Date(cached.analyzedAt).toLocaleString()}` } }));
          return;
        }
        setSnapshotProgress((current) => ({ ...current, [side]: { status: "building", message: "Analyzing revision…" } }));
        try {
          const snapshot = await buildRepositoryGraphSnapshot(repository, sha, ref, (progress) => {
            setSnapshotProgress((current) => current[side].status === "building"
              ? { ...current, [side]: { status: "building", message: progress.message } }
              : current);
          });
          storeRevisionSnapshot(snapshot);
          setComparison((current) => current ? { ...current, [side === "base" ? "baseSnapshotReused" : "headSnapshotReused"]: false, [side === "base" ? "baseSnapshotError" : "headSnapshotError"]: null } : current);
          setSnapshotProgress((current) => ({ ...current, [side]: { status: "ready", message: `${snapshot.stats.filesAnalyzed} files analyzed${snapshot.complete ? " · complete" : " · partial"}` } }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Revision analysis failed.";
          setComparison((current) => current ? { ...current, [side === "base" ? "baseSnapshotReused" : "headSnapshotReused"]: null, [side === "base" ? "baseSnapshotError" : "headSnapshotError"]: message } : current);
          setSnapshotProgress((current) => ({ ...current, [side]: { status: "failed", message } }));
        }
      };
      await buildSnapshot("base", result.baseSha, baseRef.trim());
      await buildSnapshot("head", result.headSha, headRef.trim());
    } catch (error) {
      setComparison(null);
      setComparisonError(error instanceof GitHubApiError ? error.message : error instanceof Error ? error.message : "GitHub comparison failed. Please try again.");
    } finally {
      setIsComparing(false);
    }
  };

  const continueToImpact = (changeSet: ChangeSet) => {
    storeChangeSet(changeSet);
    navigate("/impact");
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Change Analysis</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-500">Select source files manually or compare two GitHub revisions. This step records changed files and their graph eligibility; it does not calculate impact.</p>
      </section>

      <div className="flex flex-wrap gap-2">
        <SourceTab active={source === "manual"} onClick={() => setSource("manual")} icon={<ListChecks size={14} />}>Manual selection</SourceTab>
        <SourceTab active={source === "github-comparison"} onClick={() => setSource("github-comparison")} icon={<GitCompareArrows size={14} />}>GitHub comparison</SourceTab>
      </div>

      <section className="rounded-xl border border-white/[0.08] bg-[#101014] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-500">Active analyzed repository</p>
            <p className="mt-1 text-sm font-medium text-zinc-200">{analyzed.metadata.fullName}</p>
          </div>
          <Link to="/repositories" className="text-xs text-indigo-400 hover:text-indigo-300">Switch repository</Link>
        </div>

        {source === "manual" ? (
          <ManualSelection
            files={filteredFiles}
            query={query}
            setQuery={setQuery}
            selected={manualSelection}
            setSelected={setManualSelection}
            onClear={() => setManualSelection(clearFileSelection())}
            onContinue={() => continueToImpact(createManualChangeSet(analyzed, [...manualSelection]))}
          />
        ) : (
          <div className="mt-5 space-y-4">
            <form onSubmit={runComparison} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <RevisionInput label="Base branch or commit" value={baseRef} onChange={setBaseRef} placeholder="main or commit SHA" />
              <RevisionInput label="Head branch or commit" value={headRef} onChange={setHeadRef} placeholder="feature branch or commit SHA" />
              <button disabled={isComparing || !baseRef.trim() || !headRef.trim()} type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">
                {isComparing ? <Loader2 size={14} className="animate-spin" /> : <GitCompareArrows size={14} />}
                {isComparing ? "Comparing…" : "Compare revisions"}
              </button>
            </form>
            <p className="text-[10px] text-zinc-600">Uses GitHub’s public compare API. Public repositories only; anonymous API rate limits apply.</p>
            {comparisonError && <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.05] p-3 text-xs text-red-300"><AlertCircle size={14} className="mt-0.5 shrink-0" />{comparisonError}</p>}
            {comparison && (
              <ComparisonResults
                changeSet={comparison}
                query={query}
                setQuery={setQuery}
                selectedCount={selectedCompareCount}
                onToggle={toggleCompareFile}
                onClear={() => setComparison((current) => current ? { ...current, files: current.files.map((file) => ({ ...file, selectedForImpact: false })) } : current)}
                onContinue={() => continueToImpact(comparison)}
                snapshotProgress={snapshotProgress}
                isBusy={isComparing}
              />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function SourceTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition", active ? "border-indigo-400/30 bg-indigo-500/10 text-indigo-300" : "border-white/10 text-zinc-500 hover:text-zinc-200")}>{icon}{children}</button>;
}

function RevisionInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  const error = value ? validateGitHubRevision(value) : null;
  return <label className="block text-xs text-zinc-500">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-invalid={Boolean(error)} className="mt-1.5 h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-indigo-500/40 aria-[invalid=true]:border-red-500/30" />{error && <span className="mt-1 block text-[10px] text-red-400">{error}</span>}</label>;
}

function SearchField({ query, setQuery, placeholder }: { query: string; setQuery: (query: string) => void; placeholder: string }) {
  return <label className="relative block flex-1"><Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-8 pr-3 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-indigo-500/40" /></label>;
}

function ManualSelection({ files, query, setQuery, selected, setSelected, onClear, onContinue }: {
  files: SourceFile[]; query: string; setQuery: (query: string) => void; selected: Set<string>;
  setSelected: (selected: Set<string>) => void; onClear: () => void; onContinue: () => void;
}) {
  const toggle = (path: string) => {
    setSelected(toggleFileSelection(selected, path));
  };
  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-wrap items-center gap-2"><SearchField query={query} setQuery={setQuery} placeholder="Filter by file path…" /><span className="text-xs text-zinc-400">{selected.size} selected</span><button type="button" onClick={onClear} disabled={selected.size === 0} className="inline-flex items-center gap-1 rounded border border-white/10 px-2.5 py-2 text-[11px] text-zinc-400 hover:text-white disabled:opacity-40"><Trash2 size={12} />Clear</button></div>
      <div className="max-h-[520px] overflow-y-auto rounded-lg border border-white/[0.06]">
        {files.length === 0 ? <p className="p-6 text-center text-xs text-zinc-600">No source files match this filter.</p> : files.map((file) => (
          <label key={file.id} className="flex cursor-pointer items-start gap-3 border-b border-white/[0.04] px-3 py-3 last:border-0 hover:bg-white/[0.02]">
            <input type="checkbox" checked={selected.has(file.path)} onChange={() => toggle(file.path)} className="mt-1 accent-indigo-400" />
            <span className="min-w-0 flex-1"><code className="block break-all text-xs text-zinc-200">{file.path}</code><span className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-zinc-600"><span>{file.kind} · {file.language}</span><span>{file.extension ?? "source"}</span>{file.size != null && <span>{(file.size / 1024).toFixed(1)} KB</span>}<span>{file.dependencyCount} dependencies</span><span>{file.dependentCount} dependents</span></span></span>
            <span className="shrink-0 rounded border border-sky-500/20 bg-sky-500/[0.05] px-2 py-0.5 text-[10px] text-sky-300">Source</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] text-zinc-600">Manual selection records these files as change targets; it does not assert a Git status or diff.</p><button type="button" onClick={onContinue} disabled={selected.size === 0} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-xs font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40">Continue to impact analysis <ArrowRight size={13} /></button></div>
    </div>
  );
}

function ComparisonResults({ changeSet, query, setQuery, selectedCount, onToggle, onClear, onContinue, snapshotProgress, isBusy }: {
  changeSet: ChangeSet; query: string; setQuery: (query: string) => void; selectedCount: number;
  onToggle: (path: string, previousPath: string | null) => void; onClear: () => void; onContinue: () => void;
  snapshotProgress: Record<"base" | "head", { status: "idle" | "building" | "reused" | "ready" | "failed"; message: string }>;
  isBusy: boolean;
}) {
  const filtered = changeSet.files.filter((file) => `${file.path} ${file.previousPath ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const summary = summarizeChangeSet(changeSet.files);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-zinc-400"><span>Resolved comparison: <code className="text-zinc-300">{(changeSet.baseSha ?? changeSet.baseRevision ?? "—").slice(0, 12)}</code> → <code className="text-zinc-300">{(changeSet.headSha ?? changeSet.headRevision ?? "—").slice(0, 12)}</code> · {changeSet.totalCommits ?? "—"} commits</span><span>{selectedCount} selected</span></div>
      <div className="grid gap-2 md:grid-cols-2">
        {(["base", "head"] as const).map((side) => {
          const item = snapshotProgress[side];
          return <div key={side} className={cn("rounded-lg border p-3", item.status === "failed" ? "border-red-500/20 bg-red-500/[0.04]" : item.status === "building" ? "border-indigo-500/20 bg-indigo-500/[0.04]" : "border-white/[0.06] bg-white/[0.02]")}>
            <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{side} graph · {(side === "base" ? changeSet.baseSha : changeSet.headSha)?.slice(0, 12) ?? "SHA unavailable"}</p><span className="text-[9px] uppercase text-zinc-500">{item.status}</span></div>
            <p className="mt-1 break-words text-[10px] text-zinc-500">{item.message}</p>
          </div>;
        })}
      </div>
      {!changeSet.isComplete && <p role="status" className="rounded-lg border border-amber-500/20 bg-amber-500/[0.05] p-3 text-xs text-amber-300">{changeSet.completenessWarning} The listed change set may be incomplete.</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-9">
        <SummaryCell label="Total changed" value={summary.total} /><SummaryCell label="Added" value={summary.added} /><SummaryCell label="Modified" value={summary.modified} /><SummaryCell label="Deleted" value={summary.removed} /><SummaryCell label="Renamed" value={summary.renamed} /><SummaryCell label="Copied" value={summary.copied} /><SummaryCell label="Other status" value={summary.other} /><SummaryCell label="Eligible" value={summary.eligible} /><SummaryCell label="Outside graph" value={summary.outsideGraph} />
      </div>
      <div className="flex flex-wrap items-center gap-2"><SearchField query={query} setQuery={setQuery} placeholder="Filter changed file paths…" /><span className="text-xs text-zinc-400">{selectedCount} selected</span><button type="button" onClick={onClear} disabled={selectedCount === 0} className="inline-flex items-center gap-1 rounded border border-white/10 px-2.5 py-2 text-[11px] text-zinc-400 hover:text-white disabled:opacity-40"><Trash2 size={12} />Clear selection</button></div>
      <div className="max-h-[520px] overflow-y-auto rounded-lg border border-white/[0.06]">
        {filtered.length === 0 ? <p className="p-6 text-center text-xs text-zinc-600">No changed files match this filter.</p> : filtered.map((file) => <ChangedFileRow key={`${file.path}:${file.previousPath ?? ""}`} file={file} onToggle={() => onToggle(file.path, file.previousPath)} />)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] text-zinc-600">Missing patches can indicate binary files or diffs omitted by GitHub. A missing patch alone is not treated as proof that a file is binary.</p><button type="button" onClick={onContinue} disabled={selectedCount === 0 || isBusy} className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-xs font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-40">{isBusy ? "Building revision graphs…" : "Continue to impact analysis"} {!isBusy && <ArrowRight size={13} />}</button></div>
    </div>
  );
}

function ChangedFileRow({ file, onToggle }: { file: ChangedFile; onToggle: () => void }) {
  const statusColors: Record<string, string> = {
    added: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300",
    modified: "border-sky-500/20 bg-sky-500/[0.06] text-sky-300",
    removed: "border-red-500/20 bg-red-500/[0.06] text-red-300",
    renamed: "border-violet-500/20 bg-violet-500/[0.06] text-violet-300",
    copied: "border-cyan-500/20 bg-cyan-500/[0.06] text-cyan-300",
    other: "border-white/10 bg-white/[0.03] text-zinc-300",
  };
  const statusLabel = file.status === "other" ? `Other${file.rawStatus ? ` (${file.rawStatus})` : ""}` : file.status;
  return (
    <article className="border-b border-white/[0.04] px-3 py-3 last:border-0">
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={file.selectedForImpact} onChange={onToggle} aria-label={`Select ${file.path}`} className="mt-1 accent-indigo-400" />
        <div className="min-w-0 flex-1"><code className="block break-all text-xs text-zinc-200">{file.path}</code>{file.previousPath && <p className="mt-1 break-all font-mono text-[10px] text-violet-300/70">Renamed from {file.previousPath}</p>}<div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-600"><span>{file.classification}</span><span>{file.additions == null ? "—" : `+${file.additions}`} / {file.deletions == null ? "—" : `−${file.deletions}`}</span><span>{file.changes == null ? "—" : `${file.changes} changes`}</span><span>{file.isInAnalyzedGraph ? "In analyzed graph" : "Outside analyzed graph"}</span>{file.analysisEligible ? <span className="text-emerald-400">Eligible for impact</span> : <span className="text-amber-400">{file.ineligibilityReason === "not-in-graph" ? "Not included in analyzed graph" : "Unsupported source type"}</span>}{file.isBinary && <span className="text-amber-300">Binary extension</span>}</div></div>
        <span className={cn("shrink-0 rounded border px-2 py-0.5 text-[10px] capitalize", statusColors[file.status])}>{statusLabel}</span>
      </div>
      <details className="ml-7 mt-2"><summary className="cursor-pointer text-[10px] text-zinc-600 hover:text-zinc-400">{file.patchAvailable ? "View patch" : "Patch unavailable"}</summary>{file.patchAvailable ? <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-black/20 p-2 font-mono text-[10px] leading-4 text-zinc-400">{file.patch}</pre> : <p className="mt-1 text-[10px] text-zinc-600">GitHub did not return patch content for this file. It may be binary or the diff may exceed GitHub’s patch output limits.</p>}</details>
    </article>
  );
}

function SummaryCell({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-center"><p className="text-[10px] text-zinc-500">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums text-zinc-200">{value.toLocaleString()}</p></div>;
}
