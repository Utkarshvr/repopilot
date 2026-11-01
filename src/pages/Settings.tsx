import { Bell, GitBranch, Moon, Shield } from "lucide-react";

const sections = [
  {
    title: "Appearance",
    description: "RepoPilot uses a dark developer-focused interface.",
    icon: Moon,
    rows: [
      { label: "Theme", value: "Dark (zinc)" },
      { label: "Accent", value: "Indigo" },
      { label: "Density", value: "Comfortable" },
    ],
  },
  {
    title: "Integrations",
    description: "Public GitHub repository analysis is available from Repositories.",
    icon: GitBranch,
    rows: [
      { label: "Public repositories", value: "Supported" },
      { label: "Webhook sync", value: "Not available" },
      { label: "Private repos", value: "Not supported" },
    ],
  },
  {
    title: "Analysis",
    description: "Repository dependencies are extracted from JavaScript and TypeScript source.",
    icon: Shield,
    rows: [
      { label: "Dependency source", value: "GitHub source analysis" },
      { label: "Impact model", value: "Revision-aware dependency traversal" },
      { label: "Explanations", value: "Dependency paths and structural factors" },
    ],
  },
  {
    title: "Notifications",
    description: "Notifications are not configured in this release.",
    icon: Bell,
    rows: [
      { label: "Impact alerts", value: "Not configured" },
      { label: "Graph updates", value: "Manual re-analysis" },
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
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          Read-only product capabilities for this release. Preferences and notification settings are not configurable.
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
