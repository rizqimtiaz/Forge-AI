"use client";

/**
 * Forge-AI — VisualEngine
 * -----------------------------------------------------------------------------
 * A high-performance canvas surface that powers two lab UIs:
 *
 *   mode="draw"  → ChromaSketch vector drawing board
 *                   • Pointer-driven stroke capture with pressure
 *                   • Smoothed bezier rendering
 *                   • Per-stroke tool / color / width
 *                   • Undo/redo handled externally via the store
 *
 *   mode="mask"  → Asset-AI masking surface
 *                   • Renders the source image with a dim veil
 *                   • A radial brush with adjustable radius paints over the
 *                     product to create / refine a mask
 *                   • Emits a `onMaskChange(dataUrl)` callback so the caller
 *                     can composite the final output
 *
 * Both modes share the same render loop and offscreen buffers, so the engine
 * remains smooth even on dense devices.
 * -----------------------------------------------------------------------------
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { cn, uuid } from "@/lib/utils";
import type { VectorStroke } from "@/lib/ai-schemas";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VisualEngineHandle {
  /** Export the current canvas as a PNG data URL. */
  exportPng: () => string;
  /** Export only the mask layer (mode=mask) as a PNG data URL. */
  exportMask: () => string;
  /** Export an SVG representation of all strokes (mode=draw). */
  exportSvg: () => string;
  /** Clear the drawing layer. */
  clear: () => void;
  /** Return the intrinsic canvas size. */
  size: () => { width: number; height: number };
}

type DrawMode = "draw";
type MaskMode = "mask";

interface DrawProps {
  mode: DrawMode;
  strokes: VectorStroke[];
  color: string;
  width: number;
  tool: VectorStroke["tool"];
  onStrokeEnd: (stroke: VectorStroke) => void;
  width_px?: number;
  height_px?: number;
  background?: string;
  className?: string;
  showGrid?: boolean;
}

interface MaskProps {
  mode: MaskMode;
  image: string;
  brushRadius: number;
  erasing?: boolean;
  onMaskChange?: (dataUrl: string) => void;
  width_px?: number;
  height_px?: number;
  className?: string;
  showGrid?: boolean;
}

export type VisualEngineProps = DrawProps | MaskProps;

// ---------------------------------------------------------------------------
// Smoothing helpers (centripetal Catmull-Rom → Bezier)
// ---------------------------------------------------------------------------

