import { ArrowUpRight, Clock3, GitBranch } from "lucide-react";
import { Link } from "react-router-dom";
import type { Repository } from "@/types";
import { MockBadge } from "@/components/shared/MockBadge";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const languageDot: Record<string, string> = {
  TypeScript: "bg-blue-400",
  JavaScript: "bg-yellow-400",
  TSX: "bg-cyan-400",
  CSS: "bg-pink-400",
  JSON: "bg-zinc-400",
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export function RecentRepositories({
  repositories,
}: {
  repositories: Repository[];
}) {
  const setSelectedRepositoryId = useAppStore((s) => s.setSelectedRepositoryId);
  const selectedRepositoryId = useAppStore((s) => s.selectedRepositoryId);

  return (
    <section className="rounded-xl border border-white/[0.07] bg-[#101014]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Recent Repositories</h3>
            <MockBadge provenance="mock" />
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Recently indexed codebases (mock catalog)
          </p>
        </div>
        <Link
          to="/repositories"
          className="text-xs text-indigo-400 transition hover:text-indigo-300"
        >
          View all
        </Link>
      </div>

      <ul>
        {repositories.map((repo) => (
          <li key={repo.id}>
            <button
              type="button"
              onClick={() => setSelectedRepositoryId(repo.id)}
              className={cn(
                "flex w-full items-center justify-between border-b border-white/[0.05] px-5 py-4 text-left transition last:border-0 hover:bg-white/[0.02]",
                selectedRepositoryId === repo.id && "bg-indigo-500/[0.04]",
              )}
            >
              <div className="flex items-center gap-3.5">
                <div className="rounded-lg bg-white/[0.05] p-2.5">
                  <GitBranch size={18} className="text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{repo.name}</h4>
                    {repo.isPrimary ? (
                      <span className="rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-300">
                        Primary
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-xs text-zinc-500">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        languageDot[repo.language] ?? "bg-zinc-400",
                      )}
                    />
                    {repo.language}
                    <span>·</span>
                    {repo.fileCount} files
                    <span>·</span>
                    <span className="capitalize">{repo.status}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Clock3 size={13} />
                {formatRelative(repo.updatedAt)}
                <ArrowUpRight size={14} className="ml-2 text-zinc-600" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
