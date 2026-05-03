/**
 * Forge-AI — AI Schemas
 * -----------------------------------------------------------------------------
 * Single source of truth for every payload that crosses the AI boundary.
 * Each lab API route validates both its request AND response against these
 * Zod schemas, and the UI consumes the inferred TypeScript types.
 *
 * - ForensicReport          → Asset-AI (segmentation + inpainting forensics)
 * - SemanticInterpretation  → ChromaSketch (stroke → latent interpretation)
 * - OntologyNode            → Doculens (JSON-LD triple store node)
 * -----------------------------------------------------------------------------
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const HexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}){1,2}$/u, "Must be a valid hex color");

export const UnitInterval = z.number().min(0).max(1);

export const BoundingBox = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});
export type BoundingBox = z.infer<typeof BoundingBox>;

export const Vector2 = z.object({ x: z.number(), y: z.number() });
export type Vector2 = z.infer<typeof Vector2>;

// ============================================================================
// PROJECT 1 — Asset-AI
// ============================================================================

/**
 * A single SAM-2 segmentation mask with rich provenance data.
 * The client composites these masks on top of the source image to preserve
 * the product’s lighting and shadows during inpainting.
 */
export const SegmentationMask = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  confidence: UnitInterval,
  area: z.number().nonnegative(),
  bbox: BoundingBox,
  /** RLE-style run-length encoded mask (space-separated ints) or data URL. */
  mask: z.string().min(1),
  polygon: z.array(Vector2).optional(),
});
export type SegmentationMask = z.infer<typeof SegmentationMask>;

/**
 * A forensic lighting reading extracted by analysing the masked product.
 * Used by the canvas compositor to relight the inpainted background so the
 * final output looks physically consistent.
 */
export const LightingProfile = z.object({
  keyDirection: z.enum(["top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right"]),
  intensity: UnitInterval,
  temperature: z.number().min(1000).max(20000).describe("Color temperature in Kelvin"),
  ambientOcclusion: UnitInterval,
  shadowSoftness: UnitInterval,
  specularity: UnitInterval,
  dominantColor: HexColor,
  palette: z.array(HexColor).min(3).max(8),
});
export type LightingProfile = z.infer<typeof LightingProfile>;

/**
 * The "forensic" report returned by `/api/asset-pipeline`.
 * Contains every ingredient the front-end needs to finalise the inpainted
 * composite locally — masks, lighting, palette, recommended prompts and a
 * URL to the generated background.
 */
export const ForensicReport = z.object({
  jobId: z.string().uuid(),
  createdAt: z.string().datetime(),
  sourceWidth: z.number().int().positive(),
  sourceHeight: z.number().int().positive(),
  productLabel: z.string().min(1),
  productConfidence: UnitInterval,
  masks: z.array(SegmentationMask).min(1),
  lighting: LightingProfile,
  backgroundPrompt: z.string().min(1),
  negativePrompt: z.string().default(""),
  inpaintingModel: z.string().min(1),
  generatedBackgroundUrl: z.string().url().or(z.string().startsWith("data:")),
  compositingInstructions: z.object({
    featherPx: z.number().int().min(0).max(64),
    shadowOpacity: UnitInterval,
    shadowOffset: Vector2,
    colorMatch: UnitInterval,
    grainAmount: UnitInterval,
  }),
  diagnostics: z.object({
    segmentationMs: z.number().nonnegative(),
    inpaintingMs: z.number().nonnegative(),
    totalMs: z.number().nonnegative(),
  }),
});
export type ForensicReport = z.infer<typeof ForensicReport>;

export const AssetPipelineRequest = z.object({
  imageDataUrl: z.string().startsWith("data:"),
  prompt: z.string().min(2).max(500),
  negativePrompt: z.string().max(500).optional(),
  style: z.enum(["studio", "lifestyle", "editorial", "surreal", "minimal"]).default("studio"),
  strength: UnitInterval.default(0.85),
});
export type AssetPipelineRequest = z.infer<typeof AssetPipelineRequest>;

// ============================================================================
// PROJECT 2 — ChromaSketch
// ============================================================================

export const VectorStroke = z.object({
  id: z.string().uuid(),
  points: z.array(Vector2).min(2),
  color: HexColor,
  width: z.number().positive().max(128),
  pressure: z.array(UnitInterval).optional(),
  tool: z.enum(["pen", "brush", "marker", "airbrush", "eraser"]).default("pen"),
});
export type VectorStroke = z.infer<typeof VectorStroke>;

