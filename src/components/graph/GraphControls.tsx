import { Maximize, RotateCcw } from "lucide-react";
import { useReactFlow } from "@xyflow/react";

export default function GraphControls() {
  const { fitView, setViewport } = useReactFlow();

  return (
    <div className="absolute right-4 top-4 z-10 flex gap-2">
      <button
        type="button"
        onClick={() => fitView({ padding: 0.25, duration: 400 })}
        className="rounded-lg border border-white/10 bg-[#18181f] p-2 text-zinc-400 transition hover:text-white"
        title="Fit to view"
      >
        <Maximize size={15} />
      </button>

      <button
        type="button"
        onClick={() => setViewport({ x: 0, y: 0, zoom: 0.85 }, { duration: 400 })}
        className="rounded-lg border border-white/10 bg-[#18181f] p-2 text-zinc-400 transition hover:text-white"
        title="Reset viewport"
      >
        <RotateCcw size={15} />
      </button>
    </div>
  );
}
