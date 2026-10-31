export default function GraphLegend() {
  const items = [
    { color: "bg-indigo-400", label: "Selected" },
    { color: "bg-sky-400", label: "Dependency (imports)" },
    { color: "bg-amber-400", label: "Dependent (imported by)" },
    { color: "bg-zinc-600", label: "Unrelated (dimmed)" },
  ];

  return (
    <div className="absolute bottom-4 left-4 z-10 rounded-lg border border-white/10 bg-[#18181f]/95 px-3 py-2.5 backdrop-blur">
      <p className="mb-2 text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
        Legend
      </p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-[11px] text-zinc-400">
            <span className={`h-2 w-2 rounded-full ${item.color}`} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
