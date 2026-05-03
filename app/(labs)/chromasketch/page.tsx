"use client";

/**
 * Forge-AI — ChromaSketch Lab
 * -----------------------------------------------------------------------------
 * Dual-canvas semantic drawing board.
 *   Left:  "Mortal Canvas" — the user draws with vector strokes.
 *   Right: "Dream Canvas"  — the ControlNet-conditioned latent rendering.
 *
 * Strokes are debounced → POSTed to /api/semantic-draw → the returned
 * SemanticInterpretation populates the right canvas, the subject ticker, and
 * the latent-token stream.
 * -----------------------------------------------------------------------------
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brush,
  Droplets,
  Eraser,
  Eye,
  Pencil,
  Redo2,
  Sparkles,
  Undo2,
  Wand2,
  RefreshCw,
  Download,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useForgeStore, useSketchSlice } from "@/store/useForgeStore";
import VisualEngine, { type VisualEngineHandle } from "@/components/ui/VisualEngine";
import type { SemanticInterpretation } from "@/lib/ai-schemas";

const COLORS = [
  "#A78BFA",
  "#B537F2",
  "#22D3EE",
  "#A3E635",
  "#F97316",
  "#F43F5E",
  "#FACC15",
  "#E8E8F0",
];

const TOOLS: Array<{ id: "pen" | "brush" | "marker" | "airbrush" | "eraser"; label: string; Icon: typeof Pencil; size: number }> = [
  { id: "pen", label: "Pen", Icon: Pencil, size: 3 },
  { id: "brush", label: "Brush", Icon: Brush, size: 10 },
  { id: "marker", label: "Marker", Icon: Droplets, size: 18 },
  { id: "airbrush", label: "Airbrush", Icon: Sparkles, size: 28 },
  { id: "eraser", label: "Eraser", Icon: Eraser, size: 16 },
];

const STYLES: Array<{ id: "photoreal" | "oil" | "watercolor" | "cyberpunk" | "ink" | "isometric"; label: string }> = [
  { id: "photoreal", label: "Photoreal" },
  { id: "oil", label: "Oil" },
  { id: "watercolor", label: "Watercolor" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "ink", label: "Ink" },
  { id: "isometric", label: "Isometric" },
];

export default function ChromaSketchPage() {
  const sketch = useSketchSlice();
  const addStroke = useForgeStore((s) => s.sketch.addStroke);
  const undo = useForgeStore((s) => s.sketch.undo);
  const redo = useForgeStore((s) => s.sketch.redo);
  const clearStrokes = useForgeStore((s) => s.sketch.clearStrokes);
  const setColor = useForgeStore((s) => s.sketch.setColor);
  const setBrushSize = useForgeStore((s) => s.sketch.setBrushSize);
  const setTool = useForgeStore((s) => s.sketch.setTool);
  const setStyle = useForgeStore((s) => s.sketch.setStyle);
  const setHint = useForgeStore((s) => s.sketch.setHint);
  const setStreaming = useForgeStore((s) => s.sketch.setStreaming);
  const setInterpretation = useForgeStore((s) => s.sketch.setInterpretation);
  const pushDream = useForgeStore((s) => s.sketch.pushDream);
  const setSketchError = useForgeStore((s) => s.sketch.setSketchError);

  const engineRef = useRef<VisualEngineHandle>(null);
  const [autoDream, setAutoDream] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<AbortController | null>(null);

  const canvasSize = { width: 960, height: 720 };

  // ---------------------------------------------------------------------------
  // Auto-dream: debounce strokes → POST to /api/semantic-draw
  // ---------------------------------------------------------------------------
  const triggerDream = useCallback(async () => {
    if (sketch.strokes.length === 0) return;
    if (inflightRef.current) inflightRef.current.abort();
    const ctrl = new AbortController();
    inflightRef.current = ctrl;

    setStreaming(true);
    setSketchError(null);
    try {
      const res = await fetch("/api/semantic-draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          strokes: sketch.strokes,
          width: canvasSize.width,
          height: canvasSize.height,
          hint: sketch.hint || undefined,
          style: sketch.style,
        }),
        signal: ctrl.signal,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Dream failed");
      const interp = json.data as SemanticInterpretation;
      setInterpretation(interp);
      pushDream({
        id: interp.jobId,
        imageUrl: interp.dreamImageUrl,
        subject: interp.inferredSubject,
        at: new Date().toISOString(),
      });
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Dream pipeline error";
      setSketchError(msg);
    } finally {
      setStreaming(false);
      if (inflightRef.current === ctrl) inflightRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sketch.strokes, sketch.hint, sketch.style]);

  useEffect(() => {
    if (!autoDream) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(triggerDream, 1200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [autoDream, triggerDream]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "Z" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const downloadDream = () => {
    if (!sketch.interpretation) return;
    const a = document.createElement("a");
    a.href = sketch.interpretation.dreamImageUrl;
    a.download = `chromasketch-${sketch.interpretation.inferredSubject.replace(/\s+/gu, "-")}.png`;
    a.target = "_blank";
    a.click();
  };

  return (
    <div className="relative min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-forge-obsidian/60 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <div className="label-xs">Lab 02</div>
            <h1 className="font-display text-2xl font-bold">
              Chroma<span className="gradient-text">Sketch</span>
              <span className="ml-3 font-mono text-xs font-normal text-forge-ash">· Semantic Drawing Board</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <AutoDreamToggle value={autoDream} onChange={setAutoDream} streaming={sketch.isStreaming} />
            <button
              onClick={triggerDream}
              disabled={sketch.strokes.length === 0 || sketch.isStreaming}
              className="btn-primary"
            >
              <Wand2 className="h-4 w-4" />
              {sketch.isStreaming ? "Dreaming…" : "Dream now"}
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6 p-6">
        {/* Left tool rail */}
        <aside className="col-span-12 lg:col-span-2">
          <div className="glass-strong p-3">
            <div className="label-xs mb-2">Tools</div>
            <div className="grid grid-cols-5 gap-1.5 lg:grid-cols-1">
              {TOOLS.map((t) => {
                const Icon = t.Icon;
                const active = sketch.tool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setTool(t.id);
                      setBrushSize(t.size);
                    }}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition",
                      active
                        ? "border-forge-violet-500/50 bg-forge-violet-500/10 text-forge-bone"
                        : "border-white/5 bg-white/[0.02] text-forge-ash hover:bg-white/[0.05]"
                    )}
                    title={t.label}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden lg:inline">{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <div className="label-xs mb-1.5 flex items-center justify-between">
                <span>Size</span>
                <span className="font-mono text-forge-bone">{sketch.brushSize}px</span>
              </div>
              <input
                type="range"
                min={1}
                max={64}
                value={sketch.brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                className="w-full accent-forge-violet-500"
              />
            </div>

            <div className="mt-4">
              <div className="label-xs mb-1.5">Palette</div>
              <div className="grid grid-cols-4 gap-1.5">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-6 rounded ring-1 ring-inset ring-white/10 transition",
                      sketch.color === c && "ring-2 ring-forge-bone"
                    )}
                    style={{ background: c }}
                    title={c}
                  />
                ))}
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-forge-ash">
                <input
                  type="color"
                  value={sketch.color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-6 w-10 cursor-pointer rounded border border-white/10 bg-transparent"
                />
                <span className="font-mono">{sketch.color.toUpperCase()}</span>
              </label>
            </div>

            <div className="mt-4 border-t border-white/5 pt-3">
              <div className="label-xs mb-1.5">History</div>
              <div className="flex items-center gap-1.5">
                <button onClick={undo} className="btn flex-1" title="⌘Z">
                  <Undo2 className="h-4 w-4" />
                </button>
                <button onClick={redo} className="btn flex-1" title="⌘⇧Z">
                  <Redo2 className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => {
                  clearStrokes();
                  engineRef.current?.clear();
                }}
                className="btn mt-1.5 w-full"
              >
                <RefreshCw className="h-4 w-4" /> Clear
              </button>
            </div>
          </div>

          {/* Dream history */}
          {sketch.dreamHistory.length > 0 && (
            <div className="glass mt-3 p-3">
              <div className="label-xs mb-2">Dream Stack</div>
              <div className="grid grid-cols-2 gap-1.5">
                {sketch.dreamHistory.slice(0, 8).map((d) => (
                  <button
                    key={d.id}
                    className="relative aspect-square overflow-hidden rounded border border-white/5"
                    title={d.subject}
                  >
                    <img src={d.imageUrl} alt={d.subject} className="h-full w-full object-cover" />
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 py-0.5 text-[9px] text-white">
                      {d.subject}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Dual canvas */}
        <section className="col-span-12 lg:col-span-10">
          <div className="grid gap-5 xl:grid-cols-2">
            {/* Mortal canvas */}
            <div className="glass-strong p-3">
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-forge-violet-300" />
                  <div className="label-xs">Mortal Canvas · your strokes</div>
                </div>
                <div className="font-mono text-[10px] text-forge-ash">{sketch.strokes.length} strokes</div>
              </div>
              <div className="h-[560px] w-full">
                <VisualEngine
                  ref={engineRef}
                  mode="draw"
                  strokes={sketch.strokes}
                  color={sketch.color}
                  width={sketch.brushSize}
                  tool={sketch.tool}
                  onStrokeEnd={addStroke}
                  width_px={canvasSize.width}
                  height_px={canvasSize.height}
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <label className="label-xs shrink-0">Hint</label>
                <input
                  value={sketch.hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="(optional — nudge the AI toward a subject)"
                  className="input text-xs"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider transition",
                      sketch.style === s.id
                        ? "border-forge-violet-500/60 bg-forge-violet-500/10 text-forge-bone"
                        : "border-white/5 bg-white/[0.02] text-forge-ash hover:bg-white/[0.04]"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dream canvas */}
            <div className="glass-strong relative p-3">
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-forge-cyan" />
                  <div className="label-xs">Dream Canvas · what the AI sees</div>
                </div>
                <button
                  className="btn"
                  onClick={downloadDream}
                  disabled={!sketch.interpretation}
                  title="Download dream"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
              <div className="relative h-[560px] overflow-hidden rounded-xl border border-white/5 bg-forge-void">
                <AnimatePresence mode="wait">
                  {sketch.interpretation ? (
                    <motion.img
                      key={sketch.interpretation.jobId}
                      src={sketch.interpretation.dreamImageUrl}
                      alt={sketch.interpretation.inferredSubject}
                      initial={{ opacity: 0, scale: 1.02 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid h-full place-items-center text-center text-sm text-forge-ash"
                    >
                      <div>
                        <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-50" />
                        Draw something — the Dream Canvas
                        <br />
                        will interpret it in real-time.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {sketch.isStreaming && <DreamScanline />}
              </div>

              {/* Interpretation readout */}
              {sketch.interpretation && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 space-y-2"
                >
                  <div className="rounded-lg border border-forge-violet-500/20 bg-forge-violet-500/5 px-3 py-2">
                    <div className="label-xs">Inferred Subject</div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-display text-lg font-semibold text-forge-bone">
                        {sketch.interpretation.inferredSubject}
                      </span>
                      <span className="font-mono text-xs text-forge-violet-200">
                        {(sketch.interpretation.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs italic text-forge-ash">"{sketch.interpretation.interpretation}"</p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {sketch.interpretation.latentTokens.map((t) => (
                      <span
                        key={t}
                        className="chip border-forge-cyan/20 bg-forge-cyan/5 text-[10px] text-forge-cyan"
                      >
                        <Zap className="h-2.5 w-2.5" /> {t}
                      </span>
                    ))}
                  </div>

                  <div className="flex h-5 overflow-hidden rounded">
                    {sketch.interpretation.colorPalette.map((c) => (
                      <div key={c} className="flex-1" style={{ background: c }} />
                    ))}
                  </div>

                  <div className="flex items-center justify-between font-mono text-[10px] text-forge-ash">
                    <span>{sketch.interpretation.controlnetModel}</span>
                    <span>
                      cfg {sketch.interpretation.guidanceScale.toFixed(1)} · {sketch.interpretation.diffusionSteps} steps
                    </span>
                  </div>
                </motion.div>
              )}

              {sketch.error && (
                <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {sketch.error}
                </div>
              )}
            </div>
          </div>

          {/* Alternates */}
          {sketch.interpretation && sketch.interpretation.alternates.length > 0 && (
            <div className="glass mt-5 p-4">
              <div className="label-xs mb-3">Alternate Interpretations</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {sketch.interpretation.alternates.map((a, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="overflow-hidden rounded-lg border border-white/5 bg-forge-void"
                  >
                    <img src={a.imageUrl} alt={a.prompt} className="h-40 w-full object-cover" />
                    <div className="p-2 font-mono text-[10px] text-forge-ash">{a.prompt}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function AutoDreamToggle({
  value,
  onChange,
  streaming,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  streaming: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition",
        value
          ? "border-forge-violet-500/50 bg-forge-violet-500/10 text-forge-bone"
          : "border-white/5 bg-white/[0.02] text-forge-ash"
      )}
      title="Continuously dream as you draw"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          value ? (streaming ? "animate-pulse bg-forge-cyan" : "bg-forge-violet-400") : "bg-forge-mist"
        )}
      />
      Auto-dream {value ? "ON" : "OFF"}
    </button>
  );
}

function DreamScanline() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute left-0 right-0 h-24 bg-gradient-to-b from-forge-cyan/0 via-forge-violet-500/40 to-forge-cyan/0 mix-blend-screen"
        initial={{ y: "-30%" }}
        animate={{ y: "130%" }}
        transition={{ repeat: Infinity, duration: 1.6, ease: "linear" }}
      />
      <div className="absolute bottom-2 left-2 rounded-full border border-forge-violet-500/30 bg-black/60 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-forge-violet-200">
        latent sync…
      </div>
    </div>
  );
}
