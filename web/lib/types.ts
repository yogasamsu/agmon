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
  batchCount: number;
  concessions: ConcessionView[];
  incidents: IncidentView[];
  hotspots: HotspotView[];
  batches: BatchView[];
};
