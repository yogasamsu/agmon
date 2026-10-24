"use client";

import { useEffect, useRef } from "react";

/**
 * Footer api di tepi bawah layar (PRD bagian 11), selalu terlihat di semua halaman.
 * - Api disimulasikan sebagai kisi panas beresolusi rendah: baris dasar diberi panas, panas
 *   merambat ke atas sambil meluruh acak dan tertiup angin, lalu tiap sel diwarnai dari palet
 *   bara (merah tua, merah, oranye, kuning, putih). Hasilnya diperbesar dengan penghalusan,
 *   jadi lidah api menyatu dan berkedip seperti api sungguhan.
 * - Tinggi api mengikuti jumlah insiden Diduga. Tanpa insiden pun api tetap menyala kecil.
 * - Bekas gosong di dasar menebal untuk setiap kebakaran terkonfirmasi.
 * - `flareKey` berubah saat Konfirmasi berhasil: api menyala besar sesaat lalu turun.
 * - prefers-reduced-motion: satu bingkai statis tanpa gerak.
 * Kanvas tidak menerima klik (pointer-events: none), jadi semua tombol di bawahnya tetap bisa ditekan.
 */

type Props = { suspected: number; confirmed: number; flareKey: number };

/** Ruang yang disisakan halaman di bawah konten supaya api saat diam tidak menutupi apa pun. */
export const FIRE_RESERVE_PX = { desktop: 84, mobile: 64 };

/** Ukuran satu sel simulasi dalam piksel CSS. Makin besar, makin ringan dan makin lembut. */
const CELL = 3;
const CHAR = "#1C1917";

type Spark = { x: number; y: number; vx: number; vy: number; life: number };

/** Palet 256 warna RGBA dari dingin (transparan) ke panas (putih kekuningan). */
function buildPalette(): Uint8ClampedArray {
  const stops: [number, [number, number, number]][] = [
    [0.0, [127, 29, 29]],
    [0.2, [185, 28, 28]],
    [0.35, [220, 38, 38]],
    [0.5, [234, 88, 12]],
    [0.65, [249, 115, 22]],
    [0.8, [251, 191, 36]],
    [0.92, [253, 230, 138]],
    [1.0, [255, 247, 214]],
  ];
  const pal = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const h = i / 255;
    let j = 0;
    while (j < stops.length - 2 && h > stops[j + 1][0]) j++;
    const [h0, c0] = stops[j];
    const [h1, c1] = stops[j + 1];
    const k = Math.min(Math.max((h - h0) / (h1 - h0), 0), 1);
    pal[i * 4] = c0[0] + (c1[0] - c0[0]) * k;
    pal[i * 4 + 1] = c0[1] + (c1[1] - c0[1]) * k;
    pal[i * 4 + 2] = c0[2] + (c1[2] - c0[2]) * k;
    // Ujung api memudar halus ke transparan, badan api pekat.
    pal[i * 4 + 3] = 255 * Math.min(1, Math.pow(h / 0.25, 1.2));
  }
  return pal;
}