/**
 * The model’s interpretation of the user’s raw vector input.
 * Returned by `/api/semantic-draw` and rendered onto the "Dream Canvas".
 */
export const SemanticInterpretation = z.object({
  jobId: z.string().uuid(),
  createdAt: z.string().datetime(),
  inferredSubject: z.string().min(1),
  interpretation: z.string().min(1).describe("One-sentence narrative of what the AI 'sees'."),
  confidence: UnitInterval,
  latentTokens: z.array(z.string()).min(1),
  colorPalette: z.array(HexColor).min(3).max(6),
  controlnetModel: z.string().min(1),
  guidanceScale: z.number().min(0).max(30),
  diffusionSteps: z.number().int().min(1).max(150),
  dreamImageUrl: z.string().url().or(z.string().startsWith("data:")),
  alternates: z
    .array(
      z.object({
        prompt: z.string(),
        imageUrl: z.string().url().or(z.string().startsWith("data:")),
      })
    )
    .max(4)
    .default([]),
  diagnostics: z.object({
    strokeCount: z.number().int().nonnegative(),
    controlnetMs: z.number().nonnegative(),
    diffusionMs: z.number().nonnegative(),
    totalMs: z.number().nonnegative(),
  }),
});
export type SemanticInterpretation = z.infer<typeof SemanticInterpretation>;

export const SemanticDrawRequest = z.object({
  strokes: z.array(VectorStroke).min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  hint: z.string().max(200).optional(),
  style: z.enum(["photoreal", "oil", "watercolor", "cyberpunk", "ink", "isometric"]).default("photoreal"),
  seed: z.number().int().optional(),
});
export type SemanticDrawRequest = z.infer<typeof SemanticDrawRequest>;

// ============================================================================
// PROJECT 3 — Doculens
// ============================================================================

/**
 * A single RDF-style triple: subject — predicate — object.
 * Doculens stores these locally as JSON-LD fragments to simulate a
 * Neo4j-style graph without any external dependency.
 */
export const Triple = z.object({
  subject: z.string().min(1),
  predicate: z.string().min(1),
  object: z.string().min(1),
  confidence: UnitInterval.default(1),
});
export type Triple = z.infer<typeof Triple>;

export const DetectedObject = z.object({
  label: z.string().min(1),
  confidence: UnitInterval,
  bbox: BoundingBox,
});
export type DetectedObject = z.infer<typeof DetectedObject>;

/**
 * The JSON-LD formatted node that lives in Doculens's local graph.
 * Each node is self-describing via @context/@type and can reference
 * arbitrary other nodes via `relatesTo`.
 */
export const OntologyNode = z.object({
  "@context": z.string().url().default("https://schema.org"),
  "@id": z.string().min(1),
  "@type": z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  sourceAssetId: z.string().uuid(),
  thumbnail: z.string().url().or(z.string().startsWith("data:")).optional(),
  ocrText: z.string().default(""),
  language: z.string().default("en"),
  tags: z.array(z.string()).default([]),
  entities: z
    .array(
      z.object({
        text: z.string(),
        type: z.enum([
          "PERSON",
          "ORG",
          "LOC",
          "DATE",
          "MONEY",
          "PRODUCT",
          "EVENT",
          "CONCEPT",
          "OTHER",
        ]),
        salience: UnitInterval,
      })
    )
    .default([]),
  objects: z.array(DetectedObject).default([]),
  triples: z.array(Triple).default([]),
  relatesTo: z.array(z.string()).default([]),
  embedding: z.array(z.number()).length(32).optional(),
});
export type OntologyNode = z.infer<typeof OntologyNode>;

export const GraphIngestRequest = z.object({
  imageDataUrl: z.string().startsWith("data:"),
  filename: z.string().min(1),
  hint: z.string().max(300).optional(),
});
export type GraphIngestRequest = z.infer<typeof GraphIngestRequest>;

// ---------------------------------------------------------------------------
// Generic API envelope
// ---------------------------------------------------------------------------

export const ApiError = z.object({
  ok: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiError>;

export const ApiOk = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ ok: z.literal(true), data: schema });

// ---------------------------------------------------------------------------
// Schema registry (handy for a `/api/_schemas` introspection route or tests)
// ---------------------------------------------------------------------------

export const Schemas = {
  ForensicReport,
  SemanticInterpretation,
  OntologyNode,
  AssetPipelineRequest,
  SemanticDrawRequest,
  GraphIngestRequest,
  SegmentationMask,
  LightingProfile,
  VectorStroke,
  Triple,
  DetectedObject,
} as const;

export type Schemas = typeof Schemas;
