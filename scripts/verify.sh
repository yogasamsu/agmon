#!/usr/bin/env bash
# Verifikasi FireBond di MonadVision, Socialscan, dan Monadscan sekaligus lewat API verifikasi Monad.
# Pakai dari root repo:
#   FIREBOND_ADDRESS=0x... RESTORATION_FUND=0x... scripts/verify.sh
#   CHAIN_ID=143 FIREBOND_ADDRESS=0x... RESTORATION_FUND=0x... scripts/verify.sh   # mainnet
# Tidak butuh kunci privat.
set -euo pipefail

: "${FIREBOND_ADDRESS:?isi FIREBOND_ADDRESS}"
: "${RESTORATION_FUND:?isi RESTORATION_FUND (argumen constructor)}"
CHAIN_ID="${CHAIN_ID:-10143}"

cd "$(dirname "$0")/../contracts"
forge build --silent

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

forge verify-contract "$FIREBOND_ADDRESS" src/FireBond.sol:FireBond \
  --chain "$CHAIN_ID" --show-standard-json-input > "$tmp/standard-input.json"
jq '.metadata' out/FireBond.sol/FireBond.json > "$tmp/metadata.json"

compiler="v$(jq -r '.metadata.compiler.version' out/FireBond.sol/FireBond.json)"
args="$(cast abi-encode 'constructor(address)' "$RESTORATION_FUND")"

jq -n \
  --argjson chainId "$CHAIN_ID" \
  --arg contractAddress "$FIREBOND_ADDRESS" \
  --arg compilerVersion "$compiler" \
  --arg constructorArgs "${args#0x}" \
  --slurpfile standardJsonInput "$tmp/standard-input.json" \
  --slurpfile foundryMetadata "$tmp/metadata.json" \
  '{chainId: $chainId, contractAddress: $contractAddress, contractName: "src/FireBond.sol:FireBond",
    compilerVersion: $compilerVersion, standardJsonInput: $standardJsonInput[0],
    foundryMetadata: $foundryMetadata[0], constructorArgs: $constructorArgs}' > "$tmp/verify.json"

curl -sS -X POST https://agents.devnads.com/v1/verify \
  -H "Content-Type: application/json" \
  -d @"$tmp/verify.json"
echo
