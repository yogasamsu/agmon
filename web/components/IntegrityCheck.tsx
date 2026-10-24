"use client";

import { useState } from "react";
import { fireBondAbi } from "@/lib/abi";
import { batchHash, type CanonicalHotspot } from "@/lib/canonical";
import { FIREBOND, formatWib, publicClient, shortHash, txUrl } from "@/lib/chain";
import { LOCALE, useLang } from "@/lib/i18n";
import type { BatchView } from "@/lib/types";

type Result = { match: boolean; local: string; onChain: string; rows: number; expected: number };

/**
 * Hitung ulang hash batch dari data database di browser, lalu bandingkan dengan
 * sidik jari yang dicatat oracle di Monad.
 */
export default function IntegrityCheck({ batch }: { batch: BatchView }) {
  const { lang, t } = useLang();
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function check() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/batch/${batch.id}`, { cache: "no-store" });
      const json = (await res.json()) as { rows?: CanonicalHotspot[]; error?: string };
      if (!res.ok || !json.rows) throw new Error(json.error ?? t.batchFetchError);

      const [onChain, count] = await publicClient.readContract({
        address: FIREBOND,
        abi: fireBondAbi,
        functionName: "batches",
        args: [BigInt(batch.id)],
      });
      const local = batchHash(json.rows);
      setResult({
        match: local === onChain && json.rows.length === count,
        local,
        onChain,
        rows: json.rows.length,
        expected: count,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card">
      <div className="card-head">
        <strong>{t.batchTitle(batch.id)}</strong>
        <span className="muted small">{t.batchCount(batch.count)}</span>
      </div>
      <p className="muted small">
        {batch.source} · {formatWib(batch.fromUnix, LOCALE[lang])}
        {batch.anchorTx ? (
          <>
            {" · "}
            <a href={txUrl(batch.anchorTx)} target="_blank" rel="noreferrer">
              {t.anchorLink} <span className="mono">{shortHash(batch.anchorTx)}</span>
            </a>
          </>
        ) : null}
      </p>
      <button disabled={busy} onClick={check}>
        {busy ? t.checking : t.checkIntegrity}
      </button>
      {result ? (
        <div className={`integrity ${result.match ? "ok" : "bad"}`}>
          <strong>{result.match ? t.match : t.mismatch}</strong>
          <span>{result.match ? t.matchBody : t.mismatchBody}</span>
          <span className="mono">{t.hashLine(shortHash(result.local), result.rows, shortHash(result.onChain), result.expected)}</span>
        </div>
      ) : null}
      {error ? <p className="error small">{error}</p> : null}
    </article>
  );
}
