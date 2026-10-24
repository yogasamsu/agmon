// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FireBond} from "../src/FireBond.sol";

contract FireBondTest is Test {
    FireBond internal fb;

    address internal admin = makeAddr("admin");
    address internal fund = makeAddr("danaRestorasi");
    address internal owner = makeAddr("ptContohSawit");
    address internal oracle = makeAddr("oracle");
    address internal verifier = makeAddr("verifikator");
    address internal stranger = makeAddr("orangLain");

    uint64 internal constant CELL_A = 0x872a1072bffffff;
    uint64 internal constant CELL_B = 0x872a10729ffffff;
    uint64 internal constant CELL_OUTSIDE = 0x872a1070bffffff;
    uint64 internal constant T0 = 1_568_505_600; // 15 Sep 2019 00:00 UTC

    uint256 internal concessionId;
    uint256 internal batchId;

    function setUp() public {
        vm.startPrank(admin);
        fb = new FireBond(fund);
        fb.setOracle(oracle, true);
        fb.setVerifier(verifier, true);
        vm.stopPrank();

        uint64[] memory cells = new uint64[](2);
        cells[0] = CELL_A;
        cells[1] = CELL_B;

        vm.deal(owner, 100 ether);
        vm.startPrank(owner);
        concessionId = fb.registerConcession("PT Contoh Sawit (fiktif)", cells);
        fb.depositBond{value: 10 ether}(concessionId);
        vm.stopPrank();

        vm.prank(oracle);
        batchId = fb.anchorBatch(keccak256("batch-1"), 3, T0, T0 + 1 hours);
    }

    function _report(uint64 cell, uint64 at) internal returns (uint256) {
        vm.prank(oracle);
        return fb.reportHotspot(cell, at, 2, batchId);
    }

    function _bond() internal view returns (uint256 bond) {
        (, , bond, , ) = fb.concessions(concessionId);
    }

    // --- registrasi dan jaminan ---------------------------------------------

    function test_RegisterMapsCells() public view {
        assertEq(fb.cellToConcession(CELL_A), concessionId);
        assertEq(fb.cellToConcession(CELL_B), concessionId);
        assertEq(fb.cellsOf(concessionId).length, 2);
        assertEq(_bond(), 10 ether);
    }

    function test_RegisterRejectsTakenCell() public {
        uint64[] memory cells = new uint64[](1);
        cells[0] = CELL_A;
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(FireBond.CellTaken.selector, CELL_A, concessionId));
        fb.registerConcession("PT Tumpang Tindih", cells);
    }

    function test_DepositRequiresValue() public {
        vm.prank(owner);
        vm.expectRevert(FireBond.ZeroAmount.selector);
        fb.depositBond(concessionId);
    }

    // --- oracle --------------------------------------------------------------

    function test_AnchorStoresHash() public view {
        (bytes32 dataHash, uint32 count, uint64 fromTime, uint64 toTime) = fb.batches(batchId);
        assertEq(dataHash, keccak256("batch-1"));
        assertEq(count, 3);
        assertEq(fromTime, T0);
        assertEq(toTime, T0 + 1 hours);
    }

    function test_OnlyOracleCanReport() public {
        vm.prank(stranger);
        vm.expectRevert(FireBond.NotOracle.selector);
        fb.reportHotspot(CELL_A, T0, 2, batchId);
    }

    function test_ReportInsideConcessionOpensIncident() public {
        uint256 id = _report(CELL_A, T0);
        assertEq(id, 1);
        (uint256 cid, uint64 cell, , , , FireBond.Status status, ) = fb.incidents(id);
        assertEq(cid, concessionId);
        assertEq(cell, CELL_A);
        assertEq(uint8(status), uint8(FireBond.Status.Suspected));
        (, , , , uint32 open) = fb.concessions(concessionId);
        assertEq(open, 1);
    }

    function test_ReportOutsideConcessionIsIgnored() public {
        assertEq(_report(CELL_OUTSIDE, T0), 0);
        assertEq(fb.incidentCount(), 0);
    }

    function test_ReportLowConfidenceReverts() public {
        vm.prank(oracle);
        vm.expectRevert(FireBond.LowConfidence.selector);
        fb.reportHotspot(CELL_A, T0, 0, batchId);
    }

    function test_ReportUnknownBatchReverts() public {
        vm.prank(oracle);
        vm.expectRevert(FireBond.UnknownBatch.selector);
        fb.reportHotspot(CELL_A, T0, 2, 99);
    }

    function test_SameCellWithin24hIsDeduplicated() public {
        _report(CELL_A, T0);
        assertEq(_report(CELL_A, T0 + 6 hours), 0);
        assertEq(_report(CELL_A, T0 + 25 hours), 2);
    }

    // --- verifikator -----------------------------------------------------------

    function test_ConfirmSlashesTwentyPercentToFund() public {
        uint256 id = _report(CELL_A, T0);
        vm.prank(verifier);
        fb.confirmFire(id, keccak256("foto-lapangan"));

        assertEq(_bond(), 8 ether);
        assertEq(fund.balance, 2 ether);
        assertEq(address(fb).balance, 8 ether);

        (, , , , , FireBond.Status status, bytes32 evidence) = fb.incidents(id);
        assertEq(uint8(status), uint8(FireBond.Status.Confirmed));
        assertEq(evidence, keccak256("foto-lapangan"));
    }

    function test_RejectKeepsBond() public {
        uint256 id = _report(CELL_A, T0);
        vm.prank(verifier);
        fb.rejectFire(id, keccak256("suar-gas"));

        assertEq(_bond(), 10 ether);
        assertEq(fund.balance, 0);
        (, , , , , FireBond.Status status, ) = fb.incidents(id);
        assertEq(uint8(status), uint8(FireBond.Status.Rejected));
    }

    function test_CannotConfirmTwice() public {
        uint256 id = _report(CELL_A, T0);
        vm.startPrank(verifier);
        fb.confirmFire(id, bytes32(0));
        vm.expectRevert(FireBond.NotSuspected.selector);
        fb.confirmFire(id, bytes32(0));
        vm.stopPrank();
    }

    function test_OnlyVerifierCanConfirm() public {
        uint256 id = _report(CELL_A, T0);
        vm.prank(oracle);
        vm.expectRevert(FireBond.NotVerifier.selector);
        fb.confirmFire(id, bytes32(0));
    }

    // --- penarikan -------------------------------------------------------------

    function test_WithdrawBlockedWhileIncidentOpen() public {
        _report(CELL_A, T0);
        vm.prank(owner);
        vm.expectRevert(FireBond.OpenIncidents.selector);
        fb.withdrawBond(concessionId, 1 ether);
    }

    function test_WithdrawAfterResolution() public {
        uint256 id = _report(CELL_A, T0);
        vm.prank(verifier);
        fb.rejectFire(id, bytes32(0));

        uint256 before = owner.balance;
        vm.prank(owner);
        fb.withdrawBond(concessionId, 4 ether);
        assertEq(owner.balance, before + 4 ether);
        assertEq(_bond(), 6 ether);
    }

    function test_OnlyOwnerCanWithdraw() public {
        vm.prank(stranger);
        vm.expectRevert(FireBond.NotConcessionOwner.selector);
        fb.withdrawBond(concessionId, 1 ether);
    }

    // --- fuzz ------------------------------------------------------------------

    function testFuzz_SlashNeverExceedsBond(uint96 deposit) public {
        vm.assume(deposit > 0);
        vm.deal(owner, uint256(deposit));
        vm.prank(owner);
        fb.depositBond{value: deposit}(concessionId);
        uint256 total = _bond();

        uint256 id = _report(CELL_B, T0);
        vm.prank(verifier);
        fb.confirmFire(id, bytes32(0));

        assertEq(_bond() + fund.balance, total);
        assertEq(fund.balance, (total * 2000) / 10_000);
    }
}
