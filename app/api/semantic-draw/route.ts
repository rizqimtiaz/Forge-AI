/**
 * Forge-AI — ChromaSketch semantic-draw route
 * -----------------------------------------------------------------------------
 * POST /api/semantic-draw
 *
 * Accepts an array of vector strokes (plus size/hint/style), feeds them into
 * a ControlNet-conditioned Stable Diffusion model, and asks Claude Opus 4.7
 * to author a single-sentence "interpretation" of what the AI is seeing in
 * latent space. The response is a `SemanticInterpretation` validated by Zod.
 *
 * Graceful fallback: if no credentials are configured we synthesise a
 * deterministic interpretation + dream image so every UI path still renders.
 * -----------------------------------------------------------------------------
 */

import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import {
  SemanticDrawRequest,
  SemanticInterpretation,
  type VectorStroke,
} from "@/lib/ai-schemas";
import { uuid, seededRng, hash32, hslToHex } from "@/lib/utils";
import { dreamSvg } from "@/lib/svg-placeholders";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Stroke → ControlNet hint image
// ---------------------------------------------------------------------------

function strokesToSvg(strokes: VectorStroke[], width: number, height: number, bg = "#000000") {
  const paths = strokes
    .map((s) => {
      if (s.points.length < 2) return "";
      const d = s.points
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ");
      const stroke = s.tool === "eraser" ? bg : s.color;
      return `<path d="${d}" stroke="${stroke}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity="${
        s.tool === "airbrush" ? 0.35 : 1
      }"/>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${bg}"/>
    ${paths}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Claude interpretation
// ---------------------------------------------------------------------------

const InterpretationSchema = z.object({
  inferredSubject: z.string().min(1),
  interpretation: z.string().min(1),
  confidence: z.number().min(0).max(1),
  latentTokens: z.array(z.string()).min(3).max(12),
  colorPalette: z
    .array(z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/u))
    .min(3)
    .max(6),
  diffusionPrompt: z.string().min(6).max(220),
});

function strokeDigest(strokes: VectorStroke[], width: number, height: number): string {
  const parts = strokes.slice(0, 24).map((s) => {
    const cx = s.points.reduce((a, p) => a + p.x, 0) / s.points.length / width;
    const cy = s.points.reduce((a, p) => a + p.y, 0) / s.points.length / height;
    return `${s.tool[0]}(${cx.toFixed(2)},${cy.toFixed(2)},${s.points.length}p,${s.color})`;
  });
  return parts.join(" ");
}

async function interpretStrokes(
  strokes: VectorStroke[],
  width: number,
  height: number,
  hint: string | undefined,
  style: string
): Promise<z.infer<typeof InterpretationSchema>> {
  const rng = seededRng(hash32(strokeDigest(strokes, width, height) + (hint ?? "") + style));

  if (!process.env.ANTHROPIC_API_KEY) {
    const subjects = ["mountain landscape", "cyber cat", "abstract portrait", "floating city", "forest spirit", "glass flower"];
    const subject = subjects[Math.floor(rng() * subjects.length)];
    const hueBase = Math.floor(rng() * 360);
    const palette = Array.from({ length: 5 }, (_, i) =>
      hslToHex((hueBase + i * 37) % 360, 60 + rng() * 25, 45 + rng() * 25)
    );
    return {
      inferredSubject: subject,
      interpretation: `The strokes resemble ${subject} rendered in a ${style} aesthetic.`,
      confidence: 0.62 + rng() * 0.3,
      latentTokens: [subject, style, "volumetric light", "cinematic", "8k", "detailed"],
      colorPalette: palette,
      diffusionPrompt: `A ${subject}, ${style} style, dramatic lighting, extremely detailed, cinematic composition`,
    };
  }

  const model = anthropic(process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7-20250514");
  const digest = strokeDigest(strokes, width, height);
  const { object } = await generateObject({
    model,
    schema: InterpretationSchema,
    system:
      "You are a latent-space oracle. You interpret rough vector sketches and infer what the user is trying to draw. Your outputs drive a ControlNet-conditioned Stable Diffusion pipeline.",
    prompt: `Canvas: ${width}x${height}
Style: ${style}
Hint: ${hint ?? "(none)"}
Stroke digest (tool, normalised centroid, point count, color):
${digest}

Return your best guess of the subject, a poetic interpretation, a 5-color palette, latent tokens for the diffusion prompt, and a full diffusion prompt.`,
  });
  return object;
}

// ---------------------------------------------------------------------------
// ControlNet-conditioned diffusion (Replicate SDXL + canny/scribble)
// ---------------------------------------------------------------------------

async function runControlnet(
  hintSvg: string,
  prompt: string,
  seed: number | undefined
): Promise<string> {
  if (!process.env.REPLICATE_API_TOKEN) {
    return dreamSvg(prompt.slice(0, 32), ["#6D28FF", "#B537F2", "#22D3EE", "#A78BFA"]);
  }
  try {
    const b64 = Buffer.from(hintSvg).toString("base64");
    const hintDataUrl = `data:image/svg+xml;base64,${b64}`;
    const res = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        Prefer: "wait=55",
      },
      body: JSON.stringify({
        // lucataco/sdxl-controlnet-lora · scribble
        version: "db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
        input: {
          prompt,
          image: hintDataUrl,
          controlnet: "scribble",
          num_inference_steps: 30,
          guidance_scale: 7.5,
          seed: seed ?? Math.floor(Math.random() * 1e9),
        },
      }),
    });
    if (!res.ok) throw new Error(`Replicate ControlNet failed: ${res.status}`);
    const json: { output?: string | string[] } = await res.json();
    const url = Array.isArray(json.output) ? json.output[0] : json.output;
    return url ?? dreamSvg(prompt.slice(0, 32), ["#6D28FF", "#B537F2", "#22D3EE"]);
  } catch {
    return dreamSvg(prompt.slice(0, 32), ["#6D28FF", "#B537F2", "#22D3EE"]);
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const started = Date.now();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = SemanticDrawRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { strokes, width, height, hint, style, seed } = parsed.data;

  try {
    const interpStart = Date.now();
    const interp = await interpretStrokes(strokes, width, height, hint, style);
    const controlnetMs = Date.now() - interpStart;

    const hintSvg = strokesToSvg(strokes, width, height);
    const diffStart = Date.now();
    const dreamUrl = await runControlnet(hintSvg, interp.diffusionPrompt, seed);
    const diffMs = Date.now() - diffStart;

    const alternates = [
      { prompt: `${interp.diffusionPrompt}, golden hour`, imageUrl: dreamSvg(`${interp.inferredSubject} · golden hour`, interp.colorPalette) },
      { prompt: `${interp.diffusionPrompt}, neon noir`, imageUrl: dreamSvg(`${interp.inferredSubject} · neon noir`, interp.colorPalette) },
    ];

    const payload = {
      jobId: uuid(),
      createdAt: new Date().toISOString(),
      inferredSubject: interp.inferredSubject,
      interpretation: interp.interpretation,
      confidence: interp.confidence,
      latentTokens: interp.latentTokens,
      colorPalette: interp.colorPalette,
      controlnetModel: process.env.REPLICATE_API_TOKEN ? "sdxl-controlnet-scribble" : "forge-ai/procedural-svg",
      guidanceScale: 7.5,
      diffusionSteps: 30,
      dreamImageUrl: dreamUrl,
      alternates,
      diagnostics: {
        strokeCount: strokes.length,
        controlnetMs,
        diffusionMs: diffMs,
        totalMs: Date.now() - started,
      },
    };

    const safe = SemanticInterpretation.safeParse(payload);
    if (!safe.success) {
      return NextResponse.json(
        { ok: false, error: "Internal schema validation failed", issues: safe.error.flatten() },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, data: safe.data },
      { headers: { "x-forge-duration-ms": String(Date.now() - started) } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown interpretation error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      name: "semantic-draw",
      description: "ControlNet-conditioned semantic interpretation of vector strokes.",
      accepts: "POST application/json { strokes, width, height, hint?, style, seed? }",
    },
  });
}
