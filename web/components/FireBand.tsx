"use client";

import { useEffect, useRef } from "react";

/**
 * Pita api di tepi bawah layar (PRD bagian 11).
 * - Tinggi api mengikuti jumlah insiden Diduga: sekitar 4% layar tanpa insiden, maksimal 25%.
 * - Bekas gosong menebal untuk setiap kebakaran terkonfirmasi, tepinya bergerigi.
 * - `flareKey` berubah saat Konfirmasi berhasil: api menyala besar sesaat lalu turun.
 * - prefers-reduced-motion: satu bingkai statis tanpa gerak.
 * Kanvas tidak menerima klik dan berada di bawah kontrol peta serta panel kanan.
 */

type Props = { suspected: number; confirmed: number; flareKey: number };

// Token warna dari PRD. Ditulis langsung karena kanvas tidak membaca variabel CSS.
const C = {
  ember: "#FBBF24",
  bright: "#F97316",
  fire: "#EA580C",
  red: "#DC2626",
  char: "#1C1917",
  ash: "#57534E",
};

const STEP = 6;

type Spark = { x: number; y: number; vy: number; vx: number; life: number; r: number };

/** Gelombang halus tanpa pustaka noise: jumlah beberapa sinus dengan frekuensi tak sebanding. */
function wave(x: number, t: number, seed: number) {
  return (
    Math.sin(x * 0.013 + t * 1.7 + seed) * 0.5 +
    Math.sin(x * 0.031 - t * 2.3 + seed * 2.1) * 0.3 +
    Math.sin(x * 0.067 + t * 3.1 + seed * 0.7) * 0.2
  );
}

/** Tepi kertas terbakar: bergerigi tetapi tidak bergerak. */
function charEdge(x: number) {
  return Math.sin(x * 0.045) * 0.35 + Math.sin(x * 0.11 + 1.3) * 0.25 + Math.sin(x * 0.27 + 4.1) * 0.2;
}

