/**
 * Forge-AI — tiny utilities shared by client & server.
 */

import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** A tiny, fast, deterministic UUID v4 generator (RFC-4122 compliant). */
export function uuid(): string {
  const r = () => Math.floor(Math.random() * 256);
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = r();
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
  return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h
    .slice(6, 8)
    .join("")}-${h.slice(8, 10).join("")}-${h.slice(10, 16).join("")}`;
}

/** Mulberry32 — seeded RNG so mock pipelines are deterministic. */
export function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit integer (FNV-1a). */
export function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Clamp a number. */
export const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** Lerp. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Convert 0..1 to a 2-digit hex pair. */
export const h2 = (n: number) => clamp(Math.round(n * 255), 0, 255).toString(16).padStart(2, "0");

/** Build a hex color from HSL. */
export function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${h2(f(0))}${h2(f(8))}${h2(f(4))}`;
}

/** Prettify bytes. */
export function prettyBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/** Format ms as a human-friendly string. */
export function prettyMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

/** Parse a data URL into its `{mime, buffer}` components (server-safe). */
export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = /^data:([^;]+);base64,(.+)$/u.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

/** Build a tiny 1×1 transparent PNG data URL (useful as a placeholder). */
export const BLANK_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=";

/** A promise-based sleep. */
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
