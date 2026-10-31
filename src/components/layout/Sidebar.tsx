import { NavLink } from "react-router-dom";
import {
  Activity,
  GitBranch,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Workflow,
  GitCompareArrows,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Overview", href: "/", icon: LayoutDashboard },
  { name: "Repositories", href: "/repositories", icon: GitBranch },
  { name: "Dependency Graph", href: "/graph", icon: Workflow },
  { name: "Change Analysis", href: "/changes", icon: GitCompareArrows },
  { name: "Impact Analysis", href: "/impact", icon: ShieldAlert },
];

export default function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col border-r border-white/[0.07] bg-[#0d0d10]">
      <div className="flex h-16 items-center gap-3 border-b border-white/[0.07] px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500">
          <GitBranch size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold tracking-tight">RepoPilot</h1>
          <p className="text-[10px] tracking-[0.14em] text-zinc-500">
            CODE INTELLIGENCE
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-6">
        <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          WORKSPACE
        </p>

        <nav className="space-y-0.5">
          {navigation.map(({ name, href, icon: Icon }) => (
            <NavLink
              key={name}
              to={href}
              end={href === "/"}
              className={({ isActive }) =>
                cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                  isActive
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100",
                )
              }
            >
              <Icon size={16} />
              {name}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/[0.07] p-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
              isActive
                ? "bg-indigo-500/10 text-indigo-400"
                : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100",
            )
          }
        >
          <Settings size={16} />
          Settings
        </NavLink>

        <div className="mt-3 rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-emerald-400" />
            <span className="text-xs font-medium text-zinc-300">
              Systems operational
            </span>
          </div>
          <p className="mt-1.5 text-[10px] text-zinc-500">RepoPilot v0.1.0 · Phase I</p>
        </div>
      </div>
    </aside>
  );
}
