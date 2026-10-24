// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FireBond
/// @notice Mengikat titik panas satelit ke pemegang konsesi dan memotong jaminan
///         (fire bond) bila kebakaran dikonfirmasi verifikator.
/// @dev Lokasi memakai indeks H3 resolusi 7 (uint64). Konversi koordinat ke H3
///      dilakukan di luar chain oleh oracle.
contract FireBond {
    enum Status {
        None,
        Suspected,
        Confirmed,
        Rejected
    }

    struct Concession {
        address owner;
        string name;
        uint256 bond;
        uint32 confirmedFires;
        uint32 openIncidents;
    }

    struct Incident {
        uint256 concessionId;
        uint64 cell;
        uint64 observedAt;
        uint8 confidence;
        uint256 batchId;
        Status status;
        bytes32 evidenceHash;
    }

    struct Batch {
        bytes32 dataHash;
        uint32 count;
        uint64 fromTime;
        uint64 toTime;
    }

    /// @notice Persentase jaminan yang dipotong per kebakaran terkonfirmasi (basis poin).
    uint16 public constant SLASH_BPS = 2000;
    /// @notice Jarak minimum antarinsiden di sel yang sama.
    uint64 public constant DEDUP_WINDOW = 1 days;
    /// @notice Confidence FIRMS: 0 = rendah, 1 = nominal, 2 = tinggi.
    uint8 public constant MIN_CONFIDENCE = 1;

    address public admin;
    address public immutable restorationFund;

    mapping(address => bool) public isOracle;
    mapping(address => bool) public isVerifier;

    uint256 public concessionCount;
    uint256 public incidentCount;
    uint256 public batchCount;

    mapping(uint256 => Concession) public concessions;
    mapping(uint256 => uint64[]) private _cells;
    mapping(uint64 => uint256) public cellToConcession;
    mapping(uint64 => uint64) public lastIncidentAt;
    mapping(uint256 => Incident) public incidents;
    mapping(uint256 => Batch) public batches;

    event ConcessionRegistered(uint256 indexed id, address indexed owner, string name, uint256 cellCount);
    event BondDeposited(uint256 indexed id, address indexed from, uint256 amount, uint256 newBond);
    event BondWithdrawn(uint256 indexed id, uint256 amount, uint256 newBond);
    event BatchAnchored(uint256 indexed batchId, bytes32 dataHash, uint32 count, uint64 fromTime, uint64 toTime);
    event HotspotReported(
        uint256 indexed incidentId, uint256 indexed concessionId, uint64 cell, uint64 observedAt, uint8 confidence, uint256 batchId
    );
    event HotspotSkipped(uint64 cell, uint256 indexed batchId, string reason);
    event FireConfirmed(uint256 indexed incidentId, uint256 indexed concessionId, bytes32 evidenceHash);
    event FireRejected(uint256 indexed incidentId, uint256 indexed concessionId, bytes32 evidenceHash);
    event BondSlashed(uint256 indexed concessionId, uint256 amount, uint256 newBond);
    event RoleSet(address indexed account, string role, bool enabled);

    error NotAdmin();
    error NotOracle();
    error NotVerifier();
    error NotConcessionOwner();
    error UnknownConcession();
    error UnknownBatch();
    error CellTaken(uint64 cell, uint256 concessionId);
    error NoCells();
    error ZeroAmount();
    error LowConfidence();
    error NotSuspected();
    error OpenIncidents();
    error InsufficientBond();
    error TransferFailed();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyOracle() {
        if (!isOracle[msg.sender]) revert NotOracle();
        _;
    }

    modifier onlyVerifier() {
        if (!isVerifier[msg.sender]) revert NotVerifier();
        _;
    }

    constructor(address restorationFund_) {
        admin = msg.sender;
        restorationFund = restorationFund_;
    }

    // ---------------------------------------------------------------------
    // Admin
    // ---------------------------------------------------------------------

    function setOracle(address account, bool enabled) external onlyAdmin {
        isOracle[account] = enabled;
        emit RoleSet(account, "oracle", enabled);
    }

    function setVerifier(address account, bool enabled) external onlyAdmin {
        isVerifier[account] = enabled;
        emit RoleSet(account, "verifier", enabled);
    }

    // ---------------------------------------------------------------------
    // Pemegang konsesi
    // ---------------------------------------------------------------------

    function registerConcession(string calldata name, uint64[] calldata cells) external returns (uint256 id) {
        if (cells.length == 0) revert NoCells();
        id = ++concessionCount;
        for (uint256 i = 0; i < cells.length; i++) {
            uint64 cell = cells[i];
            uint256 taken = cellToConcession[cell];
            if (taken != 0) revert CellTaken(cell, taken);
            cellToConcession[cell] = id;
        }
        _cells[id] = cells;
        concessions[id] = Concession({owner: msg.sender, name: name, bond: 0, confirmedFires: 0, openIncidents: 0});
        emit ConcessionRegistered(id, msg.sender, name, cells.length);
    }

    function depositBond(uint256 id) external payable {
        Concession storage c = _concession(id);
        if (msg.value == 0) revert ZeroAmount();
        c.bond += msg.value;
        emit BondDeposited(id, msg.sender, msg.value, c.bond);
    }

    /// @notice Jaminan hanya bisa ditarik saat tidak ada insiden yang menunggu verifikasi.
    function withdrawBond(uint256 id, uint256 amount) external {
        Concession storage c = _concession(id);
        if (msg.sender != c.owner) revert NotConcessionOwner();
        if (c.openIncidents != 0) revert OpenIncidents();
        if (amount > c.bond) revert InsufficientBond();
        c.bond -= amount;
        emit BondWithdrawn(id, amount, c.bond);
        _send(c.owner, amount);
    }

    // ---------------------------------------------------------------------
    // Oracle
    // ---------------------------------------------------------------------

    function anchorBatch(bytes32 dataHash, uint32 count, uint64 fromTime, uint64 toTime)
        external
        onlyOracle
        returns (uint256 batchId)
    {
        batchId = ++batchCount;
        batches[batchId] = Batch({dataHash: dataHash, count: count, fromTime: fromTime, toTime: toTime});
        emit BatchAnchored(batchId, dataHash, count, fromTime, toTime);
    }

    /// @return incidentId 0 bila hotspot di luar konsesi atau masih dalam jendela dedup.
    function reportHotspot(uint64 cell, uint64 observedAt, uint8 confidence, uint256 batchId)
        external
        onlyOracle
        returns (uint256 incidentId)
    {
        if (batchId == 0 || batchId > batchCount) revert UnknownBatch();
        if (confidence < MIN_CONFIDENCE) revert LowConfidence();

        uint256 concessionId = cellToConcession[cell];
        if (concessionId == 0) {
            emit HotspotSkipped(cell, batchId, "outside-concession");
            return 0;
        }

        uint64 last = lastIncidentAt[cell];
        if (last != 0 && observedAt < last + DEDUP_WINDOW) {
            emit HotspotSkipped(cell, batchId, "duplicate-window");
            return 0;
        }

        lastIncidentAt[cell] = observedAt;
        incidentId = ++incidentCount;
        incidents[incidentId] = Incident({
            concessionId: concessionId,
            cell: cell,
            observedAt: observedAt,
            confidence: confidence,
            batchId: batchId,
            status: Status.Suspected,
            evidenceHash: bytes32(0)
        });
        concessions[concessionId].openIncidents += 1;
        emit HotspotReported(incidentId, concessionId, cell, observedAt, confidence, batchId);
    }

    // ---------------------------------------------------------------------
    // Verifikator
    // ---------------------------------------------------------------------

    function confirmFire(uint256 incidentId, bytes32 evidenceHash) external onlyVerifier {
        Incident storage inc = _suspected(incidentId);
        Concession storage c = concessions[inc.concessionId];

        inc.status = Status.Confirmed;
        inc.evidenceHash = evidenceHash;
        c.openIncidents -= 1;
        c.confirmedFires += 1;

        uint256 slash = (c.bond * SLASH_BPS) / 10_000;
        c.bond -= slash;

        emit FireConfirmed(incidentId, inc.concessionId, evidenceHash);
        emit BondSlashed(inc.concessionId, slash, c.bond);
        if (slash > 0) _send(restorationFund, slash);
    }

    function rejectFire(uint256 incidentId, bytes32 evidenceHash) external onlyVerifier {
        Incident storage inc = _suspected(incidentId);
        inc.status = Status.Rejected;
        inc.evidenceHash = evidenceHash;
        concessions[inc.concessionId].openIncidents -= 1;
        emit FireRejected(incidentId, inc.concessionId, evidenceHash);
    }

    // ---------------------------------------------------------------------
    // View
    // ---------------------------------------------------------------------

    function cellsOf(uint256 id) external view returns (uint64[] memory) {
        return _cells[id];
    }

    // ---------------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------------

    function _concession(uint256 id) private view returns (Concession storage c) {
        c = concessions[id];
        if (c.owner == address(0)) revert UnknownConcession();
    }

    function _suspected(uint256 incidentId) private view returns (Incident storage inc) {
        inc = incidents[incidentId];
        if (inc.status != Status.Suspected) revert NotSuspected();
    }

    function _send(address to, uint256 amount) private {
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
