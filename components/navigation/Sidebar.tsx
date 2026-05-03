"use client";

/**
 * Forge-AI — Animated Lab Switcher Sidebar
 * -----------------------------------------------------------------------------
 * A glassmorphic, collapsible navigation rail with:
 *   • Lab-specific iconography
 *   • Active-state indicator that slides with Framer Motion layout animation
 *   • Synced selection with the unified Zustand store
 *   • Keyboard shortcuts (1/2/3)
 * -----------------------------------------------------------------------------
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Boxes,
  Brush,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Flame,
  Sparkles,
  Github,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useForgeStore, type LabId } from "@/store/useForgeStore";

interface LabDescriptor {
  id: LabId;
  href: string;
  label: string;
  tagline: string;
  Icon: typeof Boxes;
  accent: string;
  glow: string;
  shortcut: string;
}

const LABS: LabDescriptor[] = [
  {
    id: "asset-ai",
    href: "/asset-ai",
    label: "Asset-AI",
    tagline: "Parametric e-commerce",
    Icon: Boxes,
    accent: "from-forge-violet-500 to-forge-plasma",
    glow: "shadow-glow-violet",
    shortcut: "1",
  },
  {
    id: "chromasketch",
    href: "/chromasketch",
    label: "ChromaSketch",
    tagline: "Semantic drawing",
    Icon: Brush,
    accent: "from-forge-cyan to-forge-violet-400",
    glow: "shadow-glow-cyan",
    shortcut: "2",
  },
  {
    id: "doculens",
    href: "/doculens",
    label: "Doculens",
    tagline: "Ontological mapping",
    Icon: Network,
    accent: "from-forge-plasma to-forge-ember",
    glow: "shadow-glow-plasma",
    shortcut: "3",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const activeLab = useForgeStore((s) => s.activeLab);
  const setActiveLab = useForgeStore((s) => s.setActiveLab);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState<LabId | null>(null);

  const currentId = LABS.find((l) => pathname?.startsWith(l.href))?.id ?? activeLab;

  useEffect(() => {
    const found = LABS.find((l) => pathname?.startsWith(l.href));
    if (found && found.id !== activeLab) setActiveLab(found.id);
  }, [pathname, activeLab, setActiveLab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable) return;
      const match = LABS.find((l) => l.shortcut === e.key);
      if (match) {
        e.preventDefault();
        router.push(match.href);
      }
      if (e.key === "\\") setCollapsed((c) => !c);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 76 : 264 }}
      transition={{ type: "spring", stiffness: 280, damping: 32 }}
      className="sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-white/5 bg-forge-obsidian/70 backdrop-blur-2xl"
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-4">
        <motion.div
          whileHover={{ rotate: 18, scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-forge-violet-500 to-forge-plasma shadow-glow-violet"
        >
          <Flame className="h-5 w-5 text-white" />
          <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 animate-pulse rounded-full bg-forge-cyan ring-2 ring-forge-obsidian" />
        </motion.div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="flex min-w-0 flex-col"
            >
              <Link
                href="/"
                className="font-display text-lg font-bold leading-none tracking-tight text-forge-bone hover:text-white"
              >
                Forge<span className="gradient-text">-AI</span>
              </Link>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-forge-ash">
                three labs · one forge
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-3 mb-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Lab buttons */}
      <nav className="flex flex-1 flex-col gap-1.5 px-2">
        {LABS.map((lab) => {
          const active = currentId === lab.id;
          const Icon = lab.Icon;
          return (
            <Link
              key={lab.id}
              href={lab.href}
              onMouseEnter={() => setHovered(lab.id)}
              onMouseLeave={() => setHovered(null)}
              className={cn(
                "group relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 transition",
                active
                  ? "bg-white/5 text-white"
                  : "text-forge-ash hover:bg-white/[0.04] hover:text-forge-bone"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className={cn(
                    "absolute inset-0 rounded-xl bg-gradient-to-br opacity-[0.18]",
                    lab.accent
                  )}
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                />
              )}
              {active && (
                <motion.span
                  layoutId="sidebar-bar"
                  className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-gradient-to-b", lab.accent)}
                />
              )}

              <motion.span
                animate={hovered === lab.id ? { rotate: [0, -6, 6, 0] } : {}}
                transition={{ duration: 0.5 }}
                className={cn(
                  "relative grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/5 bg-gradient-to-br",
                  lab.accent,
                  active ? lab.glow : "opacity-85"
                )}
              >
                <Icon className="h-4 w-4 text-white" />
              </motion.span>

              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    className="relative flex min-w-0 flex-1 flex-col"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{lab.label}</span>
                      <kbd className="rounded border border-white/10 bg-black/40 px-1.5 py-0.5 text-[9px] text-forge-ash">
                        {lab.shortcut}
                      </kbd>
                    </div>
                    <span className="truncate text-[11px] text-forge-ash">{lab.tagline}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-2">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="glass mb-2 p-3"
            >
              <div className="flex items-center gap-2 text-xs text-forge-ash">
                <Sparkles className="h-3.5 w-3.5 text-forge-violet-300" />
                <span>Powered by Claude Opus 4.7 + Vercel AI SDK</span>
              </div>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center gap-2 text-xs text-forge-ash transition hover:text-forge-bone"
              >
                <Github className="h-3.5 w-3.5" />
                <span>View on GitHub</span>
              </a>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] py-2 text-xs text-forge-ash transition hover:bg-white/[0.06] hover:text-forge-bone"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title="Toggle sidebar (\\)"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}
