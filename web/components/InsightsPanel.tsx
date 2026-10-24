"use client";

import { useEffect, useState } from "react";
import { LOCALE, useLang } from "@/lib/i18n";
import { IDR_PER_USD, LOSS_PER_HOTSPOT_IDR, LOSS_SOURCE_URL, USD_PER_HA, formatRupiah } from "@/lib/loss";
import type { Insights } from "@/lib/types";

type Props = { onFocus: (lat: number, lng: number, zoom: number) => void };

/** Ringkasan nasional untuk regulator: tren, provinsi terbanyak, dan kelompok yang perlu perhatian. */
export default function InsightsPanel({ onFocus }: Props) {
  const { lang, t } = useLang();
  const [data, setData] = useState<Insights | null>(null);
  const num = (n: number) => n.toLocaleString(LOCALE[lang]);
  const rupiah = (idr: number) => formatRupiah(idr, t.idrUnits, LOCALE[lang]);

  useEffect(() => {
    const load = () =>
      fetch("/api/insights", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => json && !json.error && setData(json))
        .catch(() => {});
    load();
    const timer = setInterval(load, 5 * 60_000);
    return () => clearInterval(timer);
  }, []);

  if (!data) return <section className="insights muted small">{t.insightsLoading}</section>;
  const top = data.provinces[0]?.count ?? 1;

  return (
    <section className="insights" aria-label={t.insightsTitle}>
      <h2>{t.insightsTitle}</h2>
      <p className="small muted">{t.insightsTrend(num(data.last24), num(data.prev24))}</p>

      <div className="loss-block">
        <span className="loss-label">{t.lossTitle}</span>
        <strong className="loss-value">{rupiah(data.unique48h * LOSS_PER_HOTSPOT_IDR)}</strong>
        <span className="small">
          {t.lossBasis(num(data.unique48h))} · {t.lossPerHotspot(rupiah(LOSS_PER_HOTSPOT_IDR))}
        </span>
        <span className="small muted">
          {t.lossNote(num(Math.round(USD_PER_HA)), num(IDR_PER_USD))}{" "}
          <a href={LOSS_SOURCE_URL} target="_blank" rel="noreferrer">
            {t.lossSource}
          </a>
        </span>
      </div>

      <h3>{t.attention}</h3>
      <ul className="clusters">
        {data.clusters.map((c) => (
          <li key={`${c.lat},${c.lng}`}>
            <button onClick={() => onFocus(c.lat, c.lng, c.inside ? 12 : 10)}>
              <span className="cluster-head">
                <strong>{c.province || "–"}</strong>
                <span className="tags">
                  {c.inside ? <span className="tag red">{t.tagInside}</span> : null}
                  {c.growing ? <span className="tag ember">{t.tagGrowing}</span> : null}
                  {c.isNew ? <span className="tag ember">{t.tagNew}</span> : null}
                  {c.highFrp ? <span className="tag">{t.tagHighFrp}</span> : null}
                </span>
              </span>
              <span className="small muted">
                {t.clusterLine(num(c.last24), c.maxFrp)} · {t.clusterLoss(rupiah(c.unique24 * LOSS_PER_HOTSPOT_IDR))}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <h3>{t.topProvinces}</h3>
      <ol className="bars">
        {data.provinces.map((p) => (
          <li key={p.name}>
            <span className="bar-label">{p.name}</span>
            <span className="bar-track">
              <span className="bar-fill" style={{ width: `${Math.max((p.count / top) * 100, 2)}%` }} />
            </span>
            <span className="bar-value mono-num">{num(p.count)}</span>
          </li>
        ))}
      </ol>
      <p className="small muted">{t.boundaryNote}</p>
      <p className="small muted">{t.nasaAck}</p>
    </section>
  );
}