export default function FireBand({ suspected, confirmed, flareKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ suspected, confirmed, flareAt: -Infinity, height: 0, char: 0 });
  const firstFlare = useRef(true);

  useEffect(() => {
    state.current.suspected = suspected;
    state.current.confirmed = confirmed;
  }, [suspected, confirmed]);

  useEffect(() => {
    if (firstFlare.current) {
      firstFlare.current = false;
      return;
    }
    state.current.flareAt = performance.now();
  }, [flareKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let raf = 0;
    const sparks: Spark[] = [];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      // Kanvas setinggi 40% layar supaya nyala sesaat saat Konfirmasi punya ruang.
      height = Math.round(window.innerHeight * 0.4);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function targets(now: number) {
      const s = state.current;
      const vh = window.innerHeight;
      const mobile = window.innerWidth < 860;
      const max = mobile ? 0.15 : 0.25;
      const base = 0.04 + Math.min(s.suspected, 6) / 6 * (max - 0.04);
      // Nyala sesaat: naik cepat, lalu turun dalam sekitar 1,6 detik.
      const since = (now - s.flareAt) / 1000;
      const flare = since >= 0 && since < 1.6 ? Math.sin(Math.min(since / 1.6, 1) * Math.PI) * (mobile ? 0.12 : 0.16) : 0;
      const charH = s.confirmed > 0 ? (0.012 + Math.min(s.confirmed, 8) * 0.009) * vh : 0;
      return { flameH: (base + flare) * vh, charH };
    }

    function drawFlames(t: number, base: number, flameH: number) {
      const layers = [
        { scale: 1, seed: 0, alpha: 0.9, stops: [C.red, C.fire, C.bright] },
        { scale: 0.72, seed: 3.3, alpha: 0.85, stops: [C.fire, C.bright, C.ember] },
        { scale: 0.42, seed: 6.1, alpha: 0.9, stops: [C.bright, C.ember, "#FEF3C7"] },
      ];
      for (const layer of layers) {
        const h = flameH * layer.scale;
        const grad = ctx!.createLinearGradient(0, base, 0, base - h * 1.4);
        grad.addColorStop(0, layer.stops[0]);
        grad.addColorStop(0.45, layer.stops[1]);
        grad.addColorStop(0.85, layer.stops[2]);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx!.globalAlpha = layer.alpha;
        ctx!.fillStyle = grad;
        ctx!.beginPath();
        ctx!.moveTo(0, height);
        for (let x = 0; x <= width + STEP; x += STEP) {
          const tongue = 0.55 + 0.45 * wave(x, t, layer.seed);
          // Pangkal lidah api diruncingkan supaya tidak terlihat seperti gelombang air.
          const flick = Math.pow(Math.abs(Math.sin(x * 0.021 + t * 0.9 + layer.seed)), 0.6);
          ctx!.lineTo(x, base - h * tongue * (0.6 + 0.4 * flick));
        }
        ctx!.lineTo(width, height);
        ctx!.closePath();
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function drawChar(charH: number) {
      if (charH <= 0) return;
      const top = height - charH;
      const grad = ctx!.createLinearGradient(0, height, 0, top - charH * 0.4);
      grad.addColorStop(0, C.char);
      grad.addColorStop(0.75, C.char);
      grad.addColorStop(1, C.ash);
      ctx!.fillStyle = grad;
      ctx!.beginPath();
      ctx!.moveTo(0, height);
      for (let x = 0; x <= width + STEP; x += STEP) ctx!.lineTo(x, top - charEdge(x) * charH * 0.45);
      ctx!.lineTo(width, height);
      ctx!.closePath();
      ctx!.fill();

      // Garis bara tipis di tepi kertas yang terbakar.
      ctx!.strokeStyle = C.bright;
      ctx!.globalAlpha = 0.7;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      for (let x = 0; x <= width + STEP; x += STEP) {
        const y = top - charEdge(x) * charH * 0.45;
        if (x === 0) ctx!.moveTo(x, y);
        else ctx!.lineTo(x, y);
      }
      ctx!.stroke();
      ctx!.globalAlpha = 1;
    }

    function drawSparks(dt: number, base: number, flameH: number) {
      const wanted = Math.round((flameH / window.innerHeight) * 160);
      while (sparks.length < wanted) {
        sparks.push({
          x: Math.random() * width,
          y: base - Math.random() * flameH * 0.5,
          vy: 20 + Math.random() * 45,
          vx: (Math.random() - 0.5) * 14,
          life: 1,
          r: 0.8 + Math.random() * 1.6,
        });
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.y -= p.vy * dt;
        p.x += p.vx * dt;
        p.life -= dt * 0.45;
        if (p.life <= 0 || p.y < 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx!.globalAlpha = p.life * 0.9;
        ctx!.fillStyle = p.life > 0.5 ? C.ember : C.bright;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    let last = performance.now();
    function frame(now: number) {
      const elapsed = (now - last) / 1000;
      const dt = Math.min(elapsed, 0.05);
      last = now;
      const s = state.current;
      const { flameH, charH } = targets(now);
      // Mendekati target dengan halus memakai waktu nyata, jadi tab yang baru aktif lagi langsung menyusul.
      s.height += (flameH - s.height) * (1 - Math.exp(-elapsed * 4));
      s.char += (charH - s.char) * (1 - Math.exp(-elapsed * 2));

      ctx!.clearRect(0, 0, width, height);
      const base = height - s.char * 0.6;
      drawFlames(now / 1000, base, s.height);
      drawSparks(dt, base, s.height);
      drawChar(s.char);
      raf = requestAnimationFrame(frame);
    }

    function still() {
      const s = state.current;
      const { flameH, charH } = targets(-Infinity);
      s.height = flameH;
      s.char = charH;
      ctx!.clearRect(0, 0, width, height);
      drawFlames(0, height - charH * 0.6, flameH);
      drawChar(charH);
    }

    function start() {
      cancelAnimationFrame(raf);
      resize();
      if (reduced.matches) still();
      else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    start();
    // Mode statis tidak punya loop, jadi gambar ulang saat angka berubah lewat interval ringan.
    const staticTimer = setInterval(() => reduced.matches && still(), 1000);
    window.addEventListener("resize", start);
    reduced.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(staticTimer);
      window.removeEventListener("resize", start);
      reduced.removeEventListener("change", start);
    };
  }, []);

  return <canvas ref={canvasRef} className="fire-band" aria-hidden />;
}
