import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";

import FileNode, { type FileNodeData } from "./FileNode";
import GraphControls from "./GraphControls";

const initialNodes: Node<FileNodeData>[] = [
  {
    id: "app",
    position: { x: 350, y: 200 },
    data: {
      label: "App.tsx",
      path: "src/App.tsx",
      type: "page",
      dependencies: 3,
    },
    type: "file",
  },
  {
    id: "dashboard",
    position: { x: 650, y: 80 },
    data: {
      label: "Dashboard.tsx",
      path: "src/pages/Dashboard.tsx",
      type: "page",
      dependencies: 2,
    },
    type: "file",
  },
  {
    id: "layout",
    position: { x: 650, y: 300 },
    data: {
      label: "AppLayout.tsx",
      path: "src/components/layout/AppLayout.tsx",
      type: "component",
      dependencies: 2,
    },
    type: "file",
  },
  {
    id: "sidebar",
    position: { x: 950, y: 220 },
    data: {
      label: "Sidebar.tsx",
      path: "src/components/layout/Sidebar.tsx",
      type: "component",
      dependencies: 1,
    },
    type: "file",
  },
  {
    id: "header",
    position: { x: 950, y: 390 },
    data: {
      label: "Header.tsx",
      path: "src/components/layout/Header.tsx",
      type: "component",
      dependencies: 1,
    },
    type: "file",
  },
  {
    id: "utils",
    position: { x: 350, y: 450 },
    data: {
      label: "utils.ts",
      path: "src/lib/utils.ts",
      type: "utility",
      dependencies: 0,
    },
    type: "file",
  },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "app", target: "dashboard", animated: true },
  { id: "e2", source: "app", target: "layout", animated: true },
  { id: "e3", source: "layout", target: "sidebar" },
  { id: "e4", source: "layout", target: "header" },
  { id: "e5", source: "dashboard", target: "utils" },
  { id: "e6", source: "layout", target: "utils" },
];

const nodeTypes = { file: FileNode };

export default function DependencyGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const handleNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNode(node.id);
  }, []);

  const highlightedIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();

    const connected = new Set([selectedNode]);

    edges.forEach((edge) => {
      if (edge.source === selectedNode) connected.add(edge.target);
      if (edge.target === selectedNode) connected.add(edge.source);
    });

    return connected;
  }, [selectedNode, edges]);

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNode,
        style: {
          opacity: !selectedNode || highlightedIds.has(node.id) ? 1 : 0.25,
          transition: "opacity 200ms ease",
        },
      })),
    [nodes, selectedNode, highlightedIds],
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => {
        const active =
          !selectedNode ||
          (highlightedIds.has(edge.source) && highlightedIds.has(edge.target));

        return {
          ...edge,
          animated: active && selectedNode !== null,
          style: {
            stroke: active ? "#818cf8" : "#38383f",
            strokeWidth: active ? 2 : 1,
            opacity: active ? 1 : 0.15,
          },
        };
      }),
    [edges, selectedNode, highlightedIds],
  );

  const selectedFile = nodes.find((node) => node.id === selectedNode);

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-[#101014]">
      <div className="flex items-center justify-between border-b border-white/[0.07] p-5">
        <div>
          <h3 className="font-semibold">Dependency Graph</h3>
          <p className="mt-1 text-xs text-zinc-500">
            Explore relationships between source files
          </p>
        </div>

        <button
          onClick={() => setSelectedNode(null)}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 hover:text-white"
        >
          Clear selection
        </button>
      </div>

      <div className="relative h-[520px]">
        <ReactFlow
          nodes={styledNodes}
          edges={styledEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          onPaneClick={() => setSelectedNode(null)}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#33333a"
          />

          <Controls
            showInteractive={false}
            className="!border-white/10 !bg-[#18181f] [&>button]:!border-white/10 [&>button]:!bg-[#18181f] [&>button]:!fill-zinc-400"
          />

          <MiniMap
            nodeColor="#6366f1"
            maskColor="rgba(0,0,0,0.65)"
            className="!border !border-white/10 !bg-[#18181f]"
          />

          <GraphControls />
        </ReactFlow>
      </div>

      <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-3">
        <div className="flex items-center gap-4 text-[11px] text-zinc-500">
          <span>{nodes.length} files</span>
          <span>{edges.length} relationships</span>
          <span className="text-indigo-400">Interactive</span>
        </div>

        {selectedFile && (
          <div className="text-xs text-indigo-400">
            Selected: {selectedFile.data.label}
          </div>
        )}
      </div>
    </div>
  );
}
