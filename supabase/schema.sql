-- Skema AgMon untuk Supabase (Cloud atau self-hosted).
-- Jalankan sekali lewat SQL Editor di dashboard Supabase, atau psql. Aman dijalankan ulang.
-- ID konsesi, batch, dan insiden sama dengan ID on-chain di FireBond.sol.

create table if not exists concessions (
  id            bigint primary key,            -- = concessionId on-chain
  name          text not null,
  owner         text not null,                 -- alamat dompet pemilik
  geojson       jsonb not null,                -- Feature GeoJSON batas konsesi
  cells         text[] not null,               -- sel H3 resolusi 7 (hex)
  register_tx   text,
  created_at    timestamptz not null default now()
);

create table if not exists batches (
  id            bigint primary key,            -- = batchId on-chain
  data_hash     text not null,                 -- keccak256 dari baris kanonik
  count         int not null,
  from_unix     bigint not null,
  to_unix       bigint not null,
  source        text not null,                 -- mis. VIIRS_SNPP_NRT atau file:demo-hotspots.csv
  anchor_tx     text,
  created_at    timestamptz not null default now()
);

create table if not exists hotspots (
  id                bigserial primary key,
  batch_id          bigint not null references batches(id),
  observed_at_unix  bigint not null,
  lat               double precision not null,
  lng               double precision not null,
  confidence        smallint not null,         -- 0 rendah, 1 nominal, 2 tinggi
  frp               double precision not null, -- fire radiative power (MW)
  cell              text not null,             -- sel H3 resolusi 7 (hex)
  concession_id     bigint references concessions(id),
  incident_id       bigint,
  unique (observed_at_unix, lat, lng)
);
create index if not exists hotspots_batch_idx on hotspots(batch_id);
create index if not exists hotspots_time_idx on hotspots(observed_at_unix desc);

create table if not exists incidents (
  id                bigint primary key,        -- = incidentId on-chain
  concession_id     bigint not null references concessions(id),
  hotspot_id        bigint references hotspots(id),
  cell              text not null,
  observed_at_unix  bigint not null,
  report_tx         text,
  created_at        timestamptz not null default now()
);

-- Web hanya membaca (anon key). Oracle menulis dengan service_role key.
alter table concessions enable row level security;
alter table batches     enable row level security;
alter table hotspots    enable row level security;
alter table incidents   enable row level security;

drop policy if exists "baca publik" on concessions;
drop policy if exists "baca publik" on batches;
drop policy if exists "baca publik" on hotspots;
drop policy if exists "baca publik" on incidents;
create policy "baca publik" on concessions for select using (true);
create policy "baca publik" on batches     for select using (true);
create policy "baca publik" on hotspots    for select using (true);
create policy "baca publik" on incidents   for select using (true);

-- Proyek Supabase baru tidak selalu membuka tabel ke Data API secara otomatis.
grant usage on schema public to anon, service_role;
grant select on concessions, batches, hotspots, incidents to anon;
grant all on concessions, batches, hotspots, incidents to service_role;
grant usage, select on sequence hotspots_id_seq to service_role;
