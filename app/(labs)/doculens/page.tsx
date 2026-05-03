"use client";

/**
 * Forge-AI — Doculens Lab
 * -----------------------------------------------------------------------------
 * Ontological asset manager with three synchronised views:
 *
 *   1. Ingest column    — drop images, watch OCR+vision run, see the JSON-LD
 *                          OntologyNode arrive in the graph slice.
 *   2. Graph canvas     — force-directed layout of every node; edges are the
 *                          RDF-style `relatesTo` links extracted by Claude.
 *   3. Inspector pane   — entity cloud, triples table, contextual-relationship
 *                          traversal up to 2 hops.
 * -----------------------------------------------------------------------------
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";
import {
  Upload,
  Search,
  Database,
  Network,
  Layers,
  Tag,
  Link2,
  Image as ImageIcon,
  Trash2,
  FileJson,
  RefreshCw,
  Wand2,
  AlertTriangle,
} from "lucide-react";

import { cn, uuid } from "@/lib/utils";
import { useForgeStore, useGraphSlice } from "@/store/useForgeStore";
import type { OntologyNode, Triple } from "@/lib/ai-schemas";

export default function DoculensPage() {
  const graph = useGraphSlice();
  const upsertNode = useForgeStore((s) => s.graph.upsertNode);
  const removeNode = useForgeStore((s) => s.graph.removeNode);
  const linkNodes = useForgeStore((s) => s.graph.linkNodes);
  const setSelected = useForgeStore((s) => s.graph.setSelected);
  const setQuery = useForgeStore((s) => s.graph.setQuery);
  const setFilterType = useForgeStore((s) => s.graph.setFilterType);
  const setIngesting = useForgeStore((s) => s.graph.setIngesting);
  const setIngestError = useForgeStore((s) => s.graph.setIngestError);
  const clearGraph = useForgeStore((s) => s.graph.clearGraph);
  const search = useForgeStore((s) => s.graph.search);
  const related = useForgeStore((s) => s.graph.related);

  const [ingestHint, setIngestHint] = useState("");
  const [uploading, setUploading] = useState<Array<{ id: string; name: string; progress: number }>>([]);

  const nodes = Object.values(graph.nodes);
  const types = useMemo(() => Array.from(new Set(nodes.map((n) => n["@type"]))).sort(), [nodes]);
  const visible = useMemo(() => {
    let list = search(graph.query);
    if (graph.filterType) list = list.filter((n) => n["@type"] === graph.filterType);
    return list;
  }, [nodes, graph.query, graph.filterType, search]);

  const selected = graph.selectedNodeId ? graph.nodes[graph.selectedNodeId] : null;
  const neighbours = selected ? related(selected["@id"], 2) : [];

  // ---------------------------------------------------------------------------
  // Drop → POST /api/graph-ingest
  // ---------------------------------------------------------------------------
  const onDrop = useCallback(
    async (files: File[]) => {
      setIngestError(null);
      for (const file of files) {
        const jobId = uuid();
        setUploading((u) => [...u, { id: jobId, name: file.name, progress: 10 }]);
        try {
          const dataUrl = await fileToDataUrl(file);
          setUploading((u) => u.map((x) => (x.id === jobId ? { ...x, progress: 40 } : x)));
          setIngesting(true);
          const res = await fetch("/api/graph-ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageDataUrl: dataUrl,
              filename: file.name,
              hint: ingestHint || undefined,
            }),
          });
          const json = await res.json();
          if (!json.ok) throw new Error(json.error ?? "Ingest failed");
          const node = json.data as OntologyNode;
          upsertNode(node);
          autoLinkNode(node, Object.values(useForgeStore.getState().graph.nodes), linkNodes);
          setSelected(node["@id"]);
          setUploading((u) => u.map((x) => (x.id === jobId ? { ...x, progress: 100 } : x)));
          setTimeout(() => setUploading((u) => u.filter((x) => x.id !== jobId)), 800);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Ingest error";
          setIngestError(msg);
          setUploading((u) => u.filter((x) => x.id !== jobId));
        } finally {
          setIngesting(false);
        }
      }
    },
    [ingestHint, upsertNode, linkNodes, setSelected, setIngesting, setIngestError]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    multiple: true,
    noClick: nodes.length > 0,
    noKeyboard: nodes.length > 0,
  });

  const exportJsonLd = () => {
    const doc = {
      "@context": "https://schema.org",
      "@graph": nodes,
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/ld+json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `doculens-${Date.now()}.jsonld`;
    a.click();
  };

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/5 bg-forge-obsidian/60 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <div className="label-xs">Lab 03</div>
            <h1 className="font-display text-2xl font-bold">
              Docu<span className="gradient-text">lens</span>
              <span className="ml-3 font-mono text-xs font-normal text-forge-ash">· Ontological Asset Map</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-forge-ash" />
              <input
                value={graph.query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Contextual search… (entities, OCR, triples)"
                className="input min-w-[320px] pl-8"
              />
            </div>
            <select
              value={graph.filterType ?? ""}
              onChange={(e) => setFilterType(e.target.value || null)}
              className="input min-w-[140px]"
            >
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button className="btn" onClick={exportJsonLd} disabled={nodes.length === 0} title="Export JSON-LD">
              <FileJson className="h-4 w-4" />
            </button>
            <button className="btn" onClick={clearGraph} disabled={nodes.length === 0} title="Clear graph">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6 p-6">
        {/* Ingest + list */}
        <aside className="col-span-12 xl:col-span-3">
          <div className="glass-strong p-4">
            <div className="label-xs mb-3 flex items-center gap-2">
              <Upload className="h-3 w-3" /> Ingest
            </div>
            <div
              {...getRootProps()}
              className={cn(
                "cursor-pointer rounded-xl border-2 border-dashed border-white/10 p-6 text-center transition",
                isDragActive && "border-forge-violet-500/60 bg-forge-violet-500/5",
                nodes.length > 0 && "p-4"
              )}
            >
              <input {...getInputProps()} />
              <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-forge-plasma to-forge-ember">
                <Upload className="h-5 w-5 text-white" />
              </div>
              <div className="text-sm font-semibold">Drop any image</div>
              <div className="mt-1 text-[11px] text-forge-ash">
                Receipts, invoices, diagrams, photos — anything. We'll OCR it, detect objects, extract triples.
              </div>
            </div>
            <input
              value={ingestHint}
              onChange={(e) => setIngestHint(e.target.value)}
              placeholder="Optional: hint for the classifier"
              className="input mt-3"
            />

            {/* Uploading tray */}
            {uploading.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {uploading.map((u) => (
                  <div key={u.id} className="rounded-lg border border-white/5 bg-black/30 px-2 py-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-forge-bone">{u.name}</span>
                      <span className="font-mono text-forge-ash">{u.progress}%</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                      <motion.div
                        className="h-full bg-gradient-to-r from-forge-violet-500 to-forge-plasma"
                        initial={{ width: 0 }}
                        animate={{ width: `${u.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {graph.ingestError && (
              <div className="mt-3 flex items-center gap-1.5 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
                <AlertTriangle className="h-3.5 w-3.5" />
                {graph.ingestError}
              </div>
            )}
          </div>

          <div className="glass mt-4 p-3">
            <div className="label-xs mb-2 flex items-center justify-between">
              <span>Assets ({visible.length})</span>
              <Database className="h-3 w-3" />
            </div>
            <div className="max-h-[52vh] space-y-1.5 overflow-auto pr-1">
              {visible.length === 0 && (
                <div className="grid h-40 place-items-center text-center text-xs text-forge-ash">
                  No assets match.
                </div>
              )}
              {visible.map((node) => (
                <NodeRow
                  key={node["@id"]}
                  node={node}
                  active={graph.selectedNodeId === node["@id"]}
                  onSelect={() => setSelected(node["@id"])}
                  onRemove={() => removeNode(node["@id"])}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Graph canvas */}
        <section className="col-span-12 xl:col-span-6">
          <div className="glass-strong p-3">
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-forge-violet-300" />
                <div className="label-xs">Relationship Explorer</div>
              </div>
              <div className="flex items-center gap-3 font-mono text-[10px] text-forge-ash">
                <span>
                  {nodes.length} nodes · {nodes.reduce((a, n) => a + n.relatesTo.length, 0)} edges
                </span>
              </div>
            </div>
            <GraphCanvas
              nodes={visible}
              allNodes={graph.nodes}
              selectedId={graph.selectedNodeId}
              onSelect={setSelected}
            />
          </div>

          {selected && <TriplesPanel node={selected} />}
        </section>

        {/* Inspector */}
        <aside className="col-span-12 xl:col-span-3">
          <InspectorPanel node={selected} neighbours={neighbours} onJump={setSelected} />
        </aside>
      </div>
    </div>
  );
}

// ===========================================================================
// Node row
// ===========================================================================

function NodeRow({
  node,
  active,
  onSelect,
  onRemove,
}: {
  node: OntologyNode;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex cursor-pointer items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-2 transition hover:bg-white/[0.05]",
        active && "border-forge-violet-500/50 bg-forge-violet-500/10"
      )}
    >
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded border border-white/5 bg-black">
        {node.thumbnail ? (
          <img src={node.thumbnail} alt={node.name} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-9 w-9 p-2 text-forge-ash" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-semibold text-forge-bone">{node.name}</span>
          <span className="font-mono text-[9px] text-forge-ash">{node["@type"]}</span>
        </div>
        <div className="truncate text-[10px] text-forge-ash">
          {node.tags.slice(0, 4).join(" · ") || "—"}
        </div>
      </div>
      <button
        className="opacity-0 transition group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove"
      >
        <Trash2 className="h-3.5 w-3.5 text-forge-ash hover:text-red-400" />
      </button>
    </div>
  );
}

// ===========================================================================
// Graph canvas — deterministic force-directed layout
// ===========================================================================

function GraphCanvas({
  nodes,
  allNodes,
  selectedId,
  onSelect,
}: {
  nodes: OntologyNode[];
  allNodes: Record<string, OntologyNode>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [size, setSize] = useState({ w: 800, h: 520 });
  const ref = useRef<HTMLDivElement | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: Math.max(400, entry.contentRect.width), h: Math.max(360, entry.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lightweight Fruchterman-Reingold-ish layout
  useEffect(() => {
    if (nodes.length === 0) {
      setPositions({});
      return;
    }
    const W = size.w;
    const H = size.h;
    const k = Math.sqrt((W * H) / Math.max(1, nodes.length)) * 0.85;

    const pos: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      const prev = positions[n["@id"]];
      pos[n["@id"]] = prev ?? {
        x: W / 2 + (Math.random() - 0.5) * W * 0.8,
        y: H / 2 + (Math.random() - 0.5) * H * 0.8,
      };
    }

    const ids = nodes.map((n) => n["@id"]);
    const idSet = new Set(ids);

    for (let iter = 0; iter < 160; iter++) {
      const disp: Record<string, { x: number; y: number }> = {};
      for (const id of ids) disp[id] = { x: 0, y: 0 };

      // repulsion
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = pos[ids[i]];
          const b = pos[ids[j]];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = (k * k) / d;
          dx = (dx / d) * force;
          dy = (dy / d) * force;
          disp[ids[i]].x += dx;
          disp[ids[i]].y += dy;
          disp[ids[j]].x -= dx;
          disp[ids[j]].y -= dy;
        }
      }

      // attraction along edges
      for (const n of nodes) {
        for (const r of n.relatesTo) {
          if (!idSet.has(r)) continue;
          const a = pos[n["@id"]];
          const b = pos[r];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = (d * d) / k;
          dx = (dx / d) * force;
          dy = (dy / d) * force;
          disp[n["@id"]].x -= dx;
          disp[n["@id"]].y -= dy;
          disp[r].x += dx;
          disp[r].y += dy;
        }
      }

      const t = Math.max(1, (1 - iter / 160) * 18);
      for (const id of ids) {
        const p = pos[id];
        const d = disp[id];
        const m = Math.sqrt(d.x * d.x + d.y * d.y) || 0.01;
        p.x += (d.x / m) * Math.min(m, t);
        p.y += (d.y / m) * Math.min(m, t);
        p.x = Math.max(40, Math.min(W - 40, p.x));
        p.y = Math.max(40, Math.min(H - 40, p.y));
      }
    }

    setPositions(pos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.map((n) => n["@id"]).join(","), nodes.reduce((a, n) => a + n.relatesTo.length, 0), size.w, size.h]);

  const edges: Array<{ a: string; b: string }> = [];
  for (const n of nodes) {
    for (const r of n.relatesTo) {
      if (positions[r]) edges.push({ a: n["@id"], b: r });
    }
  }

  return (
    <div ref={ref} className="lab-grid relative h-[560px] overflow-hidden rounded-xl border border-white/5 bg-forge-void">
      {nodes.length === 0 ? (
        <div className="grid h-full place-items-center text-center text-sm text-forge-ash">
          <div>
            <Network className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Ingest your first asset to populate
            <br />
            the ontology graph.
          </div>
        </div>
      ) : (
        <>
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="edge-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(138,92,255,0.6)" />
                <stop offset="100%" stopColor="rgba(34,211,238,0.5)" />
              </linearGradient>
            </defs>
            {edges.map((e, i) => {
              const a = positions[e.a];
              const b = positions[e.b];
              if (!a || !b) return null;
              return (
                <line
                  key={`${e.a}-${e.b}-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="url(#edge-grad)"
                  strokeWidth={selectedId && (e.a === selectedId || e.b === selectedId) ? 2.2 : 1}
                  opacity={selectedId && (e.a === selectedId || e.b === selectedId) ? 0.9 : 0.35}
                />
              );
            })}
          </svg>
          {nodes.map((n) => {
            const p = positions[n["@id"]];
            if (!p) return null;
            const active = selectedId === n["@id"];
            return (
              <motion.button
                key={n["@id"]}
                onClick={() => onSelect(n["@id"])}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1, left: p.x - 26, top: p.y - 26 }}
                transition={{ type: "spring", stiffness: 220, damping: 24 }}
                className={cn(
                  "absolute grid h-[52px] w-[52px] place-items-center overflow-hidden rounded-full border-2 transition",
                  active
                    ? "border-forge-violet-400 shadow-glow-violet"
                    : "border-white/20 hover:border-forge-violet-400/60"
                )}
                style={{ position: "absolute" }}
                title={`${n.name} · ${n["@type"]}`}
              >
                {n.thumbnail ? (
                  <img src={n.thumbnail} alt={n.name} className="h-full w-full object-cover" />
                ) : (
                  <Layers className="h-6 w-6" />
                )}
                <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 font-mono text-[9px] text-forge-bone">
                  {n.name.slice(0, 18)}
                </span>
              </motion.button>
            );
          })}
        </>
      )}
    </div>
  );
}

