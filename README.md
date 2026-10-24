<p align="center"><img src="web/public/agmon-logo.png" alt="AgMon" width="260"></p>

# AgMon · Agni Monad

**English** · [Bahasa Indonesia](README.id.md)

Every satellite fire hotspot tied to the permit holder whose land it falls on, recorded on Monad, with a fire bond released to a restoration fund once a field officer confirms the fire. Built in one day at Monad Blitz Jogja, 24 October 2026.

| | |
| --- | --- |
| Live app | https://agmon.site (live dashboard: https://agmon.site/dashboard) |
| FireBond contract (Monad testnet, chain 10143) | [`0x9678b78624706d383b606412A37289879cE8bC8A`](https://testnet.monadvision.com/address/0x9678b78624706d383b606412A37289879cE8bC8A) · source verified on MonadVision and Monadscan |
| Deployed | 24 Oct 2026, 11:48 WIB, during Monad Blitz Jogja · [deploy tx](https://testnet.monadvision.com/tx/0x547a2fde1441eaa867871aa9b03b0de5d11fe11b9bb774c8375e50a8e4fc736c) |
| Demo video | **TBD** |
| Coverage | Hotspots across all of Indonesia · pilot permit in West Kalimantan |

> The permit in `data/` is fictional and the hotspots are synthetic, made so the demo always triggers. Live hotspots come straight from NASA FIRMS.

## The problem

Indonesia can already see its forest fires: the government's SiPongi system and NASA FIRMS show every hotspot. What is missing is a fast chain from *hotspot* to *the permit holder responsible* to *a financial consequence*. Today that chain runs through court cases that take years, and the data itself gets disputed. In 2019 fires burned about 1.6 million hectares.

## How it works

1. The regulator (Ministry of Forestry) registers each permit boundary as a list of H3 hexagonal cells (resolution 7, about 5 km² each). A cell can belong to only one permit, so overlapping permits are rejected on chain.
2. The permit holder deposits a fire bond as a condition of the permit, the same pattern as Indonesia's mine reclamation bonds.
3. Every 30 minutes the oracle pulls VIIRS hotspots from NASA FIRMS for all of Indonesia, hashes the batch with keccak256, anchors the hash on Monad (`anchorBatch`), and stores the raw rows in Supabase.
4. A hotspot with nominal or high confidence that lands in a registered cell opens a **Suspected** incident on chain (`reportHotspot`). The same cell is not reported twice within 24 hours.
5. A Manggala Agni officer (the forestry fire brigade) checks the site and presses **Confirm** or **Reject** in the web app. Only the fingerprint of the field photo goes on chain.
6. **Confirm** sends 20% of the bond to the restoration fund (BPDLH in production) inside the same transaction. While any incident is open, the holder cannot withdraw the bond.
7. Anyone can press **Check integrity**: the browser re-hashes the database rows and compares them with the hash on Monad. Change one number in the database and the check fails.

Money moves only after a human verifies in the field. Satellites mistake hot tin roofs and gas flares for fires, so the satellite is the detector and the officer is the validator.

### Why Monad

Two jobs in AgMon need a chain that is both fast and high-throughput:

1. **National ingestion at the peak of the dry season.** Thousands of satellite hotspots across Indonesia arrive every day, plus field decisions from verifiers. Each report is one transaction of about 190k gas. Monad's 10,000 TPS keeps that from queuing.
2. **Instant freeze.** The moment the oracle reports a hotspot inside a permit, `openIncidents > 0` and `withdrawBond` is blocked. With 0.6 s finality the holder cannot pull the bond out while the land starts to burn.

The same finality is what the room sees in the demo: when the officer presses Confirm, the bond on screen drops and the restoration fund rises in the same transaction. The oracle uses `eth_sendRawTransactionSync`, so it gets the receipt in the same call.

**Where the money lives.** The demo uses native testnet MON; 10 MON is a representation unit because the faucet only hands out small amounts (1 MON on mainnet is around Rp400 at the time of writing). In production the bond stays on chain in the FireBond contract, as a tokenized escrow: a Rupiah stablecoin such as IDRX, or a tokenized bank guarantee from a state-owned bank, with BPDLH as the recipient. `confirmFire` then moves 20% to restoration atomically in one transaction, instead of waiting weeks for manual clearing.

### Architecture

```
NASA FIRMS ──> oracle (Node, viem, h3-js, cron 30 min)
                 ├─ anchorBatch / reportHotspot ──> FireBond on Monad   (source of truth: incidents, bonds, hashes)
                 └─ raw rows ─────────────────────> Supabase Postgres   (index + raw data, read-only to the public via RLS)
web (Next.js on Vercel) ── reads both; verifier signs confirmFire / rejectFire with a browser wallet
```

The web app has two pages: `/` explains the problem, the solution, why Monad, and who benefits; `/dashboard` is the live map with incidents, the verifier's Confirm and Reject buttons, and the integrity check.

| Component | Stack | Folder |
| --- | --- | --- |
| Contract | Solidity ^0.8.24 (compiled with solc 0.8.28), Foundry, 18 tests | `contracts/` |
| Oracle | Node.js, viem, h3-js | `oracle/` |
| Database | Supabase (Postgres + row level security) | `supabase/schema.sql` |
| Web | Next.js, Leaflet, viem | `web/` |

**Keeping chain and database consistent.** The chain is the source of truth; Supabase is a derived index plus the raw data. The oracle always writes to the chain first, so the only possible gap is "on chain, missing from the database". Two mechanisms close it:

- Before `anchorBatch`, the raw rows are written to `oracle/spool/<hash>.json`. The file is deleted only after every row is in Supabase.
- At the start of every oracle run, `reconcile` compares `batchCount` and `incidentCount` on chain with the database, replays any spooled batch, and rebuilds missing incident rows from contract state. You can also run it by hand: `npm run reconcile`.

The web reads incident status, bonds, and batch count from the chain on every request, and shows a verifier's own decision immediately while the next refresh catches up.

## Run it yourself

### Path A: web only, against the live testnet data (about 3 minutes)

Needs Node.js 20 or newer.

```bash
git clone https://github.com/yogasamsu/agmon
cd agmon/web
npm install
cp .env.example .env.local
```

Fill `.env.local` with the public, read-only values below, then `npm run dev` and open http://localhost:3000.

```
SUPABASE_URL=https://nvnqjhfnhkktgrawecyq.supabase.co
SUPABASE_ANON_KEY=<see "Public read-only key" below>
NEXT_PUBLIC_FIREBOND_ADDRESS=<contract address from the table above>
```

The anon key can only read. Row level security rejects every write (verified on 24 Oct 2026). Press **Check integrity** on any batch to verify the data yourself.

### Path B: the full stack on your own contract (about 15 minutes)

Tools: Node.js 20+, [Foundry](https://getfoundry.sh) (`curl -L https://foundry.paradigm.xyz | bash && foundryup`), a free [Supabase](https://supabase.com) project.

**1. Wallets.** Make burner wallets for testnet only. Never use a wallet that holds real assets, and never paste a private key into an AI agent.

```bash
cast wallet import deployer --interactive   # deployer key, stored encrypted in a Foundry keystore
cast wallet new                              # run 4 times: oracle, permit holder, verifier, restoration fund
```

Fund the deployer at https://faucet.monad.xyz.

**2. Database.** In the Supabase dashboard open SQL Editor and run `supabase/schema.sql`.

**3. Contract.**

```bash
cd contracts
forge test
RESTORATION_FUND=0x... ORACLE_ADDRESS=0x... VERIFIER_ADDRESS=0x... \
forge script script/Deploy.s.sol --account deployer \
  --rpc-url https://testnet-rpc.monad.xyz --broadcast
```

Note the address printed after `FireBond:`. Send gas money to the role wallets from the deployer:

```bash
cast send --account deployer --rpc-url https://testnet-rpc.monad.xyz <ORACLE_ADDRESS> --value 0.5ether
cast send --account deployer --rpc-url https://testnet-rpc.monad.xyz <VERIFIER_ADDRESS> --value 0.1ether
cast send --account deployer --rpc-url https://testnet-rpc.monad.xyz <OWNER_ADDRESS> --value 10.2ether
```

The permit holder needs the bond (10 MON by default, `BOND_MON` in `oracle/.env`) plus gas. If the faucet gave you less, lower `BOND_MON`.

**4. Verify the contract** on MonadVision, Socialscan, and Monadscan with one call:

```bash
FIREBOND_ADDRESS=0x... RESTORATION_FUND=0x... scripts/verify.sh
```

**5. Oracle.**

```bash
cd oracle
npm install
cp .env.example .env    # FIREBOND_ADDRESS, ORACLE_PRIVATE_KEY, OWNER_PRIVATE_KEY, Supabase URL + service role key, FIRMS_MAP_KEY
npm run seed -- ../data/demo-concession.geojson    # register the demo permit and deposit the bond
npm run oracle -- --file ../data/demo-hotspots.csv # synthetic hotspots: opens 3 Suspected incidents
npm run oracle                                     # live hotspots from NASA FIRMS
```

A free FIRMS MAP_KEY: https://firms.modaps.eosdis.nasa.gov/api/map_key/. To run every 30 minutes, add to `crontab -e`:

```
*/30 * * * * cd /path/to/agmon/oracle && npm run -s oracle >> oracle.log 2>&1
```

**6. Web.** Copy `web/.env.example` to `web/.env.local`, fill it with your Supabase URL, the **anon** key (never the service role key), and the contract address, then `npm run dev`. On Vercel, set the project root to `web` and add the same variables.

Each time `FireBond.sol` changes, run `forge build` and then `node scripts/export-abi.mjs` from the repo root.

## Demo script

1. Open the live app at `/dashboard`. The map shows the permit in Ketapang, West Kalimantan, and the hotspots. The fire along the bottom of the screen rises with the number of Suspected incidents.
2. Connect MetaMask with the verifier wallet, optionally attach a photo, and press **Confirm fire**. The bond drops from 2 to 1.6 MON (shown as IDR 1 billion to IDR 800 million at demo scale), the restoration fund rises by 0.4 MON, the fire flares, and the scorch at the bottom of the screen thickens.
3. Open the transaction in the explorer.
4. Press **Check integrity** on the batch: **Match**. Change one `frp` value in the Supabase table editor and check again: **Mismatch**.

The contract accepts one incident per cell per 24 hours, so the demo data works once per contract. To replay from scratch, deploy a new contract and empty the tables.

To record the ad video without touching data, append `?fire=<suspected>,<confirmed>` to the URL, for example `?fire=6,2`. It changes only the fire effect.

## Deliberate limits

- One centralised oracle. Production plan: several independent oracles and an objection period for the permit holder.
- The demo bond is native testnet MON. Production holds it on chain as a Rupiah stablecoin or a tokenized bank guarantee (see Why Monad).
- Each confirmed fire slashes 20% of the *remaining* bond (2 → 1.6 → 1.28 MON). In production (P1) the slash is a fixed 20% of the initial required bond, and the holder must top up (replenish) within a set deadline.
- Only hashes, H3 cell ids, timestamps, and decisions go on the public chain. Raw data and permit maps stay on government servers.
- `registerConcession` is open to any wallet in this demo, and the deployer plays the regulator. In production (P1) it is locked with an `onlyRegulator` modifier, so only the Ministry of Forestry wallet can register a permit on the holder's behalf.

## Public read-only key

For Path A only. Read-only by row level security.

```
SUPABASE_ANON_KEY=TBD
```

## License

MIT
