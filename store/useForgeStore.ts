/**
 * Forge-AI — Unified Store
 * -----------------------------------------------------------------------------
 * A single Zustand store split into three well-isolated slices:
 *
 *   • assetSlice   — Asset-AI forensic pipeline (mask + relight + composite)
 *   • sketchSlice  — ChromaSketch vector strokes + dream canvas
 *   • graphSlice   — Doculens JSON-LD ontology graph
 *
 * Each slice owns its own state and actions but shares the same hook, which
 * avoids prop-drilling across lab routes while keeping strong typing.
 * -----------------------------------------------------------------------------
 */

"use client";

import { create, StateCreator } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ForensicReport,
  SemanticInterpretation,
  OntologyNode,
  VectorStroke,
} from "@/lib/ai-schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LabId = "asset-ai" | "chromasketch" | "doculens";
export type PipelineStatus = "idle" | "uploading" | "segmenting" | "inpainting" | "compositing" | "done" | "error";

export interface AssetSlice {
  sourceImage: string | null;
  sourceFilename: string | null;
  sourceDimensions: { width: number; height: number } | null;
  prompt: string;
  negativePrompt: string;
  style: "studio" | "lifestyle" | "editorial" | "surreal" | "minimal";
  strength: number;
  status: PipelineStatus;
  progress: number;
  error: string | null;
  report: ForensicReport | null;
  /** Final client-side composited data URL (mask + relight applied). */
  composite: string | null;
  history: Array<{ id: string; thumbnail: string; prompt: string; at: string }>;

  setSource: (dataUrl: string, filename: string, width: number, height: number) => void;
  setPrompt: (p: string) => void;
  setNegativePrompt: (p: string) => void;
  setStyle: (s: AssetSlice["style"]) => void;
  setStrength: (s: number) => void;
  setStatus: (s: PipelineStatus, progress?: number) => void;
  setReport: (r: ForensicReport) => void;
  setComposite: (dataUrl: string) => void;
  setError: (e: string | null) => void;
  pushHistory: (entry: AssetSlice["history"][number]) => void;
  resetAsset: () => void;
}

export type DrawTool = VectorStroke["tool"];
export type SketchStyle = "photoreal" | "oil" | "watercolor" | "cyberpunk" | "ink" | "isometric";

export interface SketchSlice {
  strokes: VectorStroke[];
  undone: VectorStroke[];
  color: string;
  brushSize: number;
  tool: DrawTool;
  style: SketchStyle;
  hint: string;
  isStreaming: boolean;
  interpretation: SemanticInterpretation | null;
  dreamHistory: Array<{ id: string; imageUrl: string; subject: string; at: string }>;
  error: string | null;

  addStroke: (s: VectorStroke) => void;
  undo: () => void;
  redo: () => void;
  clearStrokes: () => void;
  setColor: (c: string) => void;
  setBrushSize: (n: number) => void;
  setTool: (t: DrawTool) => void;
  setStyle: (s: SketchStyle) => void;
  setHint: (h: string) => void;
  setStreaming: (v: boolean) => void;
  setInterpretation: (i: SemanticInterpretation | null) => void;
  pushDream: (entry: SketchSlice["dreamHistory"][number]) => void;
  setSketchError: (e: string | null) => void;
}

export interface GraphSlice {
  nodes: Record<string, OntologyNode>;
  selectedNodeId: string | null;
  query: string;
  filterType: string | null;
  isIngesting: boolean;
  ingestError: string | null;

  upsertNode: (node: OntologyNode) => void;
  removeNode: (id: string) => void;
  linkNodes: (sourceId: string, targetId: string) => void;
  setSelected: (id: string | null) => void;
  setQuery: (q: string) => void;
  setFilterType: (t: string | null) => void;
  setIngesting: (v: boolean) => void;
  setIngestError: (e: string | null) => void;
  clearGraph: () => void;

  /** Contextual-relationship search — traverses triples up to `depth` hops. */
  search: (q: string) => OntologyNode[];
  related: (nodeId: string, depth?: number) => OntologyNode[];
}

export interface ForgeState {
  activeLab: LabId;
  setActiveLab: (lab: LabId) => void;

  asset: AssetSlice;
  sketch: SketchSlice;
  graph: GraphSlice;
}

// ---------------------------------------------------------------------------
// Slices
// ---------------------------------------------------------------------------

