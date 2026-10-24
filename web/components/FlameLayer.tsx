"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

/**
 * Lidah api yang berkedip di setiap titik api pada peta, digambar di satu kanvas.
 * Satu kanvas untuk ribuan titik jauh lebih ringan daripada ribuan elemen DOM beranimasi.
 * Kanvas tidak menerima klik; popup tetap datang dari CircleMarker transparan di bawahnya.
 */

export type FlameKind = "outside" | "inside" | "suspected" | "confirmed" | "rejected";
export type FlamePoint = { lat: number; lng: number; kind: FlameKind; frp: number; incidentId: number | null };
export type Flare = { incidentId: number; at: number } | null;

const KIND: Record<FlameKind, { size: number; outer: [string, string, string]; core: string; glow: string | null }> = {
  outside: { size: 13, outer: ["#DC2626", "#F97316", "#FBBF24"], core: "#FEF3C7", glow: null },
  inside: { size: 19, outer: ["#DC2626", "#EA580C", "#FBBF24"], core: "#FDE68A", glow: null },
  suspected: { size: 30, outer: ["#B91C1C", "#EA580C", "#FBBF24"], core: "#FFF7D6", glow: "rgba(249,115,22,0.55)" },
  confirmed: { size: 38, outer: ["#7F1D1D", "#DC2626", "#F97316"], core: "#FDE68A", glow: "rgba(220,38,38,0.6)" },
  rejected: { size: 10, outer: ["#57534E", "#78716C", "#A8A29E"], core: "#D6D3D1", glow: null },
};
const ORDER: FlameKind[] = ["rejected", "outside", "inside", "suspected", "confirmed"];

/** Lidah api berbentuk tetes terbalik: pangkal bulat, ujung runcing. */
function flamePath(g: CanvasRenderingContext2D, w: number, h: number, inset: number) {
  const cx = w / 2;
  const base = h - inset;
  const r = (w / 2 - inset) * 0.95;
  g.beginPath();
  g.moveTo(cx, inset);
  g.bezierCurveTo(cx + r * 0.35, h * 0.3, cx + r, h * 0.5, cx + r, base - r);
  g.arc(cx, base - r, r, 0, Math.PI, false);
  g.bezierCurveTo(cx - r, h * 0.5, cx - r * 0.35, h * 0.3, cx, inset);
  g.closePath();
}

function makeFlameSprite(kind: FlameKind): HTMLCanvasElement {
  const w = 48;
  const h = 72;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const spec = KIND[kind];
  const grad = g.createLinearGradient(0, h, 0, 0);
  grad.addColorStop(0, spec.outer[0]);
  grad.addColorStop(0.45, spec.outer[1]);
  grad.addColorStop(1, spec.outer[2]);
  g.shadowColor = spec.outer[1];
  g.shadowBlur = 6;
  g.fillStyle = grad;
  flamePath(g, w, h, 4);
  g.fill();
  g.shadowBlur = 0;
  // Inti api yang lebih terang di bagian bawah.
  g.globalAlpha = 0.9;
  g.fillStyle = spec.core;
  g.save();
  g.translate(w * 0.2, h * 0.38);
  g.scale(0.6, 0.6);
  flamePath(g, w, h, 4);
  g.fill();
  g.restore();
  return c;
}

function makeGlowSprite(color: string): HTMLCanvasElement {
  const s = 64;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  return c;
}

