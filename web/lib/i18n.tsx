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
  demoScale: (rate: string) => `Demo scale: 1 testnet MON stands for ${rate}`,
  idrUnits: { billion: "billion", million: "million", prefix: "IDR " },

  navHome: "Home",
  navDashboard: "Dashboard",
  heroEyebrow: "Monad Blitz Jogja 2026 · Forest fire accountability",
  heroTitle: "When a forest burns, the permit holder pays for its recovery.",
  heroBody:
    "AgMon ties every satellite hotspot to the permit holder whose land it falls on, records the evidence on Monad, and releases 20% of their fire bond to restoration as soon as Manggala Agni confirms the fire in the field.",
  ctaDashboard: "Open the live dashboard",
  ctaContract: "View the contract",
  heroLive: "Live on Monad testnet",

  problemKicker: "The problem",
  problemTitle: "The fire is visible. The responsibility is not.",
  stat2015: "2.6 million ha",
  stat2015Body: "burned in 2015, costing Indonesia about US$16.1 billion (World Bank, 2016)",
  stat2019: "1.6 million ha",
  stat2019Body: "burned again in 2019 (Ministry of Environment and Forestry)",
  problems: [
    ["Hotspots are not tied to anyone", "SiPongi and NASA FIRMS show where fires burn. Matching a hotspot to the permit holder and making them pay is still manual and goes through court."],
    ["The data gets disputed", "Without a record nobody can alter, the argument shifts from the fire to the data, and blame lands on whoever is easiest to blame."],
    ["No money is ready for recovery", "Even won civil cases are hard to collect, so burned land waits years for restoration."],
  ] as readonly (readonly [string, string])[],

  compareKicker: "Before vs after",
  compareTitle: "From shifting blame to an automatic consequence",
  beforeTitle: "Before AgMon",
  before: [
    "A company is granted a forest permit",
    "When the forest burns, the government cannot quickly trace it to the permit holder",
    "No tracker, so no penalty",
    "Communities bear the smoke and the losses",
  ] as readonly string[],
  afterTitle: "With AgMon",
  after: [
    "Ministry registers the permit and its fire bond",
    "Satellites detect every hotspot inside the permit",
    "Manggala Agni verifies in the field",
    "20% of the bond is released to restoration",
    "Anyone can audit the record on Monad",
  ] as readonly string[],

  solutionKicker: "The solution",
  solutionTitle: "How AgMon closes the loop",
  steps: [
    ["Register and bond", "The Ministry of Forestry registers each permit boundary as hexagonal map cells: one cell, one permit holder, overlaps rejected. The holder deposits a fire bond as a permit condition."],
    ["Detect", "Every 30 minutes the oracle pulls NASA satellite hotspots for all of Indonesia and stores their fingerprint on Monad. A hotspot inside a permit becomes a Suspected incident."],
    ["Verify", "A Manggala Agni officer checks the site and confirms or rejects. The satellite detects; a person decides."],
    ["Release", "Confirmation sends 20% of the bond to the restoration fund in the same transaction. No meeting, no delay."],
    ["Audit", "Anyone can re-hash the stored data and compare it with Monad. Change one number and the check fails."],
  ] as readonly (readonly [string, string])[],

  monadKicker: "Why Monad",
  monadTitle: "Fire season needs a fast, cheap, public ledger",
  monadPoints: [
    ["0.6 s finality", "When the officer presses Confirm, the bond on screen drops before they look up."],
    ["10,000 TPS", "At the peak of fire season Indonesia logs thousands of hotspots a day, and every report is a transaction."],
    ["Instant freeze", "The moment a hotspot inside a permit is reported, withdrawBond is blocked. The holder cannot pull the bond while the land burns."],
    ["Atomic payout in Rupiah", "In production the bond sits in the contract as a Rupiah stablecoin or tokenized bank guarantee, so 20% reaches restoration in one transaction."],
  ] as readonly (readonly [string, string])[],

  benefitKicker: "Who gains",
  benefitTitle: "One record, four winners",
  mainCustomer: "Main customer",
  benefits: [
    ["Government", "One source of truth that no one can quietly edit, faster enforcement, and restoration money that is ready before the fire."],
    ["Permit holders", "Clear rules, the full bond back when the land stays clean, and a public record of compliance for buyers and banks."],
    ["Communities", "A public dashboard showing which permit burned and what it cost the holder: evidence they can bring to demand action."],
    ["Forests", "Fire carries a price, so preventing it becomes cheaper than letting it burn. That pushes toward sustainable forestry."],
  ] as readonly (readonly [string, string])[],

  closingTitle: "See it working on Monad testnet",
  closingBody: "Press Confirm with the verifier wallet and watch the bond move to the restoration fund.",
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
  demoScale: (rate) => `Skala demo: 1 MON testnet mewakili ${rate}`,
  idrUnits: { billion: "miliar", million: "juta", prefix: "Rp" },

  navHome: "Beranda",
  navDashboard: "Dasbor",
  heroEyebrow: "Monad Blitz Jogja 2026 · Akuntabilitas kebakaran hutan",
  heroTitle: "Hutan terbakar, pemegang izin menanggung pemulihannya.",
  heroBody:
    "AgMon mengikat setiap titik api satelit ke pemegang izin pemilik lahannya, mencatat buktinya di Monad, dan mencairkan 20% jaminan kebakarannya ke dana restorasi begitu Manggala Agni mengonfirmasi di lapangan.",
  ctaDashboard: "Buka dasbor live",
  ctaContract: "Lihat kontrak",
  heroLive: "Berjalan di Monad testnet",

  problemKicker: "Masalah",
  problemTitle: "Apinya terlihat. Tanggung jawabnya tidak.",
  stat2015: "2,6 juta ha",
  stat2015Body: "terbakar pada 2015, dengan kerugian sekitar US$16,1 miliar (Bank Dunia, 2016)",
  stat2019: "1,6 juta ha",
  stat2019Body: "terbakar lagi pada 2019 (KLHK)",
  problems: [
    ["Titik api tidak terikat ke siapa pun", "SiPongi dan NASA FIRMS menunjukkan lokasi api. Mencocokkannya dengan pemegang izin lalu menagih tanggung jawabnya masih manual dan lewat pengadilan."],
    ["Datanya bisa dibantah", "Tanpa catatan yang tidak bisa diubah, perdebatan bergeser dari api ke data, dan kesalahan jatuh ke pihak yang paling mudah disalahkan."],
    ["Dana pemulihan tidak siap", "Gugatan perdata yang menang pun sulit dieksekusi, sehingga lahan terbakar menunggu bertahun-tahun untuk dipulihkan."],
  ],

  compareKicker: "Sebelum dan sesudah",
  compareTitle: "Dari saling lempar tanggung jawab ke konsekuensi otomatis",
  beforeTitle: "Sebelum AgMon",
  before: [
    "Perusahaan mendapat izin konsesi",
    "Saat hutan terbakar, pemerintah tidak bisa cepat melacak pemegang izinnya",
    "Tanpa pelacak, tidak ada sanksi",
    "Masyarakat menanggung asap dan kerugiannya",
  ],
  afterTitle: "Dengan AgMon",
  after: [
    "Kemenhut mendaftarkan izin dan jaminan kebakarannya",
    "Satelit mendeteksi setiap titik api di dalam izin",
    "Manggala Agni memverifikasi di lapangan",
    "20% jaminan dicairkan ke dana restorasi",
    "Siapa pun bisa mengaudit catatannya di Monad",
  ],

  solutionKicker: "Solusi",
  solutionTitle: "Cara AgMon menutup rantainya",
  steps: [
    ["Daftar dan setor jaminan", "Kemenhut mendaftarkan batas setiap izin sebagai sel peta heksagonal: satu sel untuk satu pemegang izin, dan izin yang tumpang tindih ditolak. Pemegang izin menyetor jaminan kebakaran sebagai syarat izin."],
    ["Deteksi", "Setiap 30 menit oracle menarik titik api satelit NASA untuk seluruh Indonesia dan menyimpan sidik jarinya di Monad. Titik api di dalam izin menjadi insiden Diduga."],
    ["Verifikasi", "Petugas Manggala Agni memeriksa lokasi lalu mengonfirmasi atau menolak. Satelit mendeteksi, manusia yang memutuskan."],
    ["Cairkan", "Konfirmasi mengirim 20% jaminan ke dana restorasi dalam transaksi yang sama, tanpa rapat dan tanpa penundaan."],
    ["Audit", "Siapa pun bisa menghitung ulang sidik jari data dan membandingkannya dengan Monad. Ubah satu angka, hasilnya langsung tidak cocok."],
  ],

  monadKicker: "Kenapa Monad",
  monadTitle: "Musim kebakaran butuh buku besar publik yang cepat dan murah",
  monadPoints: [
    ["Final dalam 0,6 detik", "Begitu petugas menekan Konfirmasi, angka jaminan di layar langsung turun."],
    ["10.000 TPS", "Di puncak musim kebakaran, titik api bisa ribuan per hari, dan setiap laporan adalah satu transaksi."],
    ["Pembekuan instan", "Begitu titik api di dalam izin dilaporkan, withdrawBond langsung terblokir. Pemegang izin tidak bisa menarik jaminan saat lahannya terbakar."],
    ["Pencairan atomik dalam Rupiah", "Di produksi, jaminan disimpan di kontrak sebagai stablecoin Rupiah atau bank garansi tertokenisasi, jadi 20% sampai ke dana restorasi dalam satu transaksi."],
  ],

  benefitKicker: "Siapa yang diuntungkan",
  benefitTitle: "Satu catatan, empat pihak untung",
  mainCustomer: "Pelanggan utama",
  benefits: [
    ["Pemerintah", "Satu sumber kebenaran yang tidak bisa diubah diam-diam, penegakan lebih cepat, dan dana restorasi yang siap sebelum api datang."],
    ["Pemegang izin", "Aturan yang jelas, jaminan kembali penuh kalau lahan bersih, dan catatan kepatuhan yang bisa ditunjukkan ke pembeli dan bank."],
    ["Masyarakat", "Dasbor publik yang menunjukkan izin mana yang terbakar dan konsekuensinya, jadi warga punya bukti untuk menuntut tindakan."],
    ["Hutan", "Api punya harga, sehingga mencegahnya lebih murah daripada membiarkannya. Itu mendorong pengelolaan hutan lestari."],
  ],

  closingTitle: "Lihat langsung di Monad testnet",
  closingBody: "Tekan Konfirmasi dengan dompet verifikator, lalu lihat jaminan berpindah ke dana restorasi.",
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
