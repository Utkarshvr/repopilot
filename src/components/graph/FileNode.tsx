import { Handle, Position, type NodeProps } from "@xyflow/react";
import { FileCode2, Layers, Component } from "lucide-react";

export type FileNodeData = {
  label: string;
  path: string;
  type: "component" | "page" | "utility";
  dependencies: number;
};

const icons = {
  component: Component,
  page: FileCode2,
  utility: Layers,
};

export default function FileNode({ data, selected }: NodeProps<any>) {
  const Icon = icons[data.type as keyof typeof icons] || FileCode2;

  return (
    <div
      className={`min-w-[175px] rounded-xl border bg-[#15151b] p-3 shadow-xl transition-all ${
        selected
          ? "border-indigo-400 shadow-indigo-500/20"
          : "border-white/10"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-indigo-400"
      />

      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-indigo-500/10 p-2">
          <Icon size={17} className="text-indigo-400" />
        </div>

        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-zinc-100">
            {data.label}
          </p>
          <p className="mt-1 text-[10px] capitalize text-zinc-500">
            {data.type}
          </p>
        </div>
      </div>

      <div className="mt-3 border-t border-white/[0.07] pt-2">
        <p className="text-[10px] text-zinc-500">
          {data.dependencies} dependencies
        </p>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-indigo-400"
      />
    </div>
  );
}