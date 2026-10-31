import {
  ArrowUpRight,
  GitBranch,
  FileCode2,
  ShieldAlert,
  Workflow,
  Plus,
  Clock3,
} from "lucide-react";

const stats = [
  { label: "Repositories", value: "04", icon: GitBranch, change: "Connected" },
  {
    label: "Files Indexed",
    value: "248",
    icon: FileCode2,
    change: "Across repositories",
  },
  {
    label: "Dependencies",
    value: "1,024",
    icon: Workflow,
    change: "Mapped relationships",
  },
  {
    label: "Potential Risks",
    value: "12",
    icon: ShieldAlert,
    change: "Requires investigation",
  },
];

const repositories = [
  {
    name: "repopilot",
    language: "TypeScript",
    files: 86,
    updated: "Just now",
    color: "bg-blue-400",
  },
  {
    name: "budgetwise",
    language: "JavaScript",
    files: 104,
    updated: "2 hours ago",
    color: "bg-yellow-400",
  },
  {
    name: "ncertsheets-ai",
    language: "TypeScript",
    files: 58,
    updated: "Yesterday",
    color: "bg-blue-400",
  },
];

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <section className="flex items-end justify-between">
        <div>
          <p className="text-sm text-zinc-500">Saturday, October 31, 2026</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Repository Intelligence
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Understand your codebase. Predict the impact of every change.
          </p>
        </div>

        <button className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400">
          <Plus size={17} />
          Add Repository
        </button>
      </section>

      <section className="grid grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, change }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.07] bg-[#101014] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{label}</p>
              <Icon size={18} className="text-zinc-500" />
            </div>
            <h2 className="mt-5 text-3xl font-semibold">{value}</h2>
            <p className="mt-2 text-xs text-zinc-500">{change}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-[1.6fr_1fr] gap-5">
        <div className="rounded-xl border border-white/[0.07] bg-[#101014] p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Change Impact Intelligence</h3>
              <p className="mt-1 text-xs text-zinc-500">
                Understand what changes when a file is modified.
              </p>
            </div>
            <ShieldAlert size={20} className="text-indigo-400" />
          </div>

          <div className="mt-6 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.05] p-5">
            <p className="text-xs font-medium text-indigo-400">
              IMPACT PREVIEW
            </p>
            <h4 className="mt-3 text-lg font-medium">Analyze a code change</h4>
            <p className="mt-2 max-w-md text-sm leading-6 text-zinc-500">
              Select a file or commit to discover dependent modules, potentially
              affected functions and downstream risks.
            </p>
            <button className="mt-5 flex items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300">
              Start impact analysis <ArrowUpRight size={16} />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-[#101014] p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Dependency Overview</h3>
            <Workflow size={19} className="text-indigo-400" />
          </div>

          <div className="mt-6 flex h-36 items-center justify-center">
            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3">
                <FileCode2 className="text-indigo-400" />
              </div>
              <div className="h-px w-8 bg-indigo-500/50" />
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
                <Workflow className="text-purple-400" />
              </div>
              <div className="h-px w-8 bg-indigo-500/50" />
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                <GitBranch className="text-emerald-400" />
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-zinc-500">
            1,024 mapped relationships
          </p>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.07] bg-[#101014]">
        <div className="flex items-center justify-between border-b border-white/[0.07] p-6">
          <div>
            <h3 className="font-semibold">Recent Repositories</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Your recently indexed codebases
            </p>
          </div>
          <button className="text-xs text-indigo-400">View all</button>
        </div>

        {repositories.map((repo) => (
          <div
            key={repo.name}
            className="flex items-center justify-between border-b border-white/[0.05] px-6 py-5 last:border-0 hover:bg-white/[0.02]"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-white/[0.05] p-3">
                <GitBranch size={20} className="text-zinc-300" />
              </div>
              <div>
                <h4 className="text-sm font-medium">{repo.name}</h4>
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                  <span className={`h-2 w-2 rounded-full ${repo.color}`} />
                  {repo.language}
                  <span>·</span>
                  {repo.files} files
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Clock3 size={14} />
              {repo.updated}
              <ArrowUpRight size={15} className="ml-3" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
