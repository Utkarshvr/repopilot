import { Bell, Search, GitBranch } from "lucide-react";

export default function Header() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-white/[0.07] px-8">
      <div>
        <p className="text-xs text-zinc-500">Workspace / Overview</p>
        <h2 className="mt-1 text-sm font-medium">Dashboard</h2>
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-500">
          <Search size={14} />
          Search
          <span className="ml-6 rounded bg-white/10 px-1.5 py-0.5">
            Ctrl K
          </span>
        </button>

        <button className="rounded-lg border border-white/10 p-2 text-zinc-400">
          <Bell size={17} />
        </button>

        <button className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-400">
          <GitBranch size={15} />
          Connect GitHub
        </button>
      </div>
    </header>
  );
}