const createAssetSlice: StateCreator<ForgeState, [], [], { asset: AssetSlice }> = (set) => ({
  asset: {
    sourceImage: null,
    sourceFilename: null,
    sourceDimensions: null,
    prompt: "A minimalist marble pedestal in a sunlit Scandinavian studio",
    negativePrompt: "low quality, blurry, distorted, text, watermark",
    style: "studio",
    strength: 0.85,
    status: "idle",
    progress: 0,
    error: null,
    report: null,
    composite: null,
    history: [],

    setSource: (dataUrl, filename, width, height) =>
      set((s) => ({
        asset: {
          ...s.asset,
          sourceImage: dataUrl,
          sourceFilename: filename,
          sourceDimensions: { width, height },
          status: "idle",
          error: null,
          report: null,
          composite: null,
        },
      })),
    setPrompt: (p) => set((s) => ({ asset: { ...s.asset, prompt: p } })),
    setNegativePrompt: (p) => set((s) => ({ asset: { ...s.asset, negativePrompt: p } })),
    setStyle: (style) => set((s) => ({ asset: { ...s.asset, style } })),
    setStrength: (strength) => set((s) => ({ asset: { ...s.asset, strength } })),
    setStatus: (status, progress) =>
      set((s) => ({
        asset: {
          ...s.asset,
          status,
          progress: typeof progress === "number" ? progress : s.asset.progress,
          error: status === "error" ? s.asset.error : null,
        },
      })),
    setReport: (report) => set((s) => ({ asset: { ...s.asset, report } })),
    setComposite: (composite) => set((s) => ({ asset: { ...s.asset, composite } })),
    setError: (error) =>
      set((s) => ({ asset: { ...s.asset, error, status: error ? "error" : s.asset.status } })),
    pushHistory: (entry) =>
      set((s) => ({ asset: { ...s.asset, history: [entry, ...s.asset.history].slice(0, 24) } })),
    resetAsset: () =>
      set((s) => ({
        asset: {
          ...s.asset,
          sourceImage: null,
          sourceFilename: null,
          sourceDimensions: null,
          status: "idle",
          progress: 0,
          error: null,
          report: null,
          composite: null,
        },
      })),
  },
});

const createSketchSlice: StateCreator<ForgeState, [], [], { sketch: SketchSlice }> = (set) => ({
  sketch: {
    strokes: [],
    undone: [],
    color: "#A78BFA",
    brushSize: 6,
    tool: "pen",
    style: "photoreal",
    hint: "",
    isStreaming: false,
    interpretation: null,
    dreamHistory: [],
    error: null,

    addStroke: (stroke) =>
      set((s) => ({ sketch: { ...s.sketch, strokes: [...s.sketch.strokes, stroke], undone: [] } })),
    undo: () =>
      set((s) => {
        if (s.sketch.strokes.length === 0) return s;
        const next = [...s.sketch.strokes];
        const popped = next.pop()!;
        return { sketch: { ...s.sketch, strokes: next, undone: [...s.sketch.undone, popped] } };
      }),
    redo: () =>
      set((s) => {
        if (s.sketch.undone.length === 0) return s;
        const next = [...s.sketch.undone];
        const popped = next.pop()!;
        return { sketch: { ...s.sketch, strokes: [...s.sketch.strokes, popped], undone: next } };
      }),
    clearStrokes: () => set((s) => ({ sketch: { ...s.sketch, strokes: [], undone: [] } })),
    setColor: (color) => set((s) => ({ sketch: { ...s.sketch, color } })),
    setBrushSize: (brushSize) => set((s) => ({ sketch: { ...s.sketch, brushSize } })),
    setTool: (tool) => set((s) => ({ sketch: { ...s.sketch, tool } })),
    setStyle: (style) => set((s) => ({ sketch: { ...s.sketch, style } })),
    setHint: (hint) => set((s) => ({ sketch: { ...s.sketch, hint } })),
    setStreaming: (isStreaming) => set((s) => ({ sketch: { ...s.sketch, isStreaming } })),
    setInterpretation: (interpretation) =>
      set((s) => ({ sketch: { ...s.sketch, interpretation } })),
    pushDream: (entry) =>
      set((s) => ({
        sketch: { ...s.sketch, dreamHistory: [entry, ...s.sketch.dreamHistory].slice(0, 16) },
      })),
    setSketchError: (error) => set((s) => ({ sketch: { ...s.sketch, error } })),
  },
});

