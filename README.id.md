<p align="center"><img src="web/public/agmon-logo.png" alt="AgMon" width="260"></p>

# AgMon · Agni Monad

[English](README.md) · **Bahasa Indonesia**

Setiap titik api satelit terikat ke pemegang izin pemilik lahannya, tercatat di Monad, dan jaminan kebakarannya dicairkan ke dana restorasi begitu petugas lapangan mengonfirmasi. Dibangun dalam sehari di Monad Blitz Jogja, 24 Oktober 2026.

| | |
| --- | --- |
| Aplikasi live | https://agmon.site (dasbor live: https://agmon.site/dashboard) |
| Kontrak FireBond (Monad testnet, chain 10143) | [`0x9678b78624706d383b606412A37289879cE8bC8A`](https://testnet.monadvision.com/address/0x9678b78624706d383b606412A37289879cE8bC8A) · kode sumber terverifikasi di MonadVision dan Monadscan |
| Waktu deploy | 24 Okt 2026, 11.48 WIB, selama Monad Blitz Jogja · [tx deploy](https://testnet.monadvision.com/tx/0x547a2fde1441eaa867871aa9b03b0de5d11fe11b9bb774c8375e50a8e4fc736c) |
| Video demo | **TBD** |
| Cakupan | Titik api seluruh Indonesia · izin pilot di Kalimantan Barat |

> Izin di `data/` fiktif dan titik apinya sintetis, dibuat supaya alur demo pasti terpicu. Data titik api asli ditarik langsung dari NASA FIRMS.

## Scorecard Monad Blitz

Bukti untuk setiap kriteria penilaian. Angka per 24 Okt 2026, 16.20 WIB.

| Kriteria | Poin | Bukti |
| --- | --- | --- |
| Basic · Repo GitHub publik | 25 | Repo ini |
| Basic · README memuat halaman live dan alamat kontrak | 25 | Tabel di atas |
| Basic · Kontrak di-deploy di Monad testnet selama Blitz | 25 | FireBond di-deploy 24 Okt 2026, 11.48.10 WIB · [tx deploy](https://testnet.monadvision.com/tx/0x547a2fde1441eaa867871aa9b03b0de5d11fe11b9bb774c8375e50a8e4fc736c) |
| Basic · Proyek di-host publik | 25 | https://agmon.site |
| Advance · Semua fungsi yang diumumkan berjalan | 25 | Registri izin, jaminan kebakaran, oracle NASA FIRMS (7 batch tercatat, 29.985 titik api tersimpan, 12 insiden dilaporkan), konfirmasi dan tolak, potongan 20% ke dana restorasi, cek integritas, ringkasan nasional |
| Advance · Transaksi live saat demo | 25 | `confirmFire` dari MetaMask verifikator, 12.46.48 WIB: [tx](https://testnet.monadvision.com/tx/0xabd47c078d9ff6bfea190eb8ac6d5a2394f1592d042492d95f860c1a0a7d6894). Satu lagi dikirim langsung di panggung. |
| Advance · Kontrak terverifikasi | 25 | [MonadVision](https://testnet.monadvision.com/address/0x9678b78624706d383b606412A37289879cE8bC8A) (perfect match) dan [Monadscan](https://testnet.monadscan.com/address/0x9678b78624706d383b606412A37289879cE8bC8A) |
| Advance · Bisa dijalankan orang lain dari README | 25 | Jalur A: web saja, sekitar 3 menit, kunci publik hanya-baca. Jalur B: semua komponen. |
| Advance · Posting X atau LinkedIn dengan tag @monad @monad_dev @geeky_kartikey | 25 | X: _tautan menyusul_ · LinkedIn: _tautan menyusul_ |
| Advance · Video demo, minimal 30 detik | 25 | _tautan menyusul_ |
| Advance · Video iklan kreatif | 25 | Video cerita AgMon 55 detik: _tautan menyusul_ |
| Advance · 5.000+ tayangan gabungan | 25 | _jumlah menyusul_ |
| Bonus · Kontrak di Monad mainnet | 25 | Belum; hanya testnet |
| Bonus · Halaman publik di domain sendiri | 15 | https://agmon.site |
| Bonus · Product-market fit, pendapatan, inovasi | s.d. 60 | Pemerintah sebagai pelanggan yang membayar, Rp0,5–1,5 miliar per provinsi per tahun plus biaya per hektare (lihat bagian *Model bisnis* di agmon.site); deteksi satelit plus verifikasi lapangan yang memicu pencairan jaminan otomatis di Monad |

## Masalah

Pemerintah sudah bisa melihat titik api lewat SiPongi dan NASA FIRMS. Yang belum ada adalah rantai cepat dari *titik api* ke *pemegang izin yang bertanggung jawab* ke *konsekuensi finansial*. Saat ini rantai itu bergantung pada proses hukum yang bisa memakan waktu bertahun-tahun, dan datanya sendiri bisa dibantah. Pada 2019, kebakaran menghanguskan sekitar 1,6 juta hektare.

## Cara kerja

1. Regulator (Kementerian Kehutanan) mendaftarkan batas setiap izin sebagai daftar sel heksagonal H3 resolusi 7, sekitar 5 km² per sel. Satu sel hanya boleh dimiliki satu izin, jadi izin yang tumpang tindih langsung ditolak kontrak.
2. Pemegang izin menyetor jaminan kebakaran sebagai syarat izin. Polanya sama dengan jaminan reklamasi tambang.
3. Setiap 30 menit oracle menarik titik api VIIRS dari NASA FIRMS untuk seluruh Indonesia, menghitung hash keccak256 batch-nya, mencatat hash itu di Monad (`anchorBatch`), lalu menyimpan data lengkapnya di Supabase.
4. Titik api dengan confidence nominal atau tinggi yang jatuh di sel terdaftar membuka insiden berstatus **Diduga** di chain (`reportHotspot`). Sel yang sama tidak dilaporkan lagi dalam 24 jam.
5. Petugas Manggala Agni memeriksa lokasi, lalu menekan **Konfirmasi** atau **Tolak** di aplikasi web. Yang dicatat di chain hanya sidik jari foto lapangan.
6. **Konfirmasi** mengirim 20% jaminan ke dana restorasi (BPDLH di skenario produksi) dalam transaksi yang sama. Selama masih ada insiden terbuka, pemegang izin tidak bisa menarik jaminannya.
7. Siapa pun bisa menekan **Cek integritas**: browser menghitung ulang hash dari baris database lalu membandingkannya dengan hash di Monad. Ubah satu angka di database, hasilnya langsung Tidak cocok.

Uang baru bergerak setelah manusia memverifikasi di lapangan. Satelit bisa salah membaca atap seng yang panas atau suar gas sebagai api. Karena itu satelit berperan sebagai pendeteksi, dan petugaslah yang memvalidasi.

### Kenapa Monad

Dua tugas AgMon butuh chain yang cepat sekaligus sanggup menampung banyak transaksi:

1. **Ingesti nasional saat puncak musim kemarau.** Ribuan titik api satelit dari seluruh Indonesia masuk setiap hari, ditambah keputusan verifikator lapangan. Setiap laporan adalah satu transaksi sekitar 190 ribu gas. Kapasitas 10.000 TPS Monad membuatnya tidak mengantre.
2. **Pembekuan instan.** Begitu oracle melaporkan titik api di dalam izin, `openIncidents > 0` dan `withdrawBond` langsung terblokir. Dengan finalitas 0,6 detik, pemegang izin tidak bisa menarik jaminan saat lahannya mulai terbakar.

Finalitas yang sama terlihat langsung saat demo: begitu petugas menekan Konfirmasi, jaminan di layar turun dan dana restorasi naik dalam satu transaksi. Oracle memakai `eth_sendRawTransactionSync`, jadi receipt kembali di panggilan yang sama.

**Di mana uangnya.** Demo memakai MON testnet; 10 MON adalah unit representasi karena faucet hanya memberi sedikit MON (harga 1 MON mainnet saat ini sekitar Rp400). Di produksi, jaminan tetap on-chain di kontrak FireBond sebagai escrow tertokenisasi: stablecoin Rupiah seperti IDRX, atau bank garansi tertokenisasi dari bank BUMN, dengan BPDLH sebagai penerima. `confirmFire` lalu memindahkan 20% ke dana restorasi secara atomik dalam satu transaksi, tanpa menunggu kliring manual berminggu-minggu.

### Arsitektur

```
NASA FIRMS ──> oracle (Node, viem, h3-js, cron 30 menit)
                 ├─ anchorBatch / reportHotspot ──> FireBond di Monad   (sumber kebenaran: insiden, jaminan, hash)
                 └─ data mentah ──────────────────> Supabase Postgres   (indeks + data mentah, publik hanya bisa membaca)
web (Next.js di Vercel) ── membaca keduanya; verifikator menandatangani confirmFire / rejectFire lewat dompet browser
```

Web punya dua halaman: `/` menjelaskan masalah, solusi, alasan memilih Monad, dan siapa yang diuntungkan; `/dashboard` berisi peta live, daftar insiden, tombol Konfirmasi dan Tolak untuk verifikator, serta cek integritas.

| Komponen | Teknologi | Folder |
| --- | --- | --- |
| Kontrak | Solidity ^0.8.24 (dikompilasi dengan solc 0.8.28), Foundry, 18 tes | `contracts/` |
| Oracle | Node.js, viem, h3-js | `oracle/` |
| Database | Supabase (Postgres + row level security) | `supabase/schema.sql` |
| Web | Next.js, Leaflet, viem | `web/` |

**Menjaga chain dan database tetap sama.** Chain adalah sumber kebenaran; Supabase adalah indeks turunan plus penyimpan data mentah. Oracle selalu menulis ke chain lebih dulu, jadi satu-satunya celah yang mungkin terjadi adalah "sudah di chain, belum di database". Dua mekanisme menutupnya:

- Sebelum `anchorBatch`, data mentah ditulis ke `oracle/spool/<hash>.json`. File itu baru dihapus setelah semua baris masuk Supabase.
- Di awal setiap putaran oracle, `reconcile` membandingkan `batchCount` dan `incidentCount` di chain dengan isi database, memutar ulang batch dari spool, dan membangun ulang baris insiden yang hilang dari state kontrak. Bisa juga dijalankan manual: `npm run reconcile`.

Web membaca status insiden, saldo jaminan, dan jumlah batch dari chain di setiap permintaan. Keputusan verifikator langsung tampil di layarnya sendiri sambil menunggu penyegaran berikutnya.

## Menjalankan sendiri

### Jalur A: web saja, memakai data testnet live (sekitar 3 menit)

Butuh Node.js 20 atau lebih baru.

```bash
git clone https://github.com/yogasamsu/agmon
cd agmon/web
npm install
cp .env.example .env.local
```

Isi `.env.local` dengan nilai publik yang hanya bisa membaca di bawah ini, lalu jalankan `npm run dev` dan buka http://localhost:3000.

```
SUPABASE_URL=https://nvnqjhfnhkktgrawecyq.supabase.co
SUPABASE_ANON_KEY=<lihat bagian "Kunci publik hanya-baca" di bawah>
NEXT_PUBLIC_FIREBOND_ADDRESS=0x9678b78624706d383b606412A37289879cE8bC8A
```

Anon key hanya bisa membaca. Row level security menolak semua penulisan (diuji 24 Okt 2026). Tekan **Cek integritas** pada batch mana pun untuk memeriksa datanya sendiri.

### Jalur B: semua komponen dengan kontrak sendiri (sekitar 15 menit)

Alat: Node.js 20+, [Foundry](https://getfoundry.sh) (`curl -L https://foundry.paradigm.xyz | bash && foundryup`), dan proyek [Supabase](https://supabase.com) gratis.

**1. Dompet.** Buat dompet burner khusus testnet. Jangan pakai dompet yang berisi aset sungguhan, dan jangan pernah menempel kunci privat ke agen AI.

```bash
cast wallet import deployer --interactive   # kunci deployer, tersimpan terenkripsi di keystore Foundry
cast wallet new                              # jalankan 4 kali: oracle, pemegang izin, verifikator, dana restorasi
```

Isi saldo deployer di https://faucet.monad.xyz.

**2. Database.** Di dashboard Supabase, buka SQL Editor lalu jalankan isi `supabase/schema.sql`.

**3. Kontrak.**

```bash
cd contracts
forge test
RESTORATION_FUND=0x... ORACLE_ADDRESS=0x... VERIFIER_ADDRESS=0x... \
forge script script/Deploy.s.sol --account deployer \
  --rpc-url https://testnet-rpc.monad.xyz --broadcast
```

Catat alamat yang tercetak setelah `FireBond:`. Kirim MON untuk gas dari deployer ke dompet peran:

```bash
cast send --account deployer --rpc-url https://testnet-rpc.monad.xyz <ALAMAT_ORACLE> --value 0.5ether
cast send --account deployer --rpc-url https://testnet-rpc.monad.xyz <ALAMAT_VERIFIKATOR> --value 0.1ether
cast send --account deployer --rpc-url https://testnet-rpc.monad.xyz <ALAMAT_PEMEGANG_IZIN> --value 10.2ether
```

Pemegang izin butuh saldo sebesar jaminan (bawaan 10 MON, diatur lewat `BOND_MON` di `oracle/.env`) ditambah gas. Kalau saldo dari faucet kurang, turunkan `BOND_MON`.

**4. Verifikasi kontrak** di MonadVision, Socialscan, dan Monadscan sekaligus:

```bash
FIREBOND_ADDRESS=0x... RESTORATION_FUND=0x... scripts/verify.sh
```

**5. Oracle.**

```bash
cd oracle
npm install
cp .env.example .env    # FIREBOND_ADDRESS, ORACLE_PRIVATE_KEY, OWNER_PRIVATE_KEY, URL + service role key Supabase, FIRMS_MAP_KEY
npm run seed -- ../data/demo-concession.geojson    # daftarkan izin demo dan setor jaminan
npm run oracle -- --file ../data/demo-hotspots.csv # titik api sintetis: membuka 3 insiden Diduga
npm run oracle                                     # titik api asli dari NASA FIRMS
```

MAP_KEY FIRMS gratis di https://firms.modaps.eosdis.nasa.gov/api/map_key/. Untuk menjalankan tiap 30 menit, tambahkan ke `crontab -e`:

```
*/30 * * * * cd /path/ke/agmon/oracle && npm run -s oracle >> oracle.log 2>&1
```

**6. Web.** Salin `web/.env.example` ke `web/.env.local`, isi URL Supabase, **anon** key (jangan pernah service role key), dan alamat kontrak, lalu `npm run dev`. Di Vercel, atur root proyek ke `web` dan isi variabel yang sama.

Setiap kali `FireBond.sol` diubah, jalankan `forge build` lalu `node scripts/export-abi.mjs` dari root repo.

## Naskah demo

1. Buka aplikasi live di `/dashboard`. Peta menampilkan izin di Ketapang, Kalimantan Barat, beserta titik apinya. Api di tepi bawah layar ikut naik sesuai jumlah insiden Diduga.
2. Sambungkan MetaMask berisi dompet verifikator, lampirkan foto bila ada, lalu tekan **Konfirmasi kebakaran**. Jaminan turun 20%, misalnya dari 20 ke 16 MON (tampil Rp10 miliar menjadi Rp8 miliar pada skala demo), dana restorasi naik sebesar potongan itu, api menyala sesaat, dan bekas gosong di bawah layar menebal.
3. Buka transaksinya di explorer.
4. Tekan **Cek integritas** pada batch: hasilnya **Cocok**. Ubah satu nilai `frp` di table editor Supabase, lalu cek lagi: **Tidak cocok**.

Kontrak hanya menerima satu insiden per sel dalam 24 jam, jadi data demo hanya bisa dipakai sekali per kontrak. Untuk mengulang dari awal, deploy kontrak baru dan kosongkan tabel.

Untuk merekam video iklan tanpa mengubah data, tambahkan `?fire=<diduga>,<terkonfirmasi>` di URL, misalnya `?fire=6,2`. Parameter ini hanya mengubah efek api.

## Sumber data

- **Titik api:** NASA FIRMS, VIIRS 375 m hampir waktu nyata dari satelit Suomi NPP, NOAA-20, dan NOAA-21, ditarik untuk seluruh Indonesia (https://firms.modaps.eosdis.nasa.gov/). *We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS), part of NASA's Earth Science Data and Information System (ESDIS).*
- **Estimasi kerugian ekonomi per titik api** (indikatif, batas atas, belum termasuk eksternalitas): satu titik api VIIRS sekitar 14 ha (piksel 375 m) × US$5.520/ha × kurs Rp16.000/US$ (diatur lewat `NEXT_PUBLIC_IDR_PER_USD`), sekitar Rp1,2 miliar. Angka US$5.520/ha berasal dari estimasi Bank Dunia sekitar US$5,2 miliar kerugian akibat kebakaran 2019 (Indonesia Economic Quarterly, Des 2019; belum memasukkan dampak kesehatan dan pendidikan jangka panjang) dibagi sekitar 942.000 ha terbakar. Total nasional menghitung sekali titik api yang berjarak sekitar 400 m pada hari yang sama, karena satu api sering terlihat beberapa satelit.
- **Batas provinsi:** Peta Dasar BAKOSURTANAL, 34 provinsi, sebelum pemekaran Papua 2022 (lewat github.com/ans-4175/peta-indonesia-geojson).
- **Peta dasar:** Esri World Imagery.

## Batasan yang disengaja

- Satu oracle terpusat. Rencana produksi: beberapa oracle independen dan masa sanggah untuk pemegang izin.
- Jaminan demo berupa MON testnet. Di produksi, jaminan disimpan on-chain sebagai stablecoin Rupiah atau bank garansi yang ditokenisasi (lihat Kenapa Monad).
- Setiap kebakaran terkonfirmasi memotong 20% dari *sisa* jaminan (20 → 16 → 12,8 MON). Di produksi (P1), potongan tetap 20% dari kewajiban jaminan awal (*initial required bond*), dan pemegang izin wajib top-up dalam tenggat waktu tertentu.
- Yang masuk ke chain publik hanya hash, nomor sel H3, waktu, dan keputusan. Data mentah dan peta izin tetap di server pemerintah.
- Di demo ini `registerConcession` bisa dipanggil dompet mana pun, dan deployer berperan sebagai regulator. Di produksi (P1), fungsi ini dikunci dengan modifier `onlyRegulator`, jadi hanya dompet Kemenhut yang bisa mendaftarkan izin atas nama pemegangnya.

## Kunci publik hanya-baca

Khusus Jalur A. Hanya bisa membaca karena dibatasi row level security.

```
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52bnFqaGZuaGtrdGdyYXdlY3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDgzODksImV4cCI6MjEwODM4NDM4OX0._YWW2t1nO1cwRI0Fsg6Knu_N82w83VUNPH-7KknAQUc
```

## Lisensi

MIT
