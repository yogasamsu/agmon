"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FIREBOND, REPO_URL, STATUS, addressUrl, firmsMapUrl, formatIdr, formatMon, formatWib } from "@/lib/chain";
import { LOCALE, useLang } from "@/lib/i18n";
import type { DashboardData } from "@/lib/types";
import type { Flare } from "./FlameLayer";
import IncidentCard from "./IncidentCard";
import InsightsPanel from "./InsightsPanel";
import type { FocusPoint } from "./FireMap";
import IntegrityCheck from "./IntegrityCheck";
import SiteHeader from "./SiteHeader";

// Leaflet butuh `window`, jadi peta hanya dirender di browser.
const FireMap = dynamic(() => import("./FireMap"), {
  ssr: false,
  loading: () => <div className="map map-loading" />,
});

const REFRESH_MS = 30_000;

export default function Dashboard() {
  const { lang, t } = useLang();
  const locale = LOCALE[lang];
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<number | null>(null);
  const [flare, setFlare] = useState<Flare>(null);
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const focusOn = useCallback((lat: number, lng: number, zoom: number) => {
    setFocusPoint({ lat, lng, zoom, at: Date.now() });
    // Di ponsel peta ada di atas panel; gulir ke peta supaya perpindahannya terlihat.
    document.querySelector(".map-wrap")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);
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
      if (status === STATUS.Confirmed) setFlare({ incidentId: id, at: performance.now() });
      load();
    },
    [load],
  );

  // Observasi satelit paling akhir dari batch NASA (bukan berkas demo), untuk menunjukkan kesegaran data.
  const latestFirms = data?.batches
    .filter((b) => !b.source.startsWith("file:"))
    .reduce<{ toUnix: number } | null>((max, b) => (!max || b.toUnix > max.toUnix ? b : max), null);
  const concessionName = (id: number) => data?.concessions.find((c) => c.id === id)?.name ?? t.permitFallback(id);
  const suspected = incidents.filter((i) => i.status === STATUS.Suspected).length;
  const confirmed = incidents.filter((i) => i.status === STATUS.Confirmed).length;

  return (
    <div className="shell">
      <SiteHeader />

      <section className="dash-head">
        <div className="dash-title">
          <h1>{t.dashTitle}</h1>
          <p>{t.dashSubtitle}</p>
          <p className="data-source">
            {t.dataSourceLabel}:{" "}
            <a href="https://firms.modaps.eosdis.nasa.gov/" target="_blank" rel="noreferrer">
              {t.dataSource}
            </a>
            {latestFirms ? ` · ${t.lastFetch(formatWib(latestFirms.toUnix, locale))}` : null}
          </p>
          <a className="btn nasa-btn" href={firmsMapUrl()} target="_blank" rel="noreferrer">
            {t.checkNasa}
          </a>
        </div>
        <div className="stat-groups">
          <div className="stat-group">
            <h2>{t.groupFires}</h2>
            <dl className="stats">
              <Stat label={t.statHotspots48h} value={data?.hotspotCount48h} locale={locale} />
              <Stat label={t.statSuspected} value={data ? suspected : undefined} tone="ember" locale={locale} />
              <Stat label={t.statConfirmed} value={data ? confirmed : undefined} tone="red" locale={locale} />
              <Stat label={t.statPermits} value={data?.concessions.length} locale={locale} />
            </dl>
          </div>
          <div className="stat-group bond-group">
            <h2>{t.groupBond}</h2>
            <dl className="stats">
              <div title={t.statBondPoolHint}>
                <dt>{t.statBondPool}</dt>
                <dd className="mono-num">
                  {data && FIREBOND ? (
                    <a href={addressUrl(FIREBOND)} target="_blank" rel="noreferrer">
                      {formatIdr(data.bondPoolWei, t.idrUnits, locale)}
                    </a>
                  ) : (
                    "–"
                  )}
                  {data ? <span className="sub">{formatMon(data.bondPoolWei, locale)}</span> : null}
                </dd>
              </div>
              <div className="flow-arrow" aria-hidden>
                →
              </div>
              <div>
                <dt>{t.statReleased}</dt>
                <dd className="mono-num red">
                  {data?.fundAddress ? (
                    <a href={addressUrl(data.fundAddress)} target="_blank" rel="noreferrer">
                      {formatIdr(data.fundBalanceWei, t.idrUnits, locale)}
                    </a>
                  ) : (
                    "–"
                  )}
                  {data?.fundAddress ? <span className="sub">{formatMon(data.fundBalanceWei, locale)}</span> : null}
                </dd>
              </div>
            </dl>
            <p className="scale-note">
              {t.statBondPoolHint} {t.demoScale(formatIdr(10n ** 18n, t.idrUnits, locale))}
            </p>
          </div>
        </div>
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
            flare={flare}
            focusPoint={focusPoint}
          />
          <ul className="legend" aria-label="Legend">
            <li><i style={{ background: "#DC2626" }} />{t.legendConfirmed}</li>
            <li><i style={{ background: "#F97316" }} />{t.legendSuspected}</li>
            <li><i style={{ background: "#FDBA74" }} />{t.legendInside}</li>
            <li><i style={{ background: "#FEF3C7" }} />{t.legendOutside}</li>
            <li><i style={{ background: "#A8A29E" }} />{t.legendRejected}</li>
          </ul>
        </section>

        <aside className="panel">
          <InsightsPanel onFocus={focusOn} />

          <h2>{t.incidents}</h2>
          {data?.incidents.length === 0 ? <p className="muted">{t.incidentsEmpty}</p> : null}
          {incidents.map((i) => (
            <IncidentCard
              key={`${i.id}-${i.status}`}
              incident={i}
              concessionName={concessionName(i.concessionId)}
              onDecided={onDecided}
              onFocus={() => i.lat !== null && i.lng !== null && focusOn(i.lat, i.lng, 14)}
            />
          ))}

          <h2>{t.permits}</h2>
          {data?.concessions.length === 0 ? <p className="muted">{t.permitsEmpty}</p> : null}
          {data?.concessions.map((c) => (
            <button key={c.id} className={`card concession ${focusId === c.id ? "active" : ""}`} onClick={() => setFocusId(c.id)}>
              <div className="card-head">
                <strong>{c.name}</strong>
                <span className="bond" title={t.bondLabel}>
                  {formatIdr(c.bondWei, t.idrUnits, locale)}
                  <span className="sub">{formatMon(c.bondWei, locale)}</span>
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
            <span className="muted ack">{t.nasaAck}</span>
          </footer>
        </aside>
      </main>
    </div>
  );
}

function Stat({ label, value, tone, locale }: { label: string; value: number | undefined; tone?: "ember" | "red"; locale: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={`mono-num ${tone ?? ""}`}>{value === undefined ? "–" : value.toLocaleString(locale)}</dd>
    </div>
  );
}

