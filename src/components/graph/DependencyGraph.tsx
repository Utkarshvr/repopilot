import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import FileNode, {
  type FileFlowNode,
  type FileNodeData,
} from "./FileNode";
import GraphControls from "./GraphControls";
import GraphLegend from "./GraphLegend";
import GraphInfoPanel from "./GraphInfoPanel";
import { MockBadge } from "@/components/shared/MockBadge";

import {
  buildGraphIndex,
  computeSelectionHighlight,
} from "@/lib/graph";
import { useAppStore } from "@/store/useAppStore";
import type { DependencyGraphData, GraphSelectionHighlight } from "@/types";

const nodeTypes = { file: FileNode };

export type GraphImpactHighlight = {
  direct: Set<string>;
  transitive: Set<string>;
  changed?: Set<string>;
  pathNodeIds?: Set<string>;
  pathEdgeIds?: Set<string>;
};

function buildInitialNodes(graph: DependencyGraphData): FileFlowNode[] {
  return graph.files.map((file) => ({
    id: file.id,
    type: "file" as const,
    position: graph.positions[file.id] ?? { x: 0, y: 0 },
    data: {
      label: file.name,
      path: file.path,
      kind: file.kind,
      dependencies: file.dependencyCount,
      dependents: file.dependentCount,
      highlightRole: "idle" as const,
    },
  }));
}

function buildInitialEdges(graph: DependencyGraphData): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: "smoothstep",
    style: { stroke: "#3f3f46", strokeWidth: 1, opacity: 0.55 },
  }));
}

function applyHighlightToNodes(
  nodes: FileFlowNode[],
  highlight: GraphSelectionHighlight,
  highlightMode: "dependencies" | "dependents" | "neighborhood",
  impact?: GraphImpactHighlight,
): FileFlowNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    let highlightRole: FileNodeData["highlightRole"] = "idle";
    if (impact) {
      if (impact.changed?.has(node.id)) highlightRole = "changed";
      else if (impact.direct.has(node.id)) highlightRole = "directImpact";
      else if (impact.transitive.has(node.id)) highlightRole = "transitiveImpact";
      else if (impact.pathNodeIds?.has(node.id)) highlightRole = "impactPath";
      else highlightRole = "dimmed";
    } else if (highlight.selectedId) {
      if (node.id === highlight.selectedId) highlightRole = "selected";
      else if (highlight.dependencyIds.has(node.id) && highlightMode !== "dependents")
        highlightRole = "dependency";
      else if (highlight.dependentIds.has(node.id) && highlightMode !== "dependencies")
        highlightRole = "dependent";
      else if (highlight.transitiveDependencyIds.has(node.id) && highlightMode !== "dependents")
        highlightRole = "transitiveDependency";
      else if (highlight.transitiveDependentIds.has(node.id) && highlightMode !== "dependencies")
        highlightRole = "transitiveDependent";
      else highlightRole = "dimmed";
    }

    const selected = node.id === highlight.selectedId;
    if (node.selected === selected && node.data.highlightRole === highlightRole) return node;
    changed = true;
    return {
      ...node,
      selected,
      data: { ...node.data, highlightRole },
    };
  });
  return changed ? next : nodes;
}

function applyHighlightToEdges(
  edges: Edge[],
  highlight: GraphSelectionHighlight,
  impact?: GraphImpactHighlight,
): Edge[] {
  let changed = false;
  const next = edges.map((edge) => {
    const active = impact
      ? Boolean(impact.pathEdgeIds?.has(edge.id))
      : (!highlight.selectedId || highlight.highlightedEdgeIds.has(edge.id));

    const animated = Boolean(highlight.selectedId && active);
    const style = {
      stroke: impact?.pathEdgeIds?.has(edge.id)
        ? "#a78bfa"
        : active && highlight.selectedId ? "#818cf8" : "#3f3f46",
      strokeWidth: active ? 2 : 1,
      opacity: impact ? (active ? 1 : 0.08) : !highlight.selectedId ? 0.55 : active ? 1 : 0.12,
    };
    if (edge.animated === animated && edge.style?.stroke === style.stroke && edge.style?.strokeWidth === style.strokeWidth && edge.style?.opacity === style.opacity) return edge;
    changed = true;
    return {
      ...edge,
      animated,
      style,
    };
  });
  return changed ? next : edges;
}

