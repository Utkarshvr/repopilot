import { Bell, Search, GitBranch } from "lucide-react";
import { useLocation } from "react-router-dom";

const titles: Record<string, { crumb: string; title: string }> = {
  "/": { crumb: "Workspace / Overview", title: "Dashboard" },
  "/repositories": {
    crumb: "Workspace / Repositories",
    title: "Repositories",
  },
  "/graph": {
    crumb: "Workspace / Dependency Graph",
    title: "Dependency Graph",
  },
  "/impact": {
    crumb: "Workspace / Impact Analysis",
    title: "Change Impact Intelligence",
  },
  "/changes": {
    crumb: "Workspace / Change Analysis",
    title: "Change Analysis",
  },
  "/settings": { crumb: "Workspace / Settings", title: "Settings" },
};

export default function Header() {
  const { pathname } = useLocation();
  const meta = titles[pathname] ?? {
    crumb: "Workspace",
    title: "RepoPilot",
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#09090b]/90 px-8 backdrop-blur">
      <div>
        <p className="text-[11px] text-zinc-500">{meta.crumb}</p>
        <h2 className="mt-0.5 text-sm font-medium text-zinc-100">{meta.title}</h2>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-500 transition hover:border-white/20 hover:text-zinc-300"
        >
          <Search size={14} />
          Search files…
          <kbd className="ml-4 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-zinc-500">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          className="relative rounded-lg border border-white/10 p-2 text-zinc-400 transition hover:border-white/20 hover:text-zinc-200"
          aria-label="Notifications"
        >
          <Bell size={16} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400" />
        </button>

        <button
          type="button"
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-indigo-400"
          title="GitHub connection arrives in Phase II"
        >
          <GitBranch size={14} />
          Connect GitHub
        </button>
      </div>
    </header>
  );
}
