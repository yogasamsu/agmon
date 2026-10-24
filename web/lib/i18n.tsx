"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "en" | "id";

const en = {
  tagline: "Every fire tied to its permit holder. Recorded on Monad, bonded, verified in the field.",
  intro:
    "Satellite hotspots that fall inside a registered permit become incidents on Monad. When a Manggala Agni field officer confirms the fire, 20% of the permit holder's fire bond goes to the restoration fund.",
  demoNote: "Hotspots cover all of Indonesia; the pilot permit is in West Kalimantan and is fictional.",
  langLabel: "Language",

  statPermits: "Permits",
  statBatches: "Batches anchored",
  statSuspected: "Awaiting field check",
  statConfirmed: "Confirmed fires",
  statReleased: "Bond released to restoration",

  rolesTitle: "Who does what",
  roleRegulator: "Regulator",
  roleRegulatorWho: "Ministry of Forestry registers permit boundaries and requires the bond",
  roleVerifier: "Verifier",
  roleVerifierWho: "Manggala Agni or forest police confirm or reject in the field",
  roleFund: "Restoration fund",
  roleFundWho: "BPDLH receives released bonds",
  roleDemo: "In this demo the operator acts as the regulator.",

  mapLabel: "Map of permits and hotspots",
  mapLoading: "Loading map…",
  layerSatellite: "Satellite",
  layerStreets: "Streets",
  legendConfirmed: "Confirmed",
  legendSuspected: "Suspected",
  legendInside: "Inside a permit, not reported",
  legendOutside: "Outside any permit",
  legendRejected: "Rejected",

  permits: "Permits",
  permitsEmpty: "No permits yet. Run `npm run seed` in the oracle folder.",
  permitFires: (confirmed: number, open: number) => `${confirmed} confirmed fires · ${open} awaiting field check`,
  permitHolder: "Holder",
  permitFallback: (id: number) => `Permit #${id}`,
  bondLabel: "Fire bond",

  incidents: "Incidents",
  incidentsEmpty: "No hotspots inside a permit yet.",
  incidentTitle: (id: number) => `Incident #${id}`,
  status: ["None", "Suspected", "Confirmed", "Rejected"] as readonly string[],
  cellLabel: "H3 cell",
  cellHint: "Hexagonal map cell of about 5 km². Each cell belongs to one permit.",
  reportLink: "report",
  evidenceLabel: "Field photo (optional)",
  evidenceHint: "The photo stays on your device. Only its fingerprint goes on chain.",
  evidenceStored: "Evidence fingerprint",
  verifierAction: "Manggala Agni verifier",
  confirm: "Confirm fire",
  reject: "Reject",
  waiting: "Waiting for wallet and network…",
  txLabel: "Transaction",
  errNotVerifier: "This wallet is not registered as a verifier. Switch to the verifier wallet in MetaMask.",
  errNotSuspected: "This incident has already been decided.",
  errRejected: "You cancelled the transaction in your wallet.",
  errNoWallet: "No browser wallet found. Install MetaMask or Rabby, then try again.",

  batches: "Data batches",
  batchesEmpty: "The oracle has not anchored a batch yet.",
  batchHint: "One oracle run. Its keccak256 fingerprint is stored on Monad.",
  batchTitle: (id: number) => `Batch #${id}`,
  batchCount: (n: number) => `${n} hotspots`,
  anchorLink: "anchor",
  checkIntegrity: "Check integrity",
  checking: "Hashing…",
  match: "Match",
  mismatch: "Mismatch",
  matchBody: "The database rows hash to exactly the fingerprint on Monad.",
  mismatchBody: "The database rows changed after the oracle anchored them.",
  hashLine: (local: string, rows: number, chain: string, expected: number) =>
    `Database ${local} (${rows} rows) · Monad ${chain} (${expected} rows)`,
  batchFetchError: "Could not load the batch rows",

  loadError: "Could not load data",
  contract: "FireBond contract",
  source: "Source code",
  confidence: "Confidence",
  confidenceLevels: ["low", "nominal", "high"] as readonly string[],
  insidePermit: (id: number) => `Inside permit #${id}`,
  outsidePermit: "Outside any registered permit",
  timeZone: "WIB",
};

type Dict = typeof en;

