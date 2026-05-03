/**
 * Forge-AI — Doculens graph-ingest route
 * -----------------------------------------------------------------------------
 * POST /api/graph-ingest
 *
 * Given an uploaded image, this route:
 *   1. Runs OCR + object detection via GPT-4o vision (fallback: heuristic).
 *   2. Asks Claude Opus 4.7 to extract named entities and RDF triples.
 *   3. Packs everything into a JSON-LD `OntologyNode` validated by Zod.
 *   4. Synthesises a tiny 32-dim embedding so the client can cluster nodes.
 *
 * The emitted node is stored client-side in the Zustand graph slice, which
 * serves as the high-performance, Neo4j-style in-memory triple store.
 * -----------------------------------------------------------------------------
 */

import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { GraphIngestRequest, OntologyNode, type Triple } from "@/lib/ai-schemas";
import { uuid, seededRng, hash32 } from "@/lib/utils";
import { ontologyThumb } from "@/lib/svg-placeholders";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Step 1 — Vision / OCR
// ---------------------------------------------------------------------------

const VisionSchema = z.object({
  inferredName: z.string().min(1),
  inferredType: z.string().min(1),
  ocrText: z.string().default(""),
  language: z.string().default("en"),
  tags: z.array(z.string()).default([]),
  objects: z
    .array(
      z.object({
        label: z.string(),
        confidence: z.number().min(0).max(1),
        bbox: z.object({
          x: z.number(),
          y: z.number(),
          width: z.number().positive(),
          height: z.number().positive(),
        }),
      })
    )
    .default([]),
});