function drawSmoothed(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  width: number,
  color: string,
  tool: VectorStroke["tool"]
) {
  if (points.length === 0) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.globalAlpha = tool === "airbrush" ? 0.35 : 1;
  if (tool === "eraser") ctx.globalCompositeOperation = "destination-out";
  else ctx.globalCompositeOperation = "source-over";

  ctx.beginPath();
  if (points.length < 3) {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    ctx.restore();
    return;
  }

  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const mid1 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const mid2 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    ctx.quadraticCurveTo(p1.x, p1.y, mid2.x, mid2.y);
    if (i === 1) ctx.moveTo(mid1.x, mid1.y);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();

  if (tool === "airbrush") {
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = width * 2.2;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VisualEngine = forwardRef<VisualEngineHandle, VisualEngineProps>(function VisualEngine(
  props,
  ref
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [dims, setDims] = useState<{ w: number; h: number }>({
    w: props.width_px ?? 1024,
    h: props.height_px ?? 1024,
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const activePointsRef = useRef<{ x: number; y: number }[]>([]);
  const activePressureRef = useRef<number[]>([]);

  // --- Resize observer → responsive canvas ------------------------------------
  useEffect(() => {
    if (props.width_px && props.height_px) return;
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.contentRect;
        setDims({ w: Math.max(320, rect.width), h: Math.max(320, rect.height) });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [props.width_px, props.height_px]);

  // --- Redraw the strokes layer whenever stroke list changes ----------------
  useEffect(() => {
    if (props.mode !== "draw") return;
    const cvs = drawCanvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    for (const s of props.strokes) {
      drawSmoothed(ctx, s.points, s.width, s.color, s.tool);
    }
  }, [props]);

  // --- Load image & init mask layer when mode=mask --------------------------
  useEffect(() => {
    if (props.mode !== "mask") return;
    const cvs = imageCanvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      cvs.width = img.naturalWidth;
      cvs.height = img.naturalHeight;
      setDims({ w: img.naturalWidth, h: img.naturalHeight });
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.drawImage(img, 0, 0);
      const mask = maskCanvasRef.current;
      if (mask) {
        mask.width = img.naturalWidth;
        mask.height = img.naturalHeight;
        const mctx = mask.getContext("2d");
        mctx?.clearRect(0, 0, mask.width, mask.height);
      }
    };
    img.src = props.image;
  }, [props]);

  // --- Pointer helpers ------------------------------------------------------
  const toLocal = useCallback((e: React.PointerEvent) => {
    const surface = props.mode === "draw" ? drawCanvasRef.current : maskCanvasRef.current;
    if (!surface) return { x: 0, y: 0 };
    const rect = surface.getBoundingClientRect();
    const scaleX = surface.width / rect.width;
    const scaleY = surface.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, [props.mode]);

  const onPointerDown = (e: React.PointerEvent) => {
    const surface = props.mode === "draw" ? drawCanvasRef.current : maskCanvasRef.current;
    if (!surface) return;
    surface.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    const p = toLocal(e);
    activePointsRef.current = [p];
    activePressureRef.current = [e.pressure || 0.5];
    if (props.mode === "mask") paintMaskAt(p.x, p.y);
    else paintDrawLive();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const p = toLocal(e);
    activePointsRef.current.push(p);
    activePressureRef.current.push(e.pressure || 0.5);
    if (props.mode === "mask") paintMaskAt(p.x, p.y);
    else paintDrawLive();
  };

  const onPointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (props.mode === "draw") {
      if (activePointsRef.current.length >= 2) {
        const stroke: VectorStroke = {
          id: uuid(),
          points: activePointsRef.current.slice(),
          pressure: activePressureRef.current.slice(),
          color: props.color,
          width: props.width,
          tool: props.tool,
        };
        props.onStrokeEnd(stroke);
      }
    } else if (props.onMaskChange) {
      props.onMaskChange(exportMaskDataUrl());
    }
    activePointsRef.current = [];
    activePressureRef.current = [];
  };

  // --- Live draw render (in-progress stroke on top of committed strokes) ----
  const paintDrawLive = () => {
    if (props.mode !== "draw") return;
    const cvs = drawCanvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    for (const s of props.strokes) drawSmoothed(ctx, s.points, s.width, s.color, s.tool);
    drawSmoothed(ctx, activePointsRef.current, props.width, props.color, props.tool);
  };

  // --- Mask painting ---------------------------------------------------------
  const paintMaskAt = (x: number, y: number) => {
    if (props.mode !== "mask") return;
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = props.erasing ? "destination-out" : "source-over";
    const grad = ctx.createRadialGradient(x, y, 0, x, y, props.brushRadius);
    grad.addColorStop(0, "rgba(138,92,255,0.95)");
    grad.addColorStop(1, "rgba(138,92,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, props.brushRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const exportMaskDataUrl = (): string => {
    const mask = maskCanvasRef.current;
    if (!mask) return "";
    const out = document.createElement("canvas");
    out.width = mask.width;
    out.height = mask.height;
    const ctx = out.getContext("2d");
    if (!ctx) return "";
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, out.width, out.height);
    const pix = mask.getContext("2d")?.getImageData(0, 0, mask.width, mask.height);
    if (!pix) return "";
    const dst = ctx.createImageData(mask.width, mask.height);
    for (let i = 0; i < pix.data.length; i += 4) {
      const a = pix.data[i + 3];
      const v = a > 24 ? 255 : 0;
      dst.data[i] = v;
      dst.data[i + 1] = v;
      dst.data[i + 2] = v;
      dst.data[i + 3] = 255;
    }
    ctx.putImageData(dst, 0, 0);
    return out.toDataURL("image/png");
  };

  // --- Imperative handle ----------------------------------------------------
  useImperativeHandle(
    ref,
    (): VisualEngineHandle => ({
      exportPng: () => {
        if (props.mode === "draw") {
          const cvs = drawCanvasRef.current;
          return cvs?.toDataURL("image/png") ?? "";
        }
        const out = document.createElement("canvas");
        const img = imageCanvasRef.current;
        const mask = maskCanvasRef.current;
        if (!img || !mask) return "";
        out.width = img.width;
        out.height = img.height;
        const ctx = out.getContext("2d");
        if (!ctx) return "";
        ctx.drawImage(img, 0, 0);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(mask, 0, 0);
        return out.toDataURL("image/png");
      },
      exportMask: () => exportMaskDataUrl(),
      exportSvg: () => {
        if (props.mode !== "draw") return "";
        const paths = props.strokes
          .map((s) => {
            const d = s.points
              .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
              .join(" ");
            return `<path d="${d}" stroke="${s.color}" stroke-width="${s.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
          })
          .join("");
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dims.w} ${dims.h}">${paths}</svg>`;
      },
      clear: () => {
        if (props.mode === "draw") {
          const ctx = drawCanvasRef.current?.getContext("2d");
          if (ctx && drawCanvasRef.current) ctx.clearRect(0, 0, drawCanvasRef.current.width, drawCanvasRef.current.height);
        } else {
          const ctx = maskCanvasRef.current?.getContext("2d");
          if (ctx && maskCanvasRef.current) ctx.clearRect(0, 0, maskCanvasRef.current.width, maskCanvasRef.current.height);
          props.onMaskChange?.(exportMaskDataUrl());
        }
      },
      size: () => ({ width: dims.w, height: dims.h }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props, dims]
  );

  // --- Render ----------------------------------------------------------------
  const W = props.width_px ?? dims.w;
  const H = props.height_px ?? dims.h;

  return (
    <div
      ref={containerRef}
      className={cn("relative h-full w-full overflow-hidden rounded-xl border border-white/5 bg-forge-void", props.className)}
      style={{ touchAction: "none" }}
    >
      {props.showGrid !== false && (
        <div className="pointer-events-none absolute inset-0 bg-grid-violet bg-grid-40 opacity-30" aria-hidden />
      )}

      {props.mode === "mask" ? (
        <>
          <canvas
            ref={imageCanvasRef}
            className="absolute inset-0 h-full w-full object-contain"
            aria-label="Source image"
          />
          <canvas
            ref={maskCanvasRef}
            className="absolute inset-0 h-full w-full cursor-crosshair object-contain mix-blend-screen"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="Mask overlay"
          />
        </>
      ) : (
        <canvas
          ref={drawCanvasRef}
          width={W}
          height={H}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          style={{ background: (props as DrawProps).background ?? "transparent" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-label="Drawing surface"
        />
      )}

      {/* status readout */}
      <div className="pointer-events-none absolute bottom-2 right-2 rounded-md border border-white/10 bg-black/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-forge-ash backdrop-blur-md">
        {W}×{H} · {props.mode}
        {isDrawing && <span className="ml-2 text-forge-cyan">● live</span>}
      </div>
    </div>
  );
});

export default VisualEngine;
