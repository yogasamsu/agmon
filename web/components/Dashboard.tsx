"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FIREBOND, REPO_URL, STATUS, addressUrl, formatMon } from "@/lib/chain";
import { LOCALE, useLang, type Lang } from "@/lib/i18n";
import type { DashboardData } from "@/lib/types";
import FireBand from "./FireBand";
import IncidentCard from "./IncidentCard";
import IntegrityCheck from "./IntegrityCheck";
import Logo from "./Logo";

// Leaflet butuh `window`, jadi peta hanya dirender di browser.
const FireMap = dynamic(() => import("./FireMap"), {
  ssr: false,
  loading: () => <div className="map map-loading" />,
});

const REFRESH_MS = 30_000;

export default function Dashboard() {
  const { lang, t, setLang } = useLang();
  const locale = LOCALE[lang];
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [flareKey, setFlareKey] = useState(0);
  // Status yang baru saja diputuskan di browser ini. Dipakai sampai API ikut melihatnya,
  // supaya verifikator langsung melihat hasil keputusannya sendiri (read-your-writes).
  const [decided, setDecided] = useState<Map<number, number>>(new Map());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Buang status lokal begitu data dari chain sudah sama.
  useEffect(() => {
    if (!data || decided.size === 0) return;
    const next = new Map(decided);
    for (const i of data.incidents) if (next.get(i.id) === i.status) next.delete(i.id);
    if (next.size !== decided.size) setDecided(next);
  }, [data, decided]);

  const incidents = useMemo(
    () => (data?.incidents ?? []).map((i) => (decided.has(i.id) ? { ...i, status: decided.get(i.id)! } : i)),
    [data, decided],
  );

  const onDecided = useCallback(
    (id: number, status: number) => {
      setDecided((prev) => new Map(prev).set(id, status));
      if (status === STATUS.Confirmed) setFlareKey((k) => k + 1);
      load();
    },
    [load],
  );

  // Pratinjau efek untuk rekaman video: ?fire=<diduga>,<terkonfirmasi>. Hanya mengubah pita api,
  // bukan data. Setiap kali angka terkonfirmasi naik lewat URL ini, api ikut menyala sesaat.
  const [firePreview, setFirePreview] = useState<[number, number] | null>(null);
  useEffect(() => {
    const read = () => {
      const raw = new URLSearchParams(window.location.search).get("fire");
      const parts = raw?.split(",").map(Number);
      setFirePreview(parts && parts.length === 2 && parts.every(Number.isFinite) ? [parts[0], parts[1]] : null);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const concessionName = (id: number) => data?.concessions.find((c) => c.id === id)?.name ?? t.permitFallback(id);
  const suspected = incidents.filter((i) => i.status === STATUS.Suspected).length;
  const confirmed = incidents.filter((i) => i.status === STATUS.Confirmed).length;
  const [fireSuspected, fireConfirmed] = firePreview ?? [suspected, confirmed];

  useEffect(() => {
    if (firePreview && firePreview[1] > 0) setFlareKey((k) => k + 1);
  }, [firePreview?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <div>
            <h1>AgMon</h1>
            <p>{t.tagline}</p>
          </div>
        </div>
        <LangSwitch lang={lang} setLang={setLang} label={t.langLabel} />
      </header>

      <section className="hero">
        <p className="intro">
          {t.intro} <span className="demo-note">{t.demoNote}</span>
        </p>
        <dl className="stats">
          <Stat label={t.statPermits} value={data?.concessions.length} />
          <Stat label={t.statBatches} value={data?.batchCount} />
          <Stat label={t.statSuspected} value={data ? suspected : undefined} tone="ember" />
          <Stat label={t.statConfirmed} value={data ? confirmed : undefined} tone="red" />
          <div>
            <dt>{t.statReleased}</dt>
            <dd className="mono-num">
              {data?.fundAddress ? (
                <a href={addressUrl(data.fundAddress)} target="_blank" rel="noreferrer">
                  {formatMon(data.fundBalanceWei, locale)}
                </a>
              ) : (
                "–"
              )}
            </dd>
          </div>
        </dl>
      </section>

      {error ? (
        <div className="banner error">
          {t.loadError}: {error}
        </div>
      ) : null}

      <main className="layout">
        <section className="map-wrap" aria-label={t.mapLabel}>
          <FireMap
            concessions={data?.concessions ?? []}
            hotspots={data?.hotspots ?? []}
            incidents={incidents}
            focusId={focusId}
            onSelectConcession={setFocusId}
          />
          <ul className="legend" aria-label="Legend">
            <li><i style={{ background: "#DC2626" }} />{t.legendConfirmed}</li>
            <li><i style={{ background: "#F97316" }} />{t.legendSuspected}</li>
            <li><i style={{ background: "#FDBA74" }} />{t.legendInside}</li>
            <li><i style={{ background: "#FEF3C7" }} />{t.legendOutside}</li>
            <li><i style={{ background: "#A8A29E" }} />{t.legendRejected}</li>
          </ul>
          <FireBand suspected={fireSuspected} confirmed={fireConfirmed} flareKey={flareKey} />
        </section>

        <aside className="panel">
          <section className="roles" aria-label={t.rolesTitle}>
            <h2>{t.rolesTitle}</h2>
            <ul>
              <li>
                <strong>{t.roleRegulator}</strong>
                <span>{t.roleRegulatorWho}</span>
              </li>
              <li>
                <strong>{t.roleVerifier}</strong>
                <span>{t.roleVerifierWho}</span>
              </li>
              <li>
                <strong>{t.roleFund}</strong>
                <span>{t.roleFundWho}</span>
              </li>
            </ul>
            <p className="muted small">{t.roleDemo}</p>
          </section>

          <h2>{t.incidents}</h2>
          {data?.incidents.length === 0 ? <p className="muted">{t.incidentsEmpty}</p> : null}
          {incidents.map((i) => (
            <IncidentCard key={`${i.id}-${i.status}`} incident={i} concessionName={concessionName(i.concessionId)} onDecided={onDecided} />
          ))}

          <h2>{t.permits}</h2>
          {data?.concessions.length === 0 ? <p className="muted">{t.permitsEmpty}</p> : null}
          {data?.concessions.map((c) => (
            <button key={c.id} className={`card concession ${focusId === c.id ? "active" : ""}`} onClick={() => setFocusId(c.id)}>
              <div className="card-head">
                <strong>{c.name}</strong>
                <span className="bond" title={t.bondLabel}>
                  {formatMon(c.bondWei, locale)}
                </span>
              </div>
              <p className="muted small">{t.permitFires(c.confirmedFires, c.openIncidents)}</p>
              <a className="small" href={addressUrl(c.owner)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                {t.permitHolder} <span className="mono">{c.owner.slice(0, 6)}…{c.owner.slice(-4)}</span>
              </a>
            </button>
          ))}

          <h2 title={t.batchHint}>{t.batches}</h2>
          {data?.batches.length === 0 ? <p className="muted">{t.batchesEmpty}</p> : null}
          {data?.batches.map((b) => <IntegrityCheck key={b.id} batch={b} />)}

          <footer className="foot small">
            {FIREBOND ? (
              <a href={addressUrl(FIREBOND)} target="_blank" rel="noreferrer">
                {t.contract} <span className="mono">{FIREBOND.slice(0, 6)}…{FIREBOND.slice(-4)}</span>
              </a>
            ) : null}
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              {t.source}
            </a>
            <span className="muted">Monad Blitz Jogja 2026</span>
          </footer>
        </aside>
      </main>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | undefined; tone?: "ember" | "red" }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={`mono-num ${tone ?? ""}`}>{value ?? "–"}</dd>
    </div>
  );
}

function LangSwitch({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  return (
    <div className="lang" role="group" aria-label={label}>
      {(["en", "id"] as const).map((l) => (
        <button key={l} className={`lang-btn ${lang === l ? "on" : ""}`} aria-pressed={lang === l} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
