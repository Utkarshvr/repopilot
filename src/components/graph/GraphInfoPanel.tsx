import { Link } from "react-router-dom";
import { ArrowUpRight, X } from "lucide-react";
import type { SourceFile } from "@/types";
import type { DataProvenance, GraphSelectionHighlight } from "@/types";
import { MockBadge } from "@/components/shared/MockBadge";

export default function GraphInfoPanel({
  file,
  highlight,
  filesById,
  transitiveDependencyCount,
  transitiveDependentCount,
  circularGroup,
  onClose,
  provenance = "mock",
}: {
  file: SourceFile;
  highlight: GraphSelectionHighlight;
  filesById: Map<string, SourceFile>;
  transitiveDependencyCount: number;
  transitiveDependentCount: number;
  circularGroup: string[] | null;
  onClose: () => void;
  provenance?: DataProvenance;
}) {
  const deps = [...highlight.dependencyIds]
    .map((id) => filesById.get(id))
    .filter((f): f is SourceFile => Boolean(f));
  const dependents = [...highlight.dependentIds]
    .map((id) => filesById.get(id))
    .filter((f): f is SourceFile => Boolean(f));

  return (
    <aside className="flex w-full flex-col border-t border-white/[0.07] bg-[#0d0d10] lg:w-[320px] lg:border-t-0 lg:border-l">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
              Selected file
            </p>
            <MockBadge provenance={provenance} />
          </div>
          <h3 className="mt-1 truncate text-sm font-semibold text-zinc-100">
            {file.name}
          </h3>
          <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">
            {file.path}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-white/10 p-1.5 text-zinc-500 transition hover:text-zinc-200"
          aria-label="Clear selection"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto p-4">
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <InfoCell label="Kind" value={file.kind} />
          <InfoCell label="Language" value={file.language} />
          {file.extension ? <InfoCell label="Extension" value={file.extension} /> : null}
          {file.size != null ? <InfoCell label="Size" value={`${(file.size / 1024).toFixed(1)} KB`} /> : null}
          <InfoCell label="Dependencies" value={String(file.dependencyCount)} />
          <InfoCell label="Dependents" value={String(file.dependentCount)} />
          <InfoCell label="Transitive dependencies" value={String(transitiveDependencyCount)} />
          <InfoCell label="Transitive dependents" value={String(transitiveDependentCount)} />
          <InfoCell label="Circular dependency" value={circularGroup ? "Yes" : "No"} />
          {file.linesOfCode != null ? (
            <InfoCell label="LOC (approx)" value={String(file.linesOfCode)} />
          ) : null}
        </dl>

        {circularGroup && (
          <div className="rounded-md border border-rose-500/20 bg-rose-500/[0.04] p-2.5">
            <p className="text-[10px] font-medium text-rose-300">Strongly connected group</p>
            <ul className="mt-1 space-y-0.5">
              {circularGroup.map((id) => <li key={id} className="break-all font-mono text-[10px] text-zinc-400">{filesById.get(id)?.path ?? id}</li>)}
            </ul>
          </div>
        )}

        <RelationList
          title="Direct dependencies"
          hint="Files this module imports"
          files={deps}
          empty="No outgoing imports found."
          tone="sky"
        />

        <RelationList
          title="Direct dependents"
          hint="Files that import this module"
          files={dependents}
          empty="Nothing imports this file."
          tone="amber"
        />

        <Link
          to="/impact"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 transition hover:text-indigo-300"
        >
          Analyze change impact
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </aside>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
      <dt className="text-[10px] text-zinc-500">{label}</dt>
      <dd className="mt-1 capitalize text-zinc-200">{value}</dd>
    </div>
  );
}

function RelationList({
  title,
  hint,
  files,
  empty,
  tone,
}: {
  title: string;
  hint: string;
  files: SourceFile[];
  empty: string;
  tone: "sky" | "amber";
}) {
  const dot = tone === "sky" ? "bg-sky-400" : "bg-amber-400";

  return (
    <div>
      <p className="text-xs font-medium text-zinc-300">{title}</p>
      <p className="mt-0.5 text-[10px] text-zinc-500">{hint}</p>
      {files.length === 0 ? (
        <p className="mt-2 text-[11px] text-zinc-600">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-white/[0.02] px-2.5 py-2"
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <div className="min-w-0">
                <p className="truncate text-xs text-zinc-200">{file.name}</p>
                <p className="truncate font-mono text-[10px] text-zinc-500">
                  {file.path}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