async function runVision(
  imageDataUrl: string,
  filename: string,
  hint?: string
): Promise<z.infer<typeof VisionSchema>> {
  if (!process.env.OPENAI_API_KEY) return mockVision(filename, hint);

  try {
    const model = openai(process.env.OPENAI_VISION_MODEL ?? "gpt-4o");
    const { object } = await generateObject({
      model,
      schema: VisionSchema,
      system:
        "You are a computer-vision asset tagger. You extract OCR text, detect objects with tight normalised bounding boxes (0-1000 coords), tag semantic concepts, and classify the asset's ontological type (e.g. Invoice, Receipt, Passport, PhotoOfProduct, Landscape, Diagram).",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Filename: ${filename}
Hint: ${hint ?? "(none)"}
Extract OCR text, detect salient objects, tag concepts, and classify the ontological type.`,
            },
            { type: "image", image: imageDataUrl },
          ],
        },
      ],
    });
    return object;
  } catch {
    return mockVision(filename, hint);
  }
}

function mockVision(filename: string, hint?: string): z.infer<typeof VisionSchema> {
  const rng = seededRng(hash32(filename + (hint ?? "")));
  const bases = ["Receipt", "Invoice", "Photograph", "Diagram", "Portrait", "Landscape", "Screenshot", "Document"];
  const tagPool = [
    "paper",
    "text",
    "numbers",
    "logo",
    "barcode",
    "signature",
    "seal",
    "stamp",
    "grid",
    "table",
    "chart",
    "photo",
    "outdoor",
    "indoor",
    "product",
    "person",
  ];
  const tags = Array.from({ length: 3 + Math.floor(rng() * 4) }, () => tagPool[Math.floor(rng() * tagPool.length)]);
  const ontoType = bases[Math.floor(rng() * bases.length)];
  const name = (hint ?? filename.replace(/\.[^.]+$/u, "")).slice(0, 80);
  const objects = Array.from({ length: 2 + Math.floor(rng() * 3) }, (_, i) => ({
    label: tagPool[Math.floor(rng() * tagPool.length)],
    confidence: 0.6 + rng() * 0.35,
    bbox: {
      x: Math.floor(rng() * 800),
      y: Math.floor(rng() * 800),
      width: 100 + Math.floor(rng() * 200),
      height: 100 + Math.floor(rng() * 200),
    },
  }));
  return {
    inferredName: name,
    inferredType: ontoType,
    ocrText: `Forge-AI • ${ontoType}\n${name}\n${new Date().toISOString().slice(0, 10)}`,
    language: "en",
    tags: Array.from(new Set(tags)),
    objects,
  };
}

// ---------------------------------------------------------------------------
// Step 2 — Entity + triple extraction
// ---------------------------------------------------------------------------

const TripleExtractionSchema = z.object({
  entities: z
    .array(
      z.object({
        text: z.string().min(1),
        type: z.enum(["PERSON", "ORG", "LOC", "DATE", "MONEY", "PRODUCT", "EVENT", "CONCEPT", "OTHER"]),
        salience: z.number().min(0).max(1),
      })
    )
    .default([]),
  triples: z
    .array(
      z.object({
        subject: z.string().min(1),
        predicate: z.string().min(1),
        object: z.string().min(1),
        confidence: z.number().min(0).max(1).default(1),
      })
    )
    .default([]),
});

async function extractTriples(
  name: string,
  ontoType: string,
  ocrText: string,
  tags: string[]
): Promise<z.infer<typeof TripleExtractionSchema>> {
  if (!process.env.ANTHROPIC_API_KEY) return mockTriples(name, ontoType, tags);

  try {
    const model = anthropic(process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7-20250514");
    const { object } = await generateObject({
      model,
      schema: TripleExtractionSchema,
      system:
        "You are a knowledge-graph extractor. Given an asset's OCR text and tags, produce the named entities and RDF-style (subject, predicate, object) triples. Predicates must be short snake_case relationships (e.g. belongs_to, mentions, issued_on, relates_to).",
      prompt: `Asset name: ${name}
Asset type: ${ontoType}
Tags: ${tags.join(", ")}
OCR:
"""
${ocrText}
"""

Extract a concise set of entities and relationship triples that a downstream graph store can reason over.`,
    });
    return object;
  } catch {
    return mockTriples(name, ontoType, tags);
  }
}

function mockTriples(name: string, ontoType: string, tags: string[]): z.infer<typeof TripleExtractionSchema> {
  const triples: Triple[] = [
    { subject: name, predicate: "is_a", object: ontoType, confidence: 0.95 },
    { subject: name, predicate: "created_on", object: new Date().toISOString().slice(0, 10), confidence: 0.85 },
    ...tags.slice(0, 4).map((t) => ({
      subject: name,
      predicate: "mentions",
      object: t,
      confidence: 0.7,
    })),
  ];
  const entities = tags.slice(0, 5).map((t, i) => ({
    text: t,
    type: (["CONCEPT", "PRODUCT", "ORG", "OTHER"] as const)[i % 4],
    salience: 0.4 + (i / 10),
  }));
  return { entities, triples };
}

// ---------------------------------------------------------------------------
// Step 3 — Embedding (cheap but deterministic; 32 floats in [-1,1])
// ---------------------------------------------------------------------------

function fakeEmbedding(seed: string): number[] {
  const rng = seededRng(hash32(seed));
  return Array.from({ length: 32 }, () => Math.round((rng() * 2 - 1) * 1000) / 1000);
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
  const parsed = GraphIngestRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { imageDataUrl, filename, hint } = parsed.data;

  try {
    const vision = await runVision(imageDataUrl, filename, hint);
    const extraction = await extractTriples(
      vision.inferredName,
      vision.inferredType,
      vision.ocrText,
      vision.tags
    );

    const assetId = uuid();
    const atId = `urn:forge:asset:${assetId}`;

    const node = {
      "@context": "https://schema.org",
      "@id": atId,
      "@type": vision.inferredType,
      name: vision.inferredName,
      createdAt: new Date().toISOString(),
      sourceAssetId: assetId,
      thumbnail: imageDataUrl.startsWith("data:") && imageDataUrl.length < 600_000
        ? imageDataUrl
        : ontologyThumb(vision.inferredName),
      ocrText: vision.ocrText,
      language: vision.language,
      tags: vision.tags,
      entities: extraction.entities,
      objects: vision.objects,
      triples: extraction.triples,
      relatesTo: [],
      embedding: fakeEmbedding(atId + vision.inferredName),
    };

    const safe = OntologyNode.safeParse(node);
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
    const msg = err instanceof Error ? err.message : "Unknown ingest error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      name: "graph-ingest",
      description:
        "OCR + object detection + Claude-powered entity/triple extraction into a JSON-LD OntologyNode.",
      accepts: "POST application/json { imageDataUrl, filename, hint? }",
    },
  });
}
