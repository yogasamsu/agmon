"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { CircleMarker, GeoJSON, LayersControl, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { STATUS, formatWib } from "@/lib/chain";
import { LOCALE, useLang } from "@/lib/i18n";
import type { ConcessionView, HotspotView, IncidentView } from "@/lib/types";
import FlameLayer, { type Flare, type FlameKind } from "./FlameLayer";

// Warna peta ditulis langsung karena Leaflet memasang warna sebagai atribut SVG,
// bukan lewat CSS, sehingga variabel CSS tidak terbaca.
// Token dari PRD bagian 11.
const COLOR = {
  confirmed: "#DC2626",
  suspected: "#F97316",
  rejected: "#A8A29E",
  insideOther: "#FDBA74",
  outside: "#FEF3C7",
  concession: "#FFFFFF",
  concessionBurned: "#DC2626",
};

type Props = {
  concessions: ConcessionView[];
  hotspots: HotspotView[];
  incidents: IncidentView[];
  focusId: number | null;
  onSelectConcession: (id: number) => void;
  flare: Flare;
};

function hotspotKind(h: HotspotView, statusById: Map<number, number>): FlameKind {
  if (h.incidentId) {
    const status = statusById.get(h.incidentId);
    if (status === STATUS.Confirmed) return "confirmed";
    if (status === STATUS.Rejected) return "rejected";
    return "suspected";
  }
  return h.concessionId ? "inside" : "outside";
}

function FocusController({ concessions, focusId }: { concessions: ConcessionView[]; focusId: number | null }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || concessions.length === 0) return;
    fitted.current = true;
    const bounds = L.geoJSON(concessions.map((c) => c.geojson)).getBounds();
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 11 });
  }, [concessions, map]);

  useEffect(() => {
    const target = concessions.find((c) => c.id === focusId);
    if (!target) return;
    map.flyToBounds(L.geoJSON(target.geojson).getBounds(), { padding: [60, 60], maxZoom: 12, duration: 0.8 });
  }, [focusId, concessions, map]);

  return null;
}

export default function FireMap({ concessions, hotspots, incidents, focusId, onSelectConcession, flare }: Props) {
  const { lang, t } = useLang();
  const statusById = useMemo(() => new Map(incidents.map((i) => [i.id, i.status])), [incidents]);
  const flames = useMemo(
    () =>
      hotspots.map((h) => ({ lat: h.lat, lng: h.lng, kind: hotspotKind(h, statusById), frp: h.frp, incidentId: h.incidentId })),
    [hotspots, statusById],
  );

  return (
    // Seluruh Indonesia. Begitu ada izin terdaftar, peta otomatis mendekat ke izin itu.
    <MapContainer center={[-2.5, 118]} zoom={5} className="map" preferCanvas>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name={t.layerSatellite}>
          <TileLayer
            attribution="Citra &copy; Esri, Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name={t.layerStreets}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      {concessions.map((c) => (
        <GeoJSON
          key={`${c.id}-${c.confirmedFires}-${c.openIncidents}`}
          data={c.geojson}
          style={{
            color: c.confirmedFires > 0 ? COLOR.concessionBurned : COLOR.concession,
            weight: 2.5,
            dashArray: "6 4",
            fillColor: "#EA580C",
            fillOpacity: c.confirmedFires > 0 ? 0.22 : 0.1,
          }}
          eventHandlers={{ click: () => onSelectConcession(c.id) }}
        />
      ))}

      {hotspots.map((h) => (
        <CircleMarker
          key={h.id}
          center={[h.lat, h.lng]}
          radius={h.incidentId ? 12 : 7}
          // Tak terlihat: api digambar FlameLayer. Lingkaran ini hanya target klik untuk popup.
          pathOptions={{ stroke: false, fillColor: "#000", fillOpacity: 0 }}
        >
          <Popup>
            <strong>{formatWib(h.observedAt, LOCALE[lang])}</strong>
            <br />
            {t.confidence}: {t.confidenceLevels[h.confidence] ?? h.confidence} · FRP {h.frp} MW
            <br />
            {h.concessionId ? t.insidePermit(h.concessionId) : t.outsidePermit}
            {h.incidentId ? (
              <>
                <br />
                {t.incidentTitle(h.incidentId)}: {t.status[statusById.get(h.incidentId) ?? 0]}
              </>
            ) : null}
            <br />
            {t.batchTitle(h.batchId)}
          </Popup>
        </CircleMarker>
      ))}

      <FlameLayer points={flames} flare={flare} />
      <FocusController concessions={concessions} focusId={focusId} />
    </MapContainer>
  );
}
