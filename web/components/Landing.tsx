"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FIREBOND, REPO_URL, STATUS, addressUrl, formatIdr } from "@/lib/chain";
import { LOCALE, useLang } from "@/lib/i18n";
import type { DashboardData } from "@/lib/types";
import FireBand from "./FireBand";
import SiteHeader from "./SiteHeader";

export default function Landing() {
  const { lang, t } = useLang();
  const [data, setData] = useState<DashboardData | null>(null);

  // Angka live di hero diambil sekali. Kalau gagal, halaman tetap utuh dengan tanda "–".
  useEffect(() => {
    fetch("/api/data", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const suspected = data?.incidents.filter((i) => i.status === STATUS.Suspected).length ?? 0;
  const confirmed = data?.incidents.filter((i) => i.status === STATUS.Confirmed).length ?? 0;

  // Pratinjau untuk rekaman video iklan: ?fire=<diduga>,<terkonfirmasi> hanya mengubah footer api.
  const [preview, setPreview] = useState<[number, number] | null>(null);
  useEffect(() => {
    const parts = new URLSearchParams(window.location.search).get("fire")?.split(",").map(Number);
    if (parts?.length === 2 && parts.every(Number.isFinite)) setPreview([parts[0], parts[1]]);
  }, []);
  const [fireSuspected, fireConfirmed] = preview ?? [suspected, confirmed];

  return (
    <div className="page">
      <SiteHeader />

      <section className="land-hero">
        <div className="land-hero-copy">
          <p className="kicker">{t.heroEyebrow}</p>
          <h1>{t.heroTitle}</h1>
          <p className="lead">{t.heroBody}</p>
          <div className="cta-row">
            <Link href="/dashboard" className="btn primary">
              {t.ctaDashboard}
            </Link>
            {FIREBOND ? (
              <a href={addressUrl(FIREBOND)} target="_blank" rel="noreferrer" className="btn">
                {t.ctaContract}
              </a>
            ) : (
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn">
                {t.source}
              </a>
            )}
          </div>
          <dl className="stats hero-stats" aria-label={t.heroLive}>
            <div>
              <dt>{t.statPermits}</dt>
              <dd className="mono-num">{data?.concessions.length ?? "–"}</dd>
            </div>
            <div>
              <dt>{t.statSuspected}</dt>
              <dd className="mono-num ember">{data ? suspected : "–"}</dd>
            </div>
            <div>
              <dt>{t.statReleased}</dt>
              <dd className="mono-num">{data?.fundAddress ? formatIdr(data.fundBalanceWei, t.idrUnits, LOCALE[lang]) : "–"}</dd>
            </div>
          </dl>
          <p className="scale-note">{t.demoScale(formatIdr(10n ** 18n, t.idrUnits, LOCALE[lang]))}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="land-mascot" src="/agmon-mascot.png" alt="AgMon, a Komodo dragon with a burning tail" />
      </section>

      <section className="land-section">
        <p className="kicker">{t.problemKicker}</p>
        <h2>{t.problemTitle}</h2>
        <div className="big-stats">
          <div>
            <strong>{t.stat2015}</strong>
            <span>{t.stat2015Body}</span>
          </div>
          <div>
            <strong>{t.stat2019}</strong>
            <span>{t.stat2019Body}</span>
          </div>
        </div>
        <ol className="grid three plain">
          {t.problems.map(([title, body]) => (
            <li key={title} className="tile">
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="land-section">
        <p className="kicker">{t.compareKicker}</p>
        <h2>{t.compareTitle}</h2>
        <div className="compare">
          <div className="compare-col before">
            <h3>{t.beforeTitle}</h3>
            <ul>
              {t.before.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="compare-arrow" aria-hidden>
            →
          </div>
          <div className="compare-col after">
            <h3>{t.afterTitle}</h3>
            <ol>
              {t.after.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="land-section cream">
        <p className="kicker">{t.solutionKicker}</p>
        <h2>{t.solutionTitle}</h2>
        <ol className="steps">
          {t.steps.map(([title, body], i) => (
            <li key={title}>
              <span className="step-no">{i + 1}</span>
              <div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="land-section">
        <p className="kicker">{t.monadKicker}</p>
        <h2>{t.monadTitle}</h2>
        <ul className="grid four plain">
          {t.monadPoints.map(([title, body]) => (
            <li key={title} className="tile">
              <h3 className="fire-text">{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="land-section cream">
        <p className="kicker">{t.benefitKicker}</p>
        <h2>{t.benefitTitle}</h2>
        <ul className="grid four plain">
          {t.benefits.map(([title, body], i) => (
            <li key={title} className={`tile ${i === 0 ? "featured" : ""}`}>
              {i === 0 ? <span className="badge suspected">{t.mainCustomer}</span> : null}
              <h3>{title}</h3>
              <p>{body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="land-section closing">
        <h2>{t.closingTitle}</h2>
        <p className="lead">{t.closingBody}</p>
        <div className="cta-row center">
          <Link href="/dashboard" className="btn primary">
            {t.ctaDashboard}
          </Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn">
            {t.source}
          </a>
        </div>
        <p className="muted small">{t.demoNote}</p>
      </section>

      <FireBand suspected={fireSuspected} confirmed={fireConfirmed} flareKey={0} />
    </div>
  );
}
