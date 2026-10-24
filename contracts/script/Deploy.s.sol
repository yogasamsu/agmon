// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {FireBond} from "../src/FireBond.sol";

/// @notice Deploy FireBond lalu daftarkan dompet oracle dan verifikator.
/// Penanda tangan diambil dari keystore Foundry (`--account deployer`), jadi kunci privat
/// tidak pernah ditulis ke file atau variabel lingkungan.
/// Variabel lingkungan: RESTORATION_FUND, ORACLE_ADDRESS, VERIFIER_ADDRESS.
contract Deploy is Script {
    function run() external returns (FireBond fb) {
        address fund = vm.envAddress("RESTORATION_FUND");
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        address verifier = vm.envAddress("VERIFIER_ADDRESS");

        vm.startBroadcast();
        fb = new FireBond(fund);
        fb.setOracle(oracle, true);
        fb.setVerifier(verifier, true);
        vm.stopBroadcast();

        console.log("FireBond:", address(fb));
    }
}
