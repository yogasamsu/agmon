"use client";

import { useState } from "react";
import { keccak256, zeroHash, type Hex } from "viem";
import { fireBondAbi } from "@/lib/abi";
import { FIREBOND, STATUS, firmsMapUrl, formatWib, monad, publicClient, shortHash, txUrl } from "@/lib/chain";
import { LOCALE, useLang } from "@/lib/i18n";
import type { IncidentView } from "@/lib/types";
import { NoWalletError, connectWallet } from "@/lib/wallet";

type Props = {
  incident: IncidentView;
  concessionName: string;
  onDecided: (id: number, status: number) => void;
  onFocus: () => void;
};

export default function IncidentCard({ incident, concessionName, onDecided, onFocus }: Props) {
  const { lang, t } = useLang();
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function explain(err: unknown): string {
    if (err instanceof NoWalletError) return t.errNoWallet;
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("NotVerifier")) return t.errNotVerifier;
    if (message.includes("NotSuspected")) return t.errNotSuspected;
    if (message.includes("User rejected") || message.includes("User denied")) return t.errRejected;
    // EIP-1193 -32002: dompet menolak karena masih ada permintaan lain yang menggantung.
    if ((err as { code?: number }).code === -32002 || message.includes("Requested resource not available")) return t.errPending;
    return (err as { shortMessage?: string }).shortMessage ?? message;
  }

  async function decide(functionName: "confirmFire" | "rejectFire") {
    setBusy(true);
    setError(null);
    try {
      const { wallet, account } = await connectWallet();
      // Foto tidak diunggah ke mana pun. Yang dicatat hanya sidik jarinya.
      const evidence: Hex = photo ? keccak256(new Uint8Array(await photo.arrayBuffer())) : zeroHash;
      const call = {
        account,
        address: FIREBOND,
        abi: fireBondAbi,
        functionName,
        args: [BigInt(incident.id), evidence] as const,
      };
      // Simulasi dulu supaya galat kontrak (misalnya bukan verifikator) muncul sebelum dompet terbuka.
      await publicClient.simulateContract(call);
      // Gas dan harga gas dihitung di sini, bukan ditebak dompet. Monad menagih berdasarkan batas gas,
      // dan perkiraan biaya bawaan dompet bisa terlalu tinggi sampai dompet mengira saldonya kurang.
      const [gas, fees] = await Promise.all([publicClient.estimateContractGas(call), publicClient.estimateFeesPerGas()]);
      // Monad memberi receipt di panggilan yang sama (eth_sendRawTransactionSync) bila dompet
      // mendukung; kalau tidak, viem menunggu receipt seperti biasa.
      const receipt = await wallet.writeContractSync({
        ...call,
        chain: monad,
        gas: (gas * 12n) / 10n,
        maxFeePerGas: fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        timeout: 30_000,
      });
      setTx(receipt.transactionHash);
      onDecided(incident.id, functionName === "confirmFire" ? STATUS.Confirmed : STATUS.Rejected);
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  }

  const statusClass = ["", "suspected", "confirmed", "rejected"][incident.status] ?? "";

  return (
    <article className={`card incident ${statusClass}`}>
      <div className="card-head clickable" onClick={onFocus}>
        <strong>{t.incidentTitle(incident.id)}</strong>
        <span className={`badge ${statusClass}`}>{t.status[incident.status]}</span>
      </div>
      <p className="muted">
        {concessionName} · {formatWib(incident.observedAt, LOCALE[lang])}
      </p>
      {incident.lat !== null ? (
        <span className="link-row">
          <button className="link-btn" onClick={onFocus}>
            {t.showOnMap} →
          </button>
          <a
            className="small"
            href={firmsMapUrl({ lat: incident.lat, lng: incident.lng!, unix: incident.observedAt })}
            target="_blank"
            rel="noreferrer"
          >
            {t.openNasa}
          </a>
        </span>
      ) : null}
      <p className="muted small">
        <abbr title={t.cellHint}>{t.cellLabel}</abbr> <span className="mono">{incident.cell}</span>
        {incident.reportTx ? (
          <>
            {" · "}
            <a href={txUrl(incident.reportTx)} target="_blank" rel="noreferrer">
              {t.reportLink} <span className="mono">{shortHash(incident.reportTx)}</span>
            </a>
          </>
        ) : null}
      </p>

      {incident.status === STATUS.Suspected ? (
        <div className="actions">
          <p className="role-tag">{t.verifierAction}</p>
          <label className="file">
            {t.evidenceLabel}
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            <span className="muted">{t.evidenceHint}</span>
          </label>
          <div className="buttons">
            <button className="primary" disabled={busy} onClick={() => decide("confirmFire")}>
              {t.confirm}
            </button>
            <button disabled={busy} onClick={() => decide("rejectFire")}>
              {t.reject}
            </button>
          </div>
        </div>
      ) : incident.evidenceHash && incident.evidenceHash !== zeroHash ? (
        <p className="muted small">
          {t.evidenceStored} <span className="mono">{shortHash(incident.evidenceHash)}</span>
        </p>
      ) : null}

      {busy ? <p className="small">{t.waiting}</p> : null}
      {tx ? (
        <p className="small">
          {t.txLabel}:{" "}
          <a href={txUrl(tx)} target="_blank" rel="noreferrer" className="mono">
            {shortHash(tx)}
          </a>
        </p>
      ) : null}
      {error ? <p className="error small">{error}</p> : null}
    </article>
  );
}
