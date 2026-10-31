import {
  Activity,
  GitBranch,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Workflow,
} from "lucide-react";

const navigation = [
  { name: "Overview", icon: LayoutDashboard, active: true },
  { name: "Repositories", icon: GitBranch },
  { name: "Dependency Graph", icon: Workflow },
  { name: "Impact Analysis", icon: ShieldAlert },
];

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col border-r border-white/[0.07] bg-[#0d0d10]">
      <div className="flex h-20 items-center gap-3 border-b border-white/[0.07] px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500">
          <GitBranch size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">RepoPilot</h1>
          <p className="text-[10px] tracking-widest text-zinc-500">
            CODE INTELLIGENCE
          </p>
        </div>
      </div>

      <div className="px-4 py-7">
        <p className="mb-3 px-3 text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          WORKSPACE
        </p>

        <nav className="space-y-1">
          {navigation.map(({ name, icon: Icon, active }) => (
            <button
              key={name}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${
                active
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Icon size={17} />
              {name}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto border-t border-white/[0.07] p-4">
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm text-zinc-400 hover:bg-white/[0.04]">
          <Settings size={17} />
          Settings
        </button>

        <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <Activity size={15} className="text-emerald-400" />
            <span className="text-xs font-medium">All systems operational</span>
          </div>
          <p className="mt-2 text-[10px] text-zinc-500">RepoPilot v0.1.0</p>
        </div>
      </div>
    </aside>
  );
}
