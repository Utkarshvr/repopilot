import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  Box,
  Component,
  Database,
  FileCode2,
  Layers,
  LayoutTemplate,
  Store,
  AppWindow,
} from "lucide-react";
import type { FileKind } from "@/types";
import { cn } from "@/lib/utils";

export type FileNodeData = {
  label: string;
  path: string;
  kind: FileKind;
  dependencies: number;
  dependents: number;
  highlightRole?: "selected" | "dependency" | "dependent" | "dimmed" | "idle";
};

export type FileFlowNode = Node<FileNodeData, "file">;

const kindMeta: Record<
  FileKind,
  { icon: typeof FileCode2; accent: string; chip: string }
> = {
  entry: {
    icon: AppWindow,
    accent: "text-emerald-400 bg-emerald-500/10",
    chip: "entry",
  },
  app: {
    icon: Box,
    accent: "text-indigo-400 bg-indigo-500/10",
    chip: "app",
  },
  page: {
    icon: FileCode2,
    accent: "text-sky-400 bg-sky-500/10",
    chip: "page",
  },
  layout: {
    icon: LayoutTemplate,
    accent: "text-violet-400 bg-violet-500/10",
    chip: "layout",
  },
  component: {
    icon: Component,
    accent: "text-indigo-300 bg-indigo-500/10",
    chip: "component",
  },
  store: {
    icon: Store,
    accent: "text-amber-400 bg-amber-500/10",
    chip: "store",
  },
  utility: {
    icon: Layers,
    accent: "text-zinc-300 bg-zinc-500/10",
    chip: "utility",
  },
  data: {
    icon: Database,
    accent: "text-teal-400 bg-teal-500/10",
    chip: "data",
  },
  ui: {
    icon: Component,
    accent: "text-fuchsia-400 bg-fuchsia-500/10",
    chip: "ui",
  },
};

export default function FileNode({ data, selected }: NodeProps<FileFlowNode>) {
  const meta = kindMeta[data.kind] ?? kindMeta.component;
  const Icon = meta.icon;
  const role = data.highlightRole ?? (selected ? "selected" : "idle");

  return (
    <div
      className={cn(
        "min-w-[190px] max-w-[220px] rounded-xl border bg-[#15151b] p-3 shadow-lg transition-all duration-200",
        role === "selected" &&
          "border-indigo-400 shadow-indigo-500/25 ring-1 ring-indigo-400/40",
        role === "dependency" && "border-sky-500/50 shadow-sky-500/10",
        role === "dependent" && "border-amber-500/50 shadow-amber-500/10",
        role === "dimmed" && "border-white/5 opacity-30",
        role === "idle" && "border-white/10",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2 !w-2 !border-0 !bg-indigo-400"
      />

      <div className="flex items-start gap-2.5">
        <div className={cn("rounded-lg p-2", meta.accent)}>
          <Icon size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-zinc-100">
            {data.label}
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
            {data.path}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.07] pt-2">
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] capitalize text-zinc-400">
          {meta.chip}
        </span>
        <span className="text-[10px] tabular-nums text-zinc-500">
          {data.dependencies} dep · {data.dependents} used
        </span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2 !w-2 !border-0 !bg-indigo-400"
      />
    </div>
  );
}