export default function FlameLayer({ points, flare }: { points: FlamePoint[]; flare: Flare }) {
  const map = useMap();
  const pointsRef = useRef<FlamePoint[]>([]);
  const flareRef = useRef<Flare>(null);

  useEffect(() => {
    // Gambar dari yang paling ringan ke yang paling penting, jadi insiden selalu di atas.
    pointsRef.current = [...points].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  }, [points]);

  useEffect(() => {
    flareRef.current = flare;
  }, [flare]);

  useEffect(() => {
    // Pane sendiri di z-index 450: di atas poligon izin (400), di bawah popup (700) dan kontrol peta.
    const pane = map.getPane("flames") ?? map.createPane("flames");
    pane.style.zIndex = "450";
    pane.style.pointerEvents = "none";
    const canvas = document.createElement("canvas");
    canvas.className = "flame-layer";
    pane.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;
    const sprites = Object.fromEntries(ORDER.map((k) => [k, makeFlameSprite(k)])) as Record<FlameKind, HTMLCanvasElement>;
    const glows = Object.fromEntries(
      ORDER.filter((k) => KIND[k].glow).map((k) => [k, makeGlowSprite(KIND[k].glow!)]),
    ) as Partial<Record<FlameKind, HTMLCanvasElement>>;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { x, y } = map.getSize();
      canvas.width = x * dpr;
      canvas.height = y * dpr;
      canvas.style.width = `${x}px`;
      canvas.style.height = `${y}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now: number) {
      const t = now / 1000;
      const { x: W, y: H } = map.getSize();
      // Pane ikut bergeser saat peta digeser; kanvas dikembalikan ke pojok kiri atas layar peta.
      L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
      ctx.clearRect(0, 0, W, H);
      // Api mengecil saat peta diperkecil supaya Indonesia tidak tertutup api.
      const zoomScale = Math.min(Math.max((map.getZoom() - 4) / 6, 0.45), 1.35);
      const fl = flareRef.current;
      for (let i = 0; i < pointsRef.current.length; i++) {
        const p = pointsRef.current[i];
        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        if (pt.x < -40 || pt.y < -60 || pt.x > W + 40 || pt.y > H + 20) continue;
        const spec = KIND[p.kind];
        const seed = (p.lat * 97.13 + p.lng * 13.71) % 6.283;
        const still = p.kind === "rejected" || reduced.matches;
        const flicker = still ? 1 : 1 + 0.16 * Math.sin(t * 9 + seed) + 0.07 * Math.sin(t * 23 + seed * 2);
        let size = spec.size * zoomScale * (0.85 + (Math.min(p.frp, 60) / 60) * 0.5);
        // Nyala besar sesaat di titik insiden yang baru dikonfirmasi.
        if (fl && p.incidentId === fl.incidentId) {
          const since = (now - fl.at) / 1000;
          if (since >= 0 && since < 2) size *= 1 + 2.2 * Math.sin((since / 2) * Math.PI);
        }
        const glow = glows[p.kind];
        if (glow) {
          const pulse = still ? 1 : 1 + 0.25 * Math.sin(t * 3 + seed);
          const gs = size * 2.4 * pulse;
          ctx.drawImage(glow, pt.x - gs / 2, pt.y - gs / 2, gs, gs);
        }
        const w = size * 0.66 * (still ? 1 : 1 - 0.05 * Math.sin(t * 9 + seed));
        const h = size * flicker;
        ctx.save();
        ctx.translate(pt.x, pt.y);
        if (!still) ctx.rotate(0.08 * Math.sin(t * 3.1 + seed));
        // Titik koordinat berada di tengah badan api, sama dengan area klik popup.
        ctx.drawImage(sprites[p.kind], -w / 2, -h * 0.62, w, h);
        ctx.restore();
      }
    }

    function loop(now: number) {
      draw(now);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      cancelAnimationFrame(raf);
      resize();
      if (reduced.matches) draw(0);
      else raf = requestAnimationFrame(loop);
    }

    // Mode tanpa animasi tetap menggambar ulang saat peta digeser atau diperbesar.
    const redrawStill = () => reduced.matches && draw(0);
    map.on("resize", start);
    map.on("move zoom", redrawStill);
    reduced.addEventListener("change", start);
    start();
    return () => {
      cancelAnimationFrame(raf);
      map.off("resize", start);
      map.off("move zoom", redrawStill);
      reduced.removeEventListener("change", start);
      canvas.remove();
    };
  }, [map]);

  return null;
}
