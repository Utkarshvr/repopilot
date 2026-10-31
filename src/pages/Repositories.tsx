import { GitBranch, Plus } from "lucide-react";
import { RepositoryList } from "@/components/repositories/RepositoryList";
import { mockRepositories } from "@/data/mockRepositories";
import { MockBadge } from "@/components/shared/MockBadge";
import { useAppStore } from "@/store/useAppStore";

export default function Repositories() {
  const selectedRepositoryId = useAppStore((s) => s.selectedRepositoryId);
  const selected = mockRepositories.find((r) => r.id === selectedRepositoryId);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              Repositories
            </h1>
            <MockBadge provenance="mock" />
          </div>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Indexed workspaces available for dependency and impact analysis.
            GitHub sync is reserved for Phase II.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2.5 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
            title="Available in Phase II"
          >
            <GitBranch size={15} />
            Import from GitHub
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-400"
          >
            <Plus size={16} />
            Add Repository
          </button>
        </div>
      </section>

      {selected ? (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04] px-5 py-4">
          <p className="text-[10px] font-medium tracking-wide text-indigo-400 uppercase">
            Active workspace
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-100">
            {selected.fullName}
            <span className="ml-2 font-mono text-xs text-zinc-500">
              @{selected.branch}
            </span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">{selected.description}</p>
        </div>
      ) : null}

      <RepositoryList repositories={mockRepositories} />
    </div>
  );
}