const createGraphSlice: StateCreator<ForgeState, [], [], { graph: GraphSlice }> = (set, get) => ({
  graph: {
    nodes: {},
    selectedNodeId: null,
    query: "",
    filterType: null,
    isIngesting: false,
    ingestError: null,

    upsertNode: (node) =>
      set((s) => ({ graph: { ...s.graph, nodes: { ...s.graph.nodes, [node["@id"]]: node } } })),
    removeNode: (id) =>
      set((s) => {
        const next = { ...s.graph.nodes };
        delete next[id];
        for (const n of Object.values(next)) n.relatesTo = n.relatesTo.filter((r) => r !== id);
        return {
          graph: { ...s.graph, nodes: next, selectedNodeId: s.graph.selectedNodeId === id ? null : s.graph.selectedNodeId },
        };
      }),
    linkNodes: (sourceId, targetId) =>
      set((s) => {
        const src = s.graph.nodes[sourceId];
        if (!src) return s;
        if (src.relatesTo.includes(targetId)) return s;
        return {
          graph: {
            ...s.graph,
            nodes: {
              ...s.graph.nodes,
              [sourceId]: { ...src, relatesTo: [...src.relatesTo, targetId] },
            },
          },
        };
      }),
    setSelected: (id) => set((s) => ({ graph: { ...s.graph, selectedNodeId: id } })),
    setQuery: (query) => set((s) => ({ graph: { ...s.graph, query } })),
    setFilterType: (filterType) => set((s) => ({ graph: { ...s.graph, filterType } })),
    setIngesting: (isIngesting) => set((s) => ({ graph: { ...s.graph, isIngesting } })),
    setIngestError: (ingestError) => set((s) => ({ graph: { ...s.graph, ingestError } })),
    clearGraph: () =>
      set((s) => ({ graph: { ...s.graph, nodes: {}, selectedNodeId: null, query: "" } })),

    search: (q) => {
      const nodes = Object.values(get().graph.nodes);
      if (!q.trim()) return nodes;
      const needle = q.toLowerCase();
      return nodes.filter((n) => {
        const hay = [
          n.name,
          n.ocrText,
          n["@type"],
          ...n.tags,
          ...n.entities.map((e) => e.text),
          ...n.objects.map((o) => o.label),
          ...n.triples.map((t) => `${t.subject} ${t.predicate} ${t.object}`),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    },
    related: (nodeId, depth = 2) => {
      const nodes = get().graph.nodes;
      const visited = new Set<string>();
      const queue: Array<{ id: string; d: number }> = [{ id: nodeId, d: 0 }];
      while (queue.length > 0) {
        const { id, d } = queue.shift()!;
        if (visited.has(id) || d > depth) continue;
        visited.add(id);
        const node = nodes[id];
        if (!node) continue;
        for (const r of node.relatesTo) queue.push({ id: r, d: d + 1 });
      }
      visited.delete(nodeId);
      return Array.from(visited)
        .map((id) => nodes[id])
        .filter(Boolean);
    },
  },
});

// ---------------------------------------------------------------------------
// Root store (with opt-in localStorage persistence for the graph + history)
// ---------------------------------------------------------------------------

export const useForgeStore = create<ForgeState>()(
  persist(
    (set, get, api) => ({
      activeLab: "asset-ai",
      setActiveLab: (lab) => set({ activeLab: lab }),
      ...createAssetSlice(set, get, api),
      ...createSketchSlice(set, get, api),
      ...createGraphSlice(set, get, api),
    }),
    {
      name: "forge-ai-store",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? localStorage : ({
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      } as unknown as Storage))),
      partialize: (s) => ({
        activeLab: s.activeLab,
        asset: { history: s.asset.history },
        sketch: { dreamHistory: s.sketch.dreamHistory },
        graph: { nodes: s.graph.nodes },
      }) as unknown as ForgeState,
      merge: (persisted, current) => {
        const p = (persisted as Partial<ForgeState>) ?? {};
        return {
          ...current,
          activeLab: p.activeLab ?? current.activeLab,
          asset: {
            ...current.asset,
            history: p.asset?.history ?? current.asset.history,
          },
          sketch: {
            ...current.sketch,
            dreamHistory: p.sketch?.dreamHistory ?? current.sketch.dreamHistory,
          },
          graph: {
            ...current.graph,
            nodes: p.graph?.nodes ?? current.graph.nodes,
          },
        };
      },
    }
  )
);

// ---------------------------------------------------------------------------
// Convenience selectors
// ---------------------------------------------------------------------------

export const useAssetSlice = () => useForgeStore((s) => s.asset);
export const useSketchSlice = () => useForgeStore((s) => s.sketch);
export const useGraphSlice = () => useForgeStore((s) => s.graph);
export const useActiveLab = () => useForgeStore((s) => s.activeLab);
