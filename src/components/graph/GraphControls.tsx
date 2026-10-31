import { Maximize, RotateCcw } from "lucide-react";
import { useReactFlow } from "@xyflow/react";

export default function GraphControls() {
  const { fitView, setViewport } = useReactFlow();

  return (
    <div className="absolute right-4 top-4 z-10 flex gap-2">
      <button
        onClick={() => fitView({ padding: 0.3, duration: 400 })}
        className="rounded-lg border border-white/10 bg-[#18181f] p-2 text-zinc-400 hover:text-white"
        title="Fit graph"
      >
        <Maximize size={16} />
      </button>

      <button
        onClick={() => setViewport({ x: 0, y: 0, zoom: 1 }, { duration: 400 })}
        className="rounded-lg border border-white/10 bg-[#18181f] p-2 text-zinc-400 hover:text-white"
        title="Reset view"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}