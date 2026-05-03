import type { Metadata, Viewport } from "next";
import "./globals.css";
import Sidebar from "@/components/navigation/Sidebar";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Forge-AI · Three Labs, One Intelligence",
  description:
    "Forge-AI is a trilogy of AI-first laboratories: Asset-AI (parametric e-commerce), ChromaSketch (semantic drawing) and Doculens (ontological asset mapping).",
  applicationName: "Forge-AI",
  keywords: [
    "AI",
    "segment-anything",
    "stable diffusion",
    "controlnet",
    "ontology",
    "graph",
    "next.js",
    "zustand",
    "vercel ai sdk",
  ],
  authors: [{ name: "Forge-AI Labs" }],
  openGraph: {
    title: "Forge-AI · Three Labs, One Intelligence",
    description:
      "Asset-AI, ChromaSketch, Doculens — the three experimental AI labs, unified.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05050A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={cn("min-h-screen bg-forge-void text-forge-bone antialiased")}>
        <div className="fixed inset-0 -z-10 bg-radial-forge" aria-hidden />
        <div
          className="fixed inset-0 -z-10 opacity-[0.12] bg-grid-violet bg-grid-40 mask-fade-b"
          aria-hidden
        />

        <div className="flex min-h-screen">
          <Sidebar />
          <main className="relative flex-1 overflow-x-hidden">{children}</main>
        </div>
      </body>
    </html>
  );
}
