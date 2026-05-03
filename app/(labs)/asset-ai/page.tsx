"use client";

/**
 * Forge-AI — Asset-AI Lab
 * -----------------------------------------------------------------------------
 * Parametric e-commerce pipeline UI.
 *
 *   1. User drops a product image onto the stage.
 *   2. Client calls /api/asset-pipeline → receives a `ForensicReport`.
 *   3. We composite the report locally:
 *        source image  +  mask (from SAM-2 or user brush)
 *        + generated background (from Stable Diffusion Inpainting)
 *        + relighting shadow + color-match + grain (forensic profile)
 *   4. Confetti + history chip on success.
 * -----------------------------------------------------------------------------
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Upload,
  Wand2,
  Download,
  RefreshCw,
  Layers,
  Palette,
  Eraser,
  Paintbrush,
  Sparkles,
  AlertTriangle,
  Gauge,
  Sun,
  Image as ImageIcon,
} from "lucide-react";

import { cn, prettyMs } from "@/lib/utils";
import { useAssetSlice, useForgeStore } from "@/store/useForgeStore";
import type { ForensicReport } from "@/lib/ai-schemas";
import VisualEngine, { type VisualEngineHandle } from "@/components/ui/VisualEngine";

const STYLES: Array<{ id: "studio" | "lifestyle" | "editorial" | "surreal" | "minimal"; label: string; hint: string }> = [
  { id: "studio", label: "Studio", hint: "Clean, product-first, softbox lighting" },
  { id: "lifestyle", label: "Lifestyle", hint: "In-context, warm tones, shallow DOF" },
  { id: "editorial", label: "Editorial", hint: "Dramatic, magazine-grade, moody" },
  { id: "surreal", label: "Surreal", hint: "Dreamlike, impossible physics, vivid" },
  { id: "minimal", label: "Minimal", hint: "Flat, geometric, negative space" },
];

export default function AssetAiPage() {
  const asset = useAssetSlice();
  const setSource = useForgeStore((s) => s.asset.setSource);
  const setPrompt = useForgeStore((s) => s.asset.setPrompt);
  const setNegativePrompt = useForgeStore((s) => s.asset.setNegativePrompt);
  const setStyle = useForgeStore((s) => s.asset.setStyle);
  const setStrength = useForgeStore((s) => s.asset.setStrength);
  const setStatus = useForgeStore((s) => s.asset.setStatus);
  const setReport = useForgeStore((s) => s.asset.setReport);
  const setComposite = useForgeStore((s) => s.asset.setComposite);
  const setError = useForgeStore((s) => s.asset.setError);
  const pushHistory = useForgeStore((s) => s.asset.pushHistory);
  const resetAsset = useForgeStore((s) => s.asset.resetAsset);

  const engineRef = useRef<VisualEngineHandle>(null);
  const [brushRadius, setBrushRadius] = useState(64);
  const [erasing, setErasing] = useState(false);
  const [userMask, setUserMask] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Drop handling
  // ---------------------------------------------------------------------------
  const onDrop = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;
      const dataUrl = await fileToDataUrl(file);
      const { width, height } = await imageSize(dataUrl);
      setSource(dataUrl, file.name, width, height);
      setUserMask(null);
    },
    [setSource]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    multiple: false,
    noClick: !!asset.sourceImage,
    noKeyboard: !!asset.sourceImage,
  });

  // ---------------------------------------------------------------------------
  // Submit pipeline
  // ---------------------------------------------------------------------------
  const runPipeline = async () => {
    if (!asset.sourceImage) return;
    setStatus("uploading", 5);
    setError(null);
    try {
      setStatus("segmenting", 25);
      const res = await fetch("/api/asset-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: asset.sourceImage,
          prompt: asset.prompt,
          negativePrompt: asset.negativePrompt,
          style: asset.style,
          strength: asset.strength,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Pipeline failed");
      const report = json.data as ForensicReport;
      setStatus("inpainting", 65);
      setReport(report);
      setStatus("compositing", 85);
      const composite = await compositeFinal(asset.sourceImage, userMask ?? report.masks[0].mask, report);
      setComposite(composite);
      setStatus("done", 100);
      pushHistory({
        id: report.jobId,
        thumbnail: composite,
        prompt: asset.prompt,
        at: new Date().toISOString(),
      });
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.3 },
        colors: ["#8A5CFF", "#B537F2", "#22D3EE", "#A3E635"],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      setError(msg);
    }
  };

  const downloadComposite = () => {
    if (!asset.composite) return;
    const a = document.createElement("a");
    a.href = asset.composite;
    a.download = `forge-asset-${Date.now()}.png`;
    a.click();
  };

  const isBusy = asset.status !== "idle" && asset.status !== "done" && asset.status !== "error";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="relative min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-forge-obsidian/60 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <div className="label-xs">Lab 01</div>
            <h1 className="font-display text-2xl font-bold">
              Asset<span className="gradient-text">-AI</span>
              <span className="ml-3 font-mono text-xs font-normal text-forge-ash">
                · Parametric E-Commerce Pipeline
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={asset.status} />
            <button
              onClick={resetAsset}
              className="btn"
              disabled={isBusy || !asset.sourceImage}
              title="Reset"
            >
              <RefreshCw className="h-4 w-4" /> Reset
            </button>
            <button
              onClick={runPipeline}
              disabled={!asset.sourceImage || isBusy}
              className="btn-primary"
            >
              <Wand2 className="h-4 w-4" />
              {isBusy ? "Forging…" : "Forge scene"}
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <ProgressBar progress={asset.progress} status={asset.status} />
      </header>

      <div className="grid grid-cols-12 gap-6 p-6">
        {/* Left column — parameters */}
        <aside className="col-span-12 xl:col-span-3">
          <div className="glass-strong p-4">
            <div className="label-xs mb-3">Scene Parameters</div>
            <label className="label-xs">Prompt</label>
            <textarea
              value={asset.prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="input mt-1 resize-none font-mono text-xs"
              placeholder="A minimalist marble pedestal in a sunlit studio…"
            />
            <label className="label-xs mt-4 block">Negative Prompt</label>
            <textarea
              value={asset.negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
              className="input mt-1 resize-none font-mono text-xs"
            />

            <div className="label-xs mt-4 mb-2">Aesthetic</div>
            <div className="grid grid-cols-2 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-xs transition",
                    asset.style === s.id
                      ? "border-forge-violet-500/60 bg-forge-violet-500/10 text-forge-bone"
                      : "border-white/5 bg-white/[0.02] text-forge-ash hover:bg-white/[0.04]"
                  )}
                  title={s.hint}
                >
                  <div className="font-semibold">{s.label}</div>
                  <div className="mt-0.5 text-[10px] opacity-70">{s.hint}</div>
                </button>
              ))}
            </div>

            <div className="label-xs mt-4 mb-1 flex items-center justify-between">
              <span>Strength</span>
              <span className="font-mono text-forge-bone">{asset.strength.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.2}
              max={0.98}
              step={0.01}
              value={asset.strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              className="w-full accent-forge-violet-500"
            />

            <div className="mt-5 border-t border-white/5 pt-4">
              <div className="label-xs mb-2">Brush Tools</div>
              <div className="flex items-center gap-2">
                <button
                  className={cn("btn", !erasing && "bg-forge-violet-500/15 border-forge-violet-500/40")}
                  onClick={() => setErasing(false)}
                  title="Paint mask"
                >
                  <Paintbrush className="h-4 w-4" />
                </button>
                <button
                  className={cn("btn", erasing && "bg-forge-violet-500/15 border-forge-violet-500/40")}
                  onClick={() => setErasing(true)}
                  title="Erase mask"
                >
                  <Eraser className="h-4 w-4" />
                </button>
                <div className="ml-2 flex-1">
                  <div className="label-xs mb-1 flex items-center justify-between">
                    <span>Radius</span>
                    <span className="font-mono">{brushRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={160}
                    value={brushRadius}
                    onChange={(e) => setBrushRadius(parseInt(e.target.value, 10))}
                    className="w-full accent-forge-violet-500"
                  />
                </div>
              </div>
              <button className="btn mt-2 w-full" onClick={() => engineRef.current?.clear()}>
                <RefreshCw className="h-4 w-4" /> Clear mask
              </button>
            </div>
          </div>

          {/* History */}
          {asset.history.length > 0 && (
            <div className="glass mt-4 p-3">
              <div className="label-xs mb-2">Session History</div>
              <div className="grid grid-cols-3 gap-2">
                {asset.history.slice(0, 9).map((h) => (
                  <button
                    key={h.id}
                    className="relative aspect-square overflow-hidden rounded-md border border-white/5 bg-black"
                    onClick={() => setComposite(h.thumbnail)}
                    title={h.prompt}
                  >
                    <img src={h.thumbnail} alt={h.prompt} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Center — canvas */}
        <section className="col-span-12 xl:col-span-6">
          <div className="glass-strong relative overflow-hidden p-3">
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-forge-violet-300" />
                <div className="label-xs">Source · Mask Overlay</div>
              </div>
              {asset.sourceFilename && (
                <div className="font-mono text-[10px] text-forge-ash">
                  {asset.sourceFilename}
                  {asset.sourceDimensions && ` · ${asset.sourceDimensions.width}×${asset.sourceDimensions.height}`}
                </div>
              )}
            </div>

            {!asset.sourceImage ? (
              <div
                {...getRootProps()}
                className={cn(
                  "lab-grid grid h-[560px] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-white/10 text-center transition",
                  isDragActive && "border-forge-violet-500/70 bg-forge-violet-500/5"
                )}
              >
                <input {...getInputProps()} />
                <div>
                  <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-forge-violet-500 to-forge-plasma shadow-glow-violet">
                    <Upload className="h-7 w-7 text-white" />
                  </div>
                  <div className="font-display text-xl font-semibold">
                    Drop a product photo
                  </div>
                  <div className="mx-auto mt-2 max-w-md text-sm text-forge-ash">
                    PNG, JPG, WebP — anything with a clean foreground subject. SAM-2 will do the rest.
                  </div>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px]">
                    <span className="chip">🏺 Vases</span>
                    <span className="chip">👟 Sneakers</span>
                    <span className="chip">🧴 Bottles</span>
                    <span className="chip">⌚ Watches</span>
                    <span className="chip">💼 Bags</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative h-[560px] w-full">
                <VisualEngine
                  ref={engineRef}
                  mode="mask"
                  image={asset.sourceImage}
                  brushRadius={brushRadius}
                  erasing={erasing}
                  onMaskChange={setUserMask}
                />
                {isBusy && <ScanlineOverlay status={asset.status} />}
              </div>
            )}
          </div>

          {/* Result */}
          {asset.composite && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-strong mt-6 p-3"
            >
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-forge-violet-300" />
                  <div className="label-xs">Final Composite</div>
                </div>
                <button className="btn-primary" onClick={downloadComposite}>
                  <Download className="h-4 w-4" /> Download PNG
                </button>
              </div>
              <div className="overflow-hidden rounded-xl border border-white/5 bg-forge-void">
                <img src={asset.composite} alt="composite" className="mx-auto block max-h-[560px] w-auto" />
              </div>
            </motion.div>
          )}

          {asset.error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              <AlertTriangle className="h-4 w-4" />
              {asset.error}
            </div>
          )}
        </section>

        {/* Right — forensic report */}
        <aside className="col-span-12 xl:col-span-3">
          <ForensicPanel report={asset.report} />
        </aside>
      </div>
    </div>
  );
}

// ===========================================================================
// Sub-components
// ===========================================================================

function StatusBadge({ status }: { status: ReturnType<typeof useAssetSlice>["status"] }) {
  const map: Record<string, { label: string; color: string }> = {
    idle: { label: "Ready", color: "bg-white/5 text-forge-ash" },
    uploading: { label: "Uploading", color: "bg-forge-cyan/10 text-forge-cyan" },
    segmenting: { label: "SAM-2", color: "bg-forge-violet-500/15 text-forge-violet-200" },
    inpainting: { label: "Inpainting", color: "bg-forge-plasma/15 text-forge-violet-100" },
    compositing: { label: "Compositing", color: "bg-forge-lime/10 text-forge-lime" },
    done: { label: "Done", color: "bg-forge-lime/15 text-forge-lime" },
    error: { label: "Error", color: "bg-red-500/15 text-red-300" },
  };
  const it = map[status] ?? map.idle;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider", it.color)}>
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      {it.label}
    </span>
  );
}