const id: Dict = {
  tagline: "Setiap titik api terikat ke pemegang izinnya. Tercatat di Monad, berjaminan, diverifikasi di lapangan.",
  intro:
    "Titik api satelit yang jatuh di dalam izin terdaftar menjadi insiden di Monad. Begitu petugas Manggala Agni mengonfirmasi kebakaran di lapangan, 20% jaminan kebakaran pemegang izin dicairkan ke dana restorasi.",
  demoNote: "Titik api mencakup seluruh Indonesia; izin pilot di Kalimantan Barat dan fiktif.",
  langLabel: "Bahasa",

  statPermits: "Izin",
  statBatches: "Batch tercatat",
  statSuspected: "Menunggu cek lapangan",
  statConfirmed: "Kebakaran terkonfirmasi",
  statReleased: "Jaminan dicairkan ke restorasi",

  rolesTitle: "Siapa berperan apa",
  roleRegulator: "Regulator",
  roleRegulatorWho: "Kementerian Kehutanan mendaftarkan batas izin dan mewajibkan jaminan",
  roleVerifier: "Verifikator",
  roleVerifierWho: "Manggala Agni atau Polhut mengonfirmasi atau menolak di lapangan",
  roleFund: "Dana restorasi",
  roleFundWho: "BPDLH menerima jaminan yang dicairkan",
  roleDemo: "Di demo ini operator berperan sebagai regulator.",

  mapLabel: "Peta izin dan titik api",
  mapLoading: "Memuat peta…",
  layerSatellite: "Citra satelit",
  layerStreets: "Peta jalan",
  legendConfirmed: "Terkonfirmasi",
  legendSuspected: "Diduga",
  legendInside: "Di dalam izin, tidak dilaporkan",
  legendOutside: "Di luar izin",
  legendRejected: "Ditolak",

  permits: "Izin",
  permitsEmpty: "Belum ada izin. Jalankan `npm run seed` di folder oracle.",
  permitFires: (confirmed, open) => `${confirmed} kebakaran terkonfirmasi · ${open} menunggu cek lapangan`,
  permitHolder: "Pemegang",
  permitFallback: (n) => `Izin #${n}`,
  bondLabel: "Jaminan kebakaran",

  incidents: "Insiden",
  incidentsEmpty: "Belum ada titik api di dalam izin.",
  incidentTitle: (n) => `Insiden #${n}`,
  status: ["Tidak ada", "Diduga", "Terkonfirmasi", "Ditolak"],
  cellLabel: "Sel H3",
  cellHint: "Sel peta heksagonal seluas sekitar 5 km². Satu sel hanya milik satu izin.",
  reportLink: "laporan",
  evidenceLabel: "Foto lapangan (opsional)",
  evidenceHint: "Foto tetap di perangkat. Yang dicatat di chain hanya sidik jarinya.",
  evidenceStored: "Sidik jari bukti",
  verifierAction: "Verifikator Manggala Agni",
  confirm: "Konfirmasi kebakaran",
  reject: "Tolak",
  waiting: "Menunggu dompet dan jaringan…",
  txLabel: "Transaksi",
  errNotVerifier: "Dompet ini belum terdaftar sebagai verifikator. Ganti ke dompet verifikator di MetaMask.",
  errNotSuspected: "Insiden ini sudah diputuskan sebelumnya.",
  errRejected: "Transaksi dibatalkan di dompet.",
  errNoWallet: "Dompet browser tidak ditemukan. Pasang MetaMask atau Rabby, lalu coba lagi.",

  batches: "Batch data",
  batchesEmpty: "Oracle belum mencatat batch.",
  batchHint: "Satu putaran oracle. Sidik jari keccak256-nya tersimpan di Monad.",
  batchTitle: (n) => `Batch #${n}`,
  batchCount: (n) => `${n} titik api`,
  anchorLink: "anchor",
  checkIntegrity: "Cek integritas",
  checking: "Menghitung…",
  match: "Cocok",
  mismatch: "Tidak cocok",
  matchBody: "Hash data di database sama persis dengan sidik jari di Monad.",
  mismatchBody: "Data di database sudah berubah sejak dicatat oracle.",
  hashLine: (local, rows, chain, expected) => `Database ${local} (${rows} baris) · Monad ${chain} (${expected} baris)`,
  batchFetchError: "Gagal mengambil data batch",

  loadError: "Gagal memuat data",
  contract: "Kontrak FireBond",
  source: "Kode sumber",
  confidence: "Keyakinan",
  confidenceLevels: ["rendah", "nominal", "tinggi"],
  insidePermit: (n) => `Di dalam izin #${n}`,
  outsidePermit: "Di luar izin terdaftar",
  timeZone: "WIB",
};

export const DICTS: Record<Lang, Dict> = { en, id };
export const LOCALE: Record<Lang, string> = { en: "en-GB", id: "id-ID" };

const STORAGE_KEY = "agmon-lang";

type Ctx = { lang: Lang; t: Dict; setLang: (lang: Lang) => void };
const LangContext = createContext<Ctx>({ lang: "en", t: en, setLang: () => {} });

function detect(): Lang {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl === "en" || fromUrl === "id") return fromUrl;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "id") return saved;
  } catch {
    // localStorage bisa diblokir (mode privat). Jatuh ke bahasa browser.
  }
  return navigator.language.toLowerCase().startsWith("id") ? "id" : "en";
}

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => setLangState(detect()), []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Abaikan: pilihan bahasa hanya bertahan di sesi ini.
    }
  }, []);

  return <LangContext.Provider value={{ lang, t: DICTS[lang], setLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
