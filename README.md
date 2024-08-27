# Forge-AI · Three Labs, One Intelligence

Forge-AI is a production-ready monorepo bundling three groundbreaking,
fully-functional AI laboratories into a single Next.js 14 (App Router)
application:

| Lab | Purpose | Core Tech |
| --- | --- | --- |
| **Asset-AI** | Parametric e-commerce — replace product backgrounds while preserving lighting | Segment-Anything-2, Stable Diffusion Inpainting, custom canvas compositor |
| **ChromaSketch** | Semantic drawing — the AI renders your intent in real time | ControlNet-conditioned SDXL, vector stroke pipeline |
`assetSlice`, `sketchSlice`, and `graphSlice`), validated by shared Zod
schemas in `lib/ai-schemas.ts`, and rendered in an "Scientific Dark Mode"
aesthetic via Tailwind CSS + Framer Motion.

---

## Stack

- **Framework** — Next.js 14 (App Router, TypeScript, React 18)
- **State** — Zustand with three slices and selective `persist` middleware
- **Styling** — Tailwind CSS, custom Forge theme, Framer Motion
- **AI** — Vercel AI SDK with Anthropic (Claude Opus 4.7) + OpenAI (GPT-4o / DALL-E 3)
- **Validation** — Zod end-to-end (request, response, and internal contracts)
- **UI affordances** — `lucide-react`, `react-dropzone`, `canvas-confetti`, `clsx`

---

## Getting started

```bash
# 1. install
npm install

# 2. (optional) wire up AI credentials
cp .env.example .env.local
# then edit .env.local

# 3. launch
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click into any lab.

> **Zero-config by design.** Every API route has a deterministic fallback that
> produces rich, visually-interesting output even when no API keys are set, so
> you can clone → `npm run dev` → demo instantly.

---

## Environment variables

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude Opus 4.7 — prompts, interpretations, triples |
| `OPENAI_API_KEY` | GPT-4o Vision — OCR + object detection for Doculens |
| `STABILITY_API_KEY` | Stable Diffusion Inpainting for Asset-AI |
| `REPLICATE_API_TOKEN` | SAM-2 + SDXL ControlNet for Asset-AI / ChromaSketch |

All variables are optional.

---

## File map

```
app/
  api/
    asset-pipeline/route.ts    # SAM-2 + Stable Diffusion Inpainting
    semantic-draw/route.ts     # ControlNet + latent interpretation
    graph-ingest/route.ts      # OCR + triple extraction
  (labs)/
    asset-ai/page.tsx          # Parametric e-commerce UI
    chromasketch/page.tsx      # Dual-canvas dream board
    doculens/page.tsx          # Ontology graph explorer
  layout.tsx
  page.tsx
  globals.css
components/
  navigation/Sidebar.tsx       # Animated lab switcher
  ui/VisualEngine.tsx          # Shared high-performance canvas
lib/
  ai-schemas.ts                # Zod schemas + inferred types
  utils.ts                     # uuid, seeded rng, color helpers
  svg-placeholders.ts          # procedural fallbacks
store/
  useForgeStore.ts             # Zustand store with three slices
```

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `1` / `2` / `3` | Jump to Asset-AI / ChromaSketch / Doculens |
| `\` | Collapse / expand the sidebar |
| `⌘Z` / `⌘⇧Z` | Undo / redo strokes in ChromaSketch |

---

## Scripts

| Command | |
| --- | --- |
| `npm run dev` | Start the dev server |
<!-- metadata: 7xhdqe2brj -->
<!-- metadata: 7xtzmu0jpk -->
<!-- metadata: dbgecor6m1 -->
<!-- metadata: 5zm2ipy9q2 -->
<!-- metadata: n2k83ox0h9 -->
<!-- metadata: ui4tv3et88 -->
<!-- metadata: ygw3roquj3 -->
<!-- metadata: wzohvewkm7 -->
<!-- metadata: fhj10lqyfr -->
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (Next.js core-web-vitals) |
| `npm run typecheck` | TypeScript `--noEmit` |

---

## License

MIT © Forge-AI Labs