function DependencyGraphCanvas({
  graph,
  heightClass = "h-[560px]",
  showInfoPanel = true,
  highlightedImpact,
}: {
  graph: DependencyGraphData;
  heightClass?: string;
  showInfoPanel?: boolean;
  highlightedImpact?: GraphImpactHighlight;
}) {
  const selectedFileId = useAppStore((s) => s.selectedFileId);
  const setSelectedFileId = useAppStore((s) => s.setSelectedFileId);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightMode, setHighlightMode] = useState<"dependencies" | "dependents" | "neighborhood">("neighborhood");
  const { setCenter } = useReactFlow();

  const index = useMemo(() => buildGraphIndex(graph), [graph]);
  const highlight = useMemo(
    () => computeSelectionHighlight(index, selectedFileId, highlightMode),
    [index, selectedFileId, highlightMode],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<FileFlowNode>(
    buildInitialNodes(graph),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    buildInitialEdges(graph),
  );

  useEffect(() => {
    setNodes(buildInitialNodes(graph));
    setEdges(buildInitialEdges(graph));
  }, [graph, setNodes, setEdges]);

  useEffect(() => {
    if (!selectedFileId) return;
    const node = nodes.find((candidate) => candidate.id === selectedFileId);
    if (node) setCenter(node.position.x + 110, node.position.y + 52, { zoom: 1.15, duration: 350 });
  }, [nodes, selectedFileId, setCenter]);

  useEffect(() => {
    setNodes((current) => applyHighlightToNodes(current, highlight, highlightMode, highlightedImpact));
    setEdges((current) => applyHighlightToEdges(current, highlight, highlightedImpact));
  }, [highlight, highlightMode, highlightedImpact, setNodes, setEdges]);

  const handleNodeClick: NodeMouseHandler<FileFlowNode> = useCallback(
    (_, node) => {
      setSelectedFileId(node.id);
    },
    [setSelectedFileId],
  );

  const selectedFile = selectedFileId
    ? index.filesById.get(selectedFileId)
    : undefined;

  const selectSearchMatch = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    if (!query) return;
    const match = graph.files.find((file) =>
      `${file.name} ${file.path}`.toLowerCase().includes(query),
    );
    if (match) setSelectedFileId(match.id);
  }, [graph.files, searchQuery, setSelectedFileId]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#101014]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Dependency Graph</h3>
            <MockBadge provenance={graph.provenance} />
          </div>
          <p className="mt-1 text-xs text-zinc-500">{graph.note}</p>
        </div>

        <div className="flex items-center gap-2">
          <form onSubmit={selectSearchMatch} className="flex items-center gap-1.5">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search file or path…"
              aria-label="Search graph files by name or path"
              className="w-44 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-500/40"
            />
            <button type="submit" className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-white">Find</button>
          </form>
          <button
            type="button"
            onClick={clearSelection}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-white"
          >
            Clear selection
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-5 py-2">
        <span className="text-[10px] text-zinc-500">Highlight</span>
        {(["dependencies", "dependents", "neighborhood"] as const).map((mode) => (
          <button key={mode} type="button" onClick={() => setHighlightMode(mode)}
            className={`rounded border px-2 py-1 text-[10px] transition ${highlightMode === mode ? "border-indigo-400/40 bg-indigo-500/10 text-indigo-300" : "border-white/10 text-zinc-500 hover:text-zinc-200"}`}>
            {mode === "dependencies" ? "Dependencies" : mode === "dependents" ? "Dependents" : "Full neighborhood"}
          </button>
        ))}
      </div>

      <div className={`flex flex-col lg:flex-row ${heightClass}`}>
        <div className="relative min-h-[420px] flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            onPaneClick={clearSelection}
            nodeTypes={nodeTypes}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.15}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{ type: "smoothstep" }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={18}
              size={1}
              color="#2a2a32"
            />
            <Controls
              showInteractive={false}
              className="!border-white/10 !bg-[#18181f] [&>button]:!border-white/10 [&>button]:!bg-[#18181f] [&>button]:!fill-zinc-400"
            />
            <MiniMap
              nodeColor={(node) => {
                const role = (node.data as FileNodeData).highlightRole;
                if (role === "selected") return "#818cf8";
                if (role === "dependency") return "#38bdf8";
                if (role === "dependent") return "#fbbf24";
                if (role === "transitiveDependency") return "#0e7490";
                if (role === "transitiveDependent") return "#b45309";
                return "#3f3f46";
              }}
              maskColor="rgba(0,0,0,0.7)"
              className="!border !border-white/10 !bg-[#18181f]"
            />
            <GraphControls />
            <GraphLegend impactMode={Boolean(highlightedImpact)} />
          </ReactFlow>
        </div>

        {showInfoPanel && selectedFile ? (
          <GraphInfoPanel
            file={selectedFile}
            highlight={highlight}
            filesById={index.filesById}
            transitiveDependencyCount={highlight.transitiveDependencyIds.size}
            transitiveDependentCount={highlight.transitiveDependentIds.size}
            circularGroup={index.circularGroupByFile.get(selectedFile.id) ?? null}
            onClose={clearSelection}
            provenance={graph.provenance}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] px-5 py-2.5">
        <div className="flex items-center gap-4 text-[11px] text-zinc-500">
          <span>{graph.files.length} files</span>
          <span>{graph.edges.length} relationships</span>
          <span className="text-indigo-400">Interactive · pan / zoom</span>
        </div>
        {selectedFile ? (
          <p className="text-xs text-indigo-300">
            Selected: {selectedFile.name}
          </p>
        ) : (
          <p className="text-xs text-zinc-600">Click a node to inspect</p>
        )}
      </div>
    </div>
  );
}

export default function DependencyGraph({
  graph,
  heightClass,
  showInfoPanel = true,
  highlightedImpact,
}: {
  graph: DependencyGraphData;
  heightClass?: string;
  showInfoPanel?: boolean;
  highlightedImpact?: GraphImpactHighlight;
}) {
  return (
    <ReactFlowProvider>
      <DependencyGraphCanvas
        graph={graph}
        heightClass={heightClass}
        showInfoPanel={showInfoPanel}
        highlightedImpact={highlightedImpact}
      />
    </ReactFlowProvider>
  );
}
