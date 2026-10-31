import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
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
import { repoPilotGraph } from "@/data/mockDependencyGraph";
import {
  buildGraphIndex,
  computeSelectionHighlight,
} from "@/lib/graph";
import { useAppStore } from "@/store/useAppStore";
import type { DependencyGraphData, GraphSelectionHighlight } from "@/types";

const nodeTypes = { file: FileNode };

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
): FileFlowNode[] {
  return nodes.map((node) => {
    let highlightRole: FileNodeData["highlightRole"] = "idle";
    if (highlight.selectedId) {
      if (node.id === highlight.selectedId) highlightRole = "selected";
      else if (highlight.dependencyIds.has(node.id))
        highlightRole = "dependency";
      else if (highlight.dependentIds.has(node.id))
        highlightRole = "dependent";
      else highlightRole = "dimmed";
    }

    return {
      ...node,
      selected: node.id === highlight.selectedId,
      data: { ...node.data, highlightRole },
    };
  });
}

function applyHighlightToEdges(
  edges: Edge[],
  highlight: GraphSelectionHighlight,
): Edge[] {
  return edges.map((edge) => {
    const active =
      !highlight.selectedId || highlight.highlightedEdgeIds.has(edge.id);

    return {
      ...edge,
      animated: Boolean(highlight.selectedId && active),
      style: {
        stroke: active && highlight.selectedId ? "#818cf8" : "#3f3f46",
        strokeWidth: active && highlight.selectedId ? 2 : 1,
        opacity: !highlight.selectedId ? 0.55 : active ? 1 : 0.12,
      },
    };
  });
}

function DependencyGraphCanvas({
  graph,
  heightClass = "h-[560px]",
  showInfoPanel = true,
}: {
  graph: DependencyGraphData;
  heightClass?: string;
  showInfoPanel?: boolean;
}) {
  const selectedFileId = useAppStore((s) => s.selectedFileId);
  const setSelectedFileId = useAppStore((s) => s.setSelectedFileId);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const index = useMemo(() => buildGraphIndex(graph), [graph]);
  const highlight = useMemo(
    () => computeSelectionHighlight(index, selectedFileId),
    [index, selectedFileId],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<FileFlowNode>(
    buildInitialNodes(graph),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    buildInitialEdges(graph),
  );

  useEffect(() => {
    setNodes((current) => applyHighlightToNodes(current, highlight));
    setEdges((current) => applyHighlightToEdges(current, highlight));
  }, [highlight, setNodes, setEdges]);

  const handleNodeClick: NodeMouseHandler<FileFlowNode> = useCallback(
    (_, node) => {
      setSelectedFileId(node.id);
    },
    [setSelectedFileId],
  );

  const selectedFile = selectedFileId
    ? index.filesById.get(selectedFileId)
    : undefined;

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

        <button
          type="button"
          onClick={clearSelection}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-white"
        >
          Clear selection
        </button>
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
                return "#3f3f46";
              }}
              maskColor="rgba(0,0,0,0.7)"
              className="!border !border-white/10 !bg-[#18181f]"
            />
            <GraphControls />
            <GraphLegend />
          </ReactFlow>
        </div>

        {showInfoPanel && selectedFile ? (
          <GraphInfoPanel
            file={selectedFile}
            highlight={highlight}
            filesById={index.filesById}
            onClose={clearSelection}
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
  graph = repoPilotGraph,
  heightClass,
  showInfoPanel = true,
}: {
  graph?: DependencyGraphData;
  heightClass?: string;
  showInfoPanel?: boolean;
}) {
  return (
    <ReactFlowProvider>
      <DependencyGraphCanvas
        graph={graph}
        heightClass={heightClass}
        showInfoPanel={showInfoPanel}
      />
    </ReactFlowProvider>
  );
}