/** Tepi gosong bergerigi seperti kertas terbakar, tidak bergerak. */
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

    const palette = buildPalette();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const off = document.createElement("canvas");
    const offCtx = off.getContext("2d")!;
    const soft = document.createElement("canvas");
    const softCtx = soft.getContext("2d")!;
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let heat = new Float32Array(0);
    let image: ImageData | null = null;
    let raf = 0;
    const sparks: Spark[] = [];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      // Kanvas setinggi 45% layar supaya nyala sesaat saat Konfirmasi punya ruang.
      height = Math.round(window.innerHeight * 0.45);
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / CELL);
      rows = Math.ceil(height / CELL);
      off.width = soft.width = cols;
      off.height = soft.height = rows;
      softCtx.filter = "blur(0.7px)";
      heat = new Float32Array(cols * rows);
      image = offCtx.createImageData(cols, rows);
    }

    function targets(now: number) {
      const s = state.current;
      const vh = window.innerHeight;
      const mobile = window.innerWidth < 860;
      const reserve = mobile ? FIRE_RESERVE_PX.mobile : FIRE_RESERVE_PX.desktop;
      const max = (mobile ? 0.2 : 0.28) * vh;
      // Diam: api sedikit melewati ruang footer. Tiap insiden Diduga menaikkan api, penuh di 6 insiden.
      const idle = reserve * 1.2;
      const base = idle + (Math.min(s.suspected, 6) / 6) * Math.max(max - idle, 0);
      // Nyala sesaat: naik cepat, lalu turun dalam sekitar 1,8 detik.
      const since = (now - s.flareAt) / 1000;
      const flare = since >= 0 && since < 1.8 ? Math.sin(Math.min(since / 1.8, 1) * Math.PI) * vh * (mobile ? 0.12 : 0.2) : 0;
      const charH = (mobile ? 10 : 14) + Math.min(s.confirmed, 8) * (mobile ? 3 : 4);
      return { flameH: base + flare, charH };
    }

    /**
     * Satu langkah simulasi gaya api Doom: setiap sel memindahkan panasnya ke sel tepat di atasnya,
     * bergeser acak satu kolom, dan kadang mendingin sedikit. Hasilnya lidah api vertikal yang menyatu.
     */
    function step(t: number, flameH: number) {
      // Rata-rata pendinginan per baris = decay / 2, jadi kolom terpanas pudar di sekitar flameH.
      const decay = (1.9 * CELL) / Math.max(flameH, CELL * 4);
      const bottom = (rows - 1) * cols;
      for (let x = 0; x < cols; x++) {
        // Panas dasar sedikit bergelombang supaya lidah api besar bergeser pelan.
        const n = Math.sin(x * 0.07 + t * 1.6) * 0.6 + Math.sin(x * 0.19 - t * 2.4) * 0.4;
        heat[bottom + x] = 0.76 + 0.24 * n;
      }
      for (let y = 1; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const src = y * cols + x;
          const h = heat[src];
          if (h <= 0) {
            heat[src - cols] = 0;
            continue;
          }
          const r = (Math.random() * 4) | 0;
          const dst = Math.min(Math.max(src - cols - r + 1, (y - 1) * cols), y * cols - 1);
          heat[dst] = Math.max(0, h - (r & 1) * decay);
        }
      }
    }

    function paint() {
      const data = image!.data;
      for (let i = 0; i < heat.length; i++) {
        const p = Math.min(255, (heat[i] * 255) | 0) * 4;
        data[i * 4] = palette[p];
        data[i * 4 + 1] = palette[p + 1];
        data[i * 4 + 2] = palette[p + 2];
        data[i * 4 + 3] = palette[p + 3];
      }
      offCtx.putImageData(image!, 0, 0);
      // Blur tipis di kanvas kecil (murah) menghapus kesan piksel sebelum diperbesar.
      softCtx.clearRect(0, 0, cols, rows);
      softCtx.drawImage(off, 0, 0);
      ctx!.clearRect(0, 0, width, height);
      ctx!.imageSmoothingEnabled = true;
      ctx!.drawImage(soft, 0, 0, cols * CELL, rows * CELL);
    }

    function drawSparks(dt: number, flameH: number) {
      if (Math.random() < dt * (3 + flameH / 30)) {
        sparks.push({ x: Math.random() * width, y: height - flameH * 0.6, vx: (Math.random() - 0.5) * 24, vy: -(40 + Math.random() * 70), life: 1 });
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt * 0.55;
        if (p.life <= 0 || p.y < 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx!.globalAlpha = p.life;
        ctx!.fillStyle = p.life > 0.5 ? "#FDE68A" : "#F97316";
        ctx!.fillRect(p.x, p.y, 2, 2);
      }
      ctx!.globalAlpha = 1;
    }

    function drawChar(charH: number, t: number) {
      const top = height - charH;
      ctx!.fillStyle = CHAR;
      ctx!.beginPath();
      ctx!.moveTo(0, height);
      for (let x = 0; x <= width + 6; x += 6) ctx!.lineTo(x, top - charEdge(x) * charH * 0.4);
      ctx!.lineTo(width, height);
      ctx!.closePath();
      ctx!.fill();
      // Retakan bara yang berkedip di tanah gosong.
      for (let x = 23; x < width; x += 47) {
        const flick = 0.5 + 0.5 * Math.sin(t * 2.3 + x);
        ctx!.globalAlpha = 0.35 + 0.5 * flick;
        ctx!.fillStyle = flick > 0.6 ? "#F97316" : "#DC2626";
        ctx!.fillRect(x, height - charH * (0.35 + 0.3 * Math.sin(x)), 6 + (x % 9), 1.5);
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
      // Penghalusan memakai waktu nyata, jadi tab yang baru aktif lagi langsung menyusul.
      s.height += (flameH - s.height) * (1 - Math.exp(-elapsed * 4));
      s.char += (charH - s.char) * (1 - Math.exp(-elapsed * 2));

      step(now / 1000, s.height);
      paint();
      drawSparks(dt, s.height);
      drawChar(s.char, now / 1000);
      raf = requestAnimationFrame(frame);
    }

    function still() {
      const s = state.current;
      const { flameH, charH } = targets(-Infinity);
      s.height = flameH;
      s.char = charH;
      // Jalankan simulasi sampai stabil, lalu gambar satu bingkai saja.
      for (let i = 0; i < rows + 10; i++) step(i * 0.03, flameH);
      paint();
      drawChar(charH, 0);
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