function ProgressBar({ progress, status }: { progress: number; status: string }) {
  if (status === "idle" || status === "done" || status === "error") {
    return <div className="h-[2px] w-full bg-transparent" />;
  }
  return (
    <div className="h-[2px] w-full overflow-hidden bg-white/5">
      <motion.div
        className="h-full bg-gradient-to-r from-forge-violet-500 via-forge-plasma to-forge-cyan"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}

function ScanlineOverlay({ status }: { status: string }) {
  return (
    <div className="scanline pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
      <div className="absolute inset-0 bg-forge-violet-500/5" />
      <div className="absolute bottom-3 left-3 rounded-full border border-forge-violet-500/30 bg-black/60 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-forge-violet-200">
        {status}…
      </div>
    </div>
  );
}

function ForensicPanel({ report }: { report: ForensicReport | null }) {
  return (
    <div className="glass-strong p-4">
      <div className="label-xs mb-3 flex items-center gap-2">
        <Gauge className="h-3 w-3" /> Forensic Report
      </div>

      {!report ? (
        <div className="grid h-80 place-items-center rounded-lg border border-dashed border-white/10 text-center text-xs text-forge-ash">
          <div>
            <ImageIcon className="mx-auto mb-2 h-6 w-6 opacity-40" />
            Forge a scene to populate
            <br />
            forensic diagnostics
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <Row label="Product">
            <span className="font-semibold">{report.productLabel}</span>
            <span className="ml-2 font-mono text-[10px] text-forge-ash">
              {(report.productConfidence * 100).toFixed(1)}%
            </span>
          </Row>
          <Row label="Source">
            <span className="font-mono">{report.sourceWidth} × {report.sourceHeight}</span>
          </Row>

          <div>
            <div className="label-xs mb-1.5">Lighting Profile</div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-forge-ash">
              <MiniStat label="Key" value={report.lighting.keyDirection} />
              <MiniStat label="Intensity" value={(report.lighting.intensity * 100).toFixed(0) + "%"} />
              <MiniStat label="Temp" value={report.lighting.temperature + "K"} />
              <MiniStat label="AO" value={(report.lighting.ambientOcclusion * 100).toFixed(0) + "%"} />
              <MiniStat label="Shadow" value={(report.lighting.shadowSoftness * 100).toFixed(0) + "%"} />
              <MiniStat label="Spec" value={(report.lighting.specularity * 100).toFixed(0) + "%"} />
            </div>
          </div>

          <div>
            <div className="label-xs mb-1.5">
              <Palette className="inline h-3 w-3" /> Palette
            </div>
            <div className="flex h-6 overflow-hidden rounded">
              {report.lighting.palette.map((c) => (
                <div key={c} className="flex-1" style={{ background: c }} title={c} />
              ))}
            </div>
          </div>

          <div>
            <div className="label-xs mb-1.5">
              <Sun className="inline h-3 w-3" /> Background Prompt
            </div>
            <p className="rounded border border-white/5 bg-black/40 p-2 font-mono text-[11px] leading-relaxed text-forge-ash">
              {report.backgroundPrompt}
            </p>
          </div>

          <div>
            <div className="label-xs mb-1.5">Masks ({report.masks.length})</div>
            <div className="grid grid-cols-3 gap-1.5">
              {report.masks.map((m) => (
                <div key={m.id} className="aspect-square overflow-hidden rounded border border-white/5 bg-black">
                  <img src={m.mask} alt={m.label} className="h-full w-full object-cover opacity-80" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-3 font-mono text-[10px] text-forge-ash">
            <span>SAM: {prettyMs(report.diagnostics.segmentationMs)}</span>
            <span>SD: {prettyMs(report.diagnostics.inpaintingMs)}</span>
            <span>Σ: {prettyMs(report.diagnostics.totalMs)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded border border-white/5 bg-black/30 px-2 py-1.5 text-xs">
      <span className="label-xs">{label}</span>
      <span className="text-forge-bone">{children}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/5 bg-black/30 px-2 py-1">
      <div className="label-xs">{label}</div>
      <div className="mt-0.5 truncate font-mono text-forge-bone">{value}</div>
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

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1024, height: 1024 });
    img.src = dataUrl;
  });
}

/**
 * Client-side canvas compositor.
 * Combines: source image × mask + generated background + shadow + color-match.
 */
async function compositeFinal(
  sourceDataUrl: string,
  maskDataUrl: string,
  report: ForensicReport
): Promise<string> {
  const [src, mask, bg] = await Promise.all([
    loadImage(sourceDataUrl),
    loadImage(maskDataUrl),
    loadImage(report.generatedBackgroundUrl),
  ]);
  const w = src.naturalWidth;
  const h = src.naturalHeight;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("canvas 2d unavailable");

  // 1. Background (cover-fit)
  const ratio = Math.max(w / bg.naturalWidth, h / bg.naturalHeight);
  const bw = bg.naturalWidth * ratio;
  const bh = bg.naturalHeight * ratio;
  ctx.drawImage(bg, (w - bw) / 2, (h - bh) / 2, bw, bh);

  // 2. Color match the background to the product palette
  ctx.save();
  ctx.globalAlpha = report.compositingInstructions.colorMatch * 0.35;
  ctx.fillStyle = report.lighting.dominantColor;
  ctx.globalCompositeOperation = "color";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 3. Drop shadow below the product
  const shadow = document.createElement("canvas");
  shadow.width = w;
  shadow.height = h;
  const sctx = shadow.getContext("2d")!;
  sctx.drawImage(mask, 0, 0, w, h);
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = "#000";
  sctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalAlpha = report.compositingInstructions.shadowOpacity;
  ctx.filter = `blur(${Math.round(8 + report.lighting.shadowSoftness * 28)}px)`;
  ctx.drawImage(
    shadow,
    report.compositingInstructions.shadowOffset.x,
    -report.compositingInstructions.shadowOffset.y + 10,
    w,
    h
  );
  ctx.restore();

  // 4. Composite the product — use mask as alpha
  const product = document.createElement("canvas");
  product.width = w;
  product.height = h;
  const pctx = product.getContext("2d")!;
  pctx.drawImage(src, 0, 0, w, h);
  pctx.globalCompositeOperation = "destination-in";
  pctx.filter = `blur(${report.compositingInstructions.featherPx * 0.25}px)`;
  pctx.drawImage(mask, 0, 0, w, h);

  ctx.drawImage(product, 0, 0);

  // 5. Film grain to unify source + generated pixels
  const amount = report.compositingInstructions.grainAmount;
  if (amount > 0.01) {
    const grain = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < grain.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 60 * amount;
      grain.data[i] = clamp255(grain.data[i] + n);
      grain.data[i + 1] = clamp255(grain.data[i + 1] + n);
      grain.data[i + 2] = clamp255(grain.data[i + 2] + n);
    }
    ctx.putImageData(grain, 0, 0);
  }

  // 6. Subtle vignette for product photography feel
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.min(w, h) * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  return out.toDataURL("image/png");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function clamp255(n: number) {
  return n < 0 ? 0 : n > 255 ? 255 : n;
}
