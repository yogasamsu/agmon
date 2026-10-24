import type { Feature } from "geojson";

export type ConcessionView = {
  id: number;
  name: string;
  owner: string;
  geojson: Feature;
  registerTx: string | null;
  bondWei: string;
  confirmedFires: number;
  openIncidents: number;
};

export type IncidentView = {
  id: number;
  concessionId: number;
  cell: string;
  observedAt: number;
  reportTx: string | null;
  status: number;
  evidenceHash: string;
  lat: number | null;
  lng: number | null;
};

export type HotspotView = {
  id: number;
  lat: number;
  lng: number;
  confidence: number;
  frp: number;
  observedAt: number;
  concessionId: number | null;
  incidentId: number | null;
  batchId: number;
};

export type BatchView = {
  id: number;
  dataHash: string;
  count: number;
  fromUnix: number;
  toUnix: number;
  source: string;
  anchorTx: string | null;
};

export type DashboardData = {
  fireBond: string;
  fundAddress: string | null;
  fundBalanceWei: string;
  /** Saldo kontrak FireBond: jaminan semua izin yang sedang ditahan. */
  bondPoolWei: string;
  batchCount: number;
  hotspotCount48h: number;
  concessions: ConcessionView[];
  incidents: IncidentView[];
  hotspots: HotspotView[];
  batches: BatchView[];
};

export type Insights = {
  generatedAt: number;
  total48h: number;
  last24: number;
  prev24: number;
  provinces: { name: string; count: number; last24: number; prev24: number }[];
  clusters: {
    lat: number;
    lng: number;
    province: string;
    last24: number;
    prev24: number;
    maxFrp: number;
    inside: number;
    isNew: boolean;
    growing: boolean;
    highFrp: boolean;
    score: number;
  }[];
};
