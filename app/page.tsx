"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Boxes, Brush, Network, Sparkles, Zap, Shield, GitBranch } from "lucide-react";

const LABS = [
  {
    href: "/asset-ai",
    Icon: Boxes,
    title: "Asset-AI",
    subtitle: "Parametric e-commerce",
    desc: "Segment-Anything-2 masks every pixel of a product, then Stable Diffusion Inpainting replaces the background while our canvas compositor preserves the original lighting and shadows.",
    accent: "from-forge-violet-500 to-forge-plasma",
    features: ["SAM-2 segmentation", "SD inpainting", "Canvas relighting"],
  },
  {
    href: "/chromasketch",
    Icon: Brush,
    title: "ChromaSketch",
    subtitle: "Semantic drawing",
    desc: "Every brush stroke is vectorised and streamed into a ControlNet-conditioned diffusion model. The Dream Canvas renders the model's interpretation in real-time beside your sketch.",
    accent: "from-forge-cyan to-forge-violet-400",
    features: ["Vectorised strokes", "ControlNet", "Dual-canvas view"],
  },
  {
    href: "/doculens",
    Icon: Network,
    title: "Doculens",
    subtitle: "Ontological mapping",
    desc: "OCR + object detection on any asset, then Claude authors RDF-style triples that land in a local JSON-LD graph. Traverse contextual relationships with a Neo4j-inspired explorer.",
    accent: "from-forge-plasma to-forge-ember",
    features: ["Vision + OCR", "JSON-LD triples", "Graph explorer"],
  },
];

const PILLARS = [
  { Icon: Zap, title: "Zero-config runnable", desc: "Every API route has a graceful fallback — clone, run, iterate." },
  { Icon: Shield, title: "Zod-validated end to end", desc: "Every request and response is statically typed & runtime checked." },
  { Icon: GitBranch, title: "Three labs, one store", desc: "A single Zustand store with isolated slices keeps state clean." },
];

export default function HomePage() {
  return (
    <div className="relative mx-auto max-w-7xl px-6 py-16 sm:py-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex items-center gap-2"
      >
        <span className="chip border-forge-violet-500/30 bg-forge-violet-500/10 text-forge-violet-200">
          <Sparkles className="h-3 w-3" /> v1.0 · Forge release
        </span>
        <span className="chip">Next.js 14 · App Router</span>
        <span className="chip">Claude Opus 4.7</span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.05 }}
        className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl"
      >
        Three groundbreaking
        <br />
        <span className="gradient-text">AI laboratories,</span>
        <br />
        fused into one forge.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="mt-6 max-w-2xl text-balance text-lg text-forge-ash"
      >
        Forge-AI combines a parametric e-commerce engine, a real-time semantic
        drawing board and an ontological asset manager — each powered by a
        different corner of modern generative AI, each pushing what's possible.
      </motion.p>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/asset-ai" className="btn-primary">
          Enter the forge <ArrowRight className="h-4 w-4" />
        </Link>
        <Link href="/doculens" className="btn">
          Explore graph <Network className="h-4 w-4" />
        </Link>
      </div>

      {/* Labs */}
      <div className="mt-20 grid gap-6 md:grid-cols-3">
        {LABS.map((lab, i) => {
          const Icon = lab.Icon;
          return (
            <motion.div
              key={lab.href}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.08 }}
            >
              <Link
                href={lab.href}
                className="group relative block h-full overflow-hidden rounded-2xl border border-white/5 bg-forge-charcoal/50 p-6 backdrop-blur-xl transition hover:border-forge-violet-500/30"
              >
                <div
                  className={`absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br ${lab.accent} opacity-0 blur-2xl transition group-hover:opacity-20`}
                />
                <div className={`mb-6 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${lab.accent} shadow-glow-violet`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="label-xs mb-1">{lab.subtitle}</div>
                <h3 className="font-display text-2xl font-bold text-forge-bone">{lab.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-forge-ash">{lab.desc}</p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {lab.features.map((f) => (
                    <span key={f} className="chip text-[10px]">{f}</span>
                  ))}
                </div>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-forge-violet-200 group-hover:text-forge-bone">
                  Open lab
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Pillars */}
      <div className="mt-16 grid gap-4 sm:grid-cols-3">
        {PILLARS.map(({ Icon, title, desc }) => (
          <div key={title} className="glass p-5">
            <Icon className="h-5 w-5 text-forge-violet-300" />
            <h4 className="mt-3 text-sm font-semibold text-forge-bone">{title}</h4>
            <p className="mt-1 text-xs text-forge-ash">{desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 flex items-center justify-between border-t border-white/5 pt-6 font-mono text-xs text-forge-ash">
        <span>© {new Date().getFullYear()} Forge-AI Labs</span>
        <span>Press 1/2/3 to switch labs · \\ to collapse sidebar</span>
      </div>
    </div>
  );
}
