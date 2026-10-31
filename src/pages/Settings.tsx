import { Bell, GitBranch, Moon, Shield } from "lucide-react";
import { MockBadge } from "@/components/shared/MockBadge";

const sections = [
  {
    title: "Appearance",
    description: "Developer-centric dark theme is the default for Phase I.",
    icon: Moon,
    rows: [
      { label: "Theme", value: "Dark (zinc)" },
      { label: "Accent", value: "Indigo" },
      { label: "Density", value: "Comfortable" },
    ],
  },
  {
    title: "Integrations",
    description: "External connections will land in Phase II.",
    icon: GitBranch,
    rows: [
      { label: "GitHub OAuth", value: "Not connected · Phase II" },
      { label: "Webhook sync", value: "Disabled · Phase II" },
      { label: "Private repos", value: "Requires auth · Phase II" },
    ],
  },
  {
    title: "Analysis",
    description: "Real AST and risk scoring arrive with Milestone 3.",
    icon: Shield,
    rows: [
      { label: "Dependency source", value: "Mock graph (Phase I)" },
      { label: "Impact model", value: "Simulated traversal" },
      { label: "AI explanations", value: "Not enabled · Phase II" },
    ],
  },
  {
    title: "Notifications",
    description: "Local UI placeholders only.",
    icon: Bell,
    rows: [
      { label: "Impact alerts", value: "On (mock)" },
      { label: "Graph updates", value: "On (mock)" },
      { label: "Email digest", value: "Off" },
    ],
  },
];

export default function Settings() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <MockBadge provenance="mock" />
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Workspace preferences for RepoPilot. Values below are UI scaffolding —
          no backend persistence yet.
        </p>
      </section>

      <div className="space-y-4">
        {sections.map(({ title, description, icon: Icon, rows }) => (
          <section
            key={title}
            className="rounded-xl border border-white/[0.07] bg-[#101014]"
          >
            <div className="flex items-start gap-3 border-b border-white/[0.07] px-5 py-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <Icon size={16} className="text-indigo-400" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">{title}</h2>
                <p className="mt-1 text-xs text-zinc-500">{description}</p>
              </div>
            </div>
            <ul className="divide-y divide-white/[0.05]">
              {rows.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <span className="text-sm text-zinc-400">{row.label}</span>
                  <span className="text-right text-sm text-zinc-200">
                    {row.value}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