// ===========================================================================
// Triples panel
// ===========================================================================

function TriplesPanel({ node }: { node: OntologyNode }) {
  return (
    <div className="glass-strong mt-6 p-4">
      <div className="label-xs mb-3 flex items-center gap-2">
        <Link2 className="h-3 w-3" /> RDF Triples · {node.name}
      </div>
      {node.triples.length === 0 ? (
        <div className="text-xs text-forge-ash">No triples extracted.</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-white/5">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.02] text-forge-ash">
              <tr>
                <th className="px-3 py-2 text-left font-mono">Subject</th>
                <th className="px-3 py-2 text-left font-mono">Predicate</th>
                <th className="px-3 py-2 text-left font-mono">Object</th>
                <th className="px-3 py-2 text-right font-mono">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {node.triples.map((t, i) => (
                <TripleRow key={i} t={t} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TripleRow({ t }: { t: Triple }) {
  return (
    <tr className="border-t border-white/5 font-mono hover:bg-white/[0.02]">
      <td className="px-3 py-1.5 text-forge-bone">{t.subject}</td>
      <td className="px-3 py-1.5 text-forge-violet-300">{t.predicate}</td>
      <td className="px-3 py-1.5 text-forge-cyan">{t.object}</td>
      <td className="px-3 py-1.5 text-right text-forge-ash">{Math.round(t.confidence * 100)}%</td>
    </tr>
  );
}

// ===========================================================================
// Inspector
// ===========================================================================

function InspectorPanel({
  node,
  neighbours,
  onJump,
}: {
  node: OntologyNode | null;
  neighbours: OntologyNode[];
  onJump: (id: string) => void;
}) {
  if (!node) {
    return (
      <div className="glass-strong grid h-80 place-items-center p-4 text-center text-xs text-forge-ash">
        <div>
          <Wand2 className="mx-auto mb-2 h-6 w-6 opacity-40" />
          Select a node to inspect its
          <br />
          JSON-LD structure.
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="glass-strong p-4">
        <div className="flex items-start gap-3">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/5 bg-black">
            {node.thumbnail && <img src={node.thumbnail} alt={node.name} className="h-full w-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="label-xs">{node["@type"]}</div>
            <h3 className="truncate font-display text-lg font-bold text-forge-bone">{node.name}</h3>
            <div className="mt-1 truncate font-mono text-[10px] text-forge-ash">{node["@id"]}</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {node.tags.map((t) => (
            <span key={t} className="chip text-[10px]">
              <Tag className="h-2.5 w-2.5" /> {t}
            </span>
          ))}
        </div>

        {node.ocrText && (
          <>
            <div className="label-xs mt-4 mb-1">OCR Excerpt</div>
            <pre className="max-h-36 overflow-auto rounded border border-white/5 bg-black/40 p-2 font-mono text-[10px] leading-relaxed text-forge-ash">
              {node.ocrText}
            </pre>
          </>
        )}

        {node.entities.length > 0 && (
          <>
            <div className="label-xs mt-4 mb-1.5">Entities</div>
            <div className="flex flex-wrap gap-1">
              {node.entities.map((e, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded border border-white/5 bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-forge-bone"
                  title={`${e.type} · ${(e.salience * 100).toFixed(0)}%`}
                >
                  <span className="font-mono text-forge-violet-300">{e.type}</span>
                  {e.text}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="glass p-3">
        <div className="label-xs mb-2 flex items-center gap-2">
          <Link2 className="h-3 w-3" /> Contextual Neighbours (depth 2)
        </div>
        {neighbours.length === 0 ? (
          <div className="text-xs text-forge-ash">No related assets yet.</div>
        ) : (
          <div className="space-y-1.5">
            {neighbours.map((n) => (
              <button
                key={n["@id"]}
                onClick={() => onJump(n["@id"])}
                className="flex w-full items-center gap-2 rounded border border-white/5 bg-white/[0.02] p-1.5 text-left transition hover:bg-white/[0.05]"
              >
                <div className="h-8 w-8 shrink-0 overflow-hidden rounded border border-white/5 bg-black">
                  {n.thumbnail && <img src={n.thumbnail} alt={n.name} className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-forge-bone">{n.name}</div>
                  <div className="truncate font-mono text-[10px] text-forge-ash">{n["@type"]}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Automatically wire the fresh node to any existing node that shares tags,
 * entities or objects — simulating Claude's cross-asset relationship inference.
 */
function autoLinkNode(
  fresh: OntologyNode,
  all: OntologyNode[],
  linkNodes: (a: string, b: string) => void
) {
  const hay = new Set([
    ...fresh.tags.map((t) => t.toLowerCase()),
    ...fresh.entities.map((e) => e.text.toLowerCase()),
    ...fresh.objects.map((o) => o.label.toLowerCase()),
  ]);
  for (const other of all) {
    if (other["@id"] === fresh["@id"]) continue;
    const otherBag = new Set([
      ...other.tags.map((t) => t.toLowerCase()),
      ...other.entities.map((e) => e.text.toLowerCase()),
      ...other.objects.map((o) => o.label.toLowerCase()),
    ]);
    let overlap = 0;
    for (const t of hay) if (otherBag.has(t)) overlap++;
    if (overlap >= 2) {
      linkNodes(fresh["@id"], other["@id"]);
      linkNodes(other["@id"], fresh["@id"]);
    }
  }
}
