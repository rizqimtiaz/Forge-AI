/**
 * Forge-AI — procedural SVG placeholders.
 *
 * When no external AI key is configured we still want the labs to be visually
 * rich. Every generator here returns a `data:image/svg+xml;utf8,...` URL that
 * the front-end can drop directly into `<img src>` or a canvas.
 */

import { hslToHex, seededRng, hash32 } from "@/lib/utils";

const enc = (s: string) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;

/** A dreamy inpainted background (Asset-AI fallback). */
export function backgroundSvg(prompt: string, w = 1024, h = 1024): string {
  const rng = seededRng(hash32(prompt));
  const hueA = Math.floor(rng() * 360);
  const hueB = (hueA + 40 + Math.floor(rng() * 80)) % 360;
  const cA = hslToHex(hueA, 65, 55);
  const cB = hslToHex(hueB, 55, 35);
  const cC = hslToHex((hueA + 180) % 360, 50, 20);

  const blobs = Array.from({ length: 7 }, () => {
    const cx = Math.floor(rng() * w);
    const cy = Math.floor(rng() * h);
    const r = Math.floor(100 + rng() * 340);
    const hue = Math.floor(rng() * 360);
    const col = hslToHex(hue, 70, 60);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" opacity="${(0.18 + rng() * 0.22).toFixed(
      2
    )}" filter="url(#blur)"/>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${cA}"/>
      <stop offset="60%" stop-color="${cB}"/>
      <stop offset="100%" stop-color="${cC}"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="48"/></filter>
    <filter id="noise">
      <feTurbulence baseFrequency="0.9" numOctaves="2" seed="${hash32(prompt) % 99}"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  ${blobs}
  <rect width="100%" height="100%" filter="url(#noise)" opacity="0.45"/>
  <text x="50%" y="98%" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" fill="rgba(255,255,255,0.35)">forge-ai • ${prompt.slice(0, 56)}</text>
</svg>`;
  return enc(svg);
}

/** A dream canvas output (ChromaSketch fallback). */
export function dreamSvg(subject: string, palette: string[], w = 768, h = 768): string {
  const rng = seededRng(hash32(subject));
  const [c1, c2, c3, c4 = "#ffffff"] = palette;
  const rings = Array.from({ length: 6 }, (_, i) => {
    const r = 80 + i * 60 + rng() * 30;
    return `<circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="none" stroke="${
      [c1, c2, c3, c4][i % 4]
    }" stroke-width="${(1 + rng() * 3).toFixed(2)}" opacity="${(0.25 + rng() * 0.6).toFixed(2)}"/>`;
  }).join("");
  const sparks = Array.from({ length: 60 }, () => {
    const x = Math.floor(rng() * w);
    const y = Math.floor(rng() * h);
    const r = rng() * 2.5;
    return `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}" fill="${c4}" opacity="${(0.3 + rng() * 0.6).toFixed(
      2
    )}"/>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>
    <radialGradient id="r" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="60%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="1.2"/></filter>
  </defs>
  <rect width="100%" height="100%" fill="url(#r)"/>
  <g filter="url(#soft)">${rings}</g>
  ${sparks}
  <text x="50%" y="94%" text-anchor="middle" font-family="Inter, sans-serif" font-size="22" font-weight="600" fill="rgba(255,255,255,0.85)">${subject}</text>
</svg>`;
  return enc(svg);
}

/** An ontology thumbnail (Doculens fallback). */
export function ontologyThumb(label: string, w = 320, h = 220): string {
  const rng = seededRng(hash32(label));
  const hue = Math.floor(rng() * 360);
  const col = hslToHex(hue, 65, 55);
  const bg = hslToHex((hue + 200) % 360, 25, 10);
  const letters = label
    .split(/\s+/u)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) * 0.35}" fill="${col}" opacity="0.8"/>
  <text x="50%" y="54%" text-anchor="middle" font-family="Space Grotesk, Inter, sans-serif" font-size="52" font-weight="700" fill="#fff">${letters || "•"}</text>
  <text x="50%" y="86%" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="rgba(255,255,255,0.55)">${label.slice(0, 32)}</text>
</svg>`;
  return enc(svg);
}
