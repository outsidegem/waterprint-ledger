// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title WaterPrintLedger
 * @notice Immutable on-chain registry for verified avoided AI resource events.
 * @dev Records estimated_avoided telemetry without claiming physical restoration.
 */
contract WaterPrintLedger {

    struct AvoidedRecord {
        bytes32 nodeOrAgentId;
        bytes32 canonicalHash;      // SHA-256 hash of event metadata (safeInput projection)
        uint32 avoidedEnergyMWh;    // Milliwatt-hours avoided
        uint32 avoidedWaterUml;     // Microliters of water avoided
        uint16 methodologyVersion;  // Methodology version parameter
        uint64 timestamp;
    }

    event ResourceAvoidedLogged(
        bytes32 indexed nodeOrAgentId,
        bytes32 indexed canonicalHash,
        uint32 avoidedEnergyMWh,
        uint32 avoidedWaterUml,
        uint16 methodologyVersion,
        uint64 timestamp
    );

    AvoidedRecord[] public ledger;

    function recordAvoidedCompute(
        bytes32 _nodeOrAgentId,
        bytes32 _canonicalHash,
        uint32 _avoidedEnergyMWh,
        uint32 _avoidedWaterUml,
        uint16 _methodologyVersion
    ) external returns (uint256 entryIndex) {
        AvoidedRecord memory newRecord = AvoidedRecord({
            nodeOrAgentId: _nodeOrAgentId,
            canonicalHash: _canonicalHash,
            avoidedEnergyMWh: _avoidedEnergyMWh,
            avoidedWaterUml: _avoidedWaterUml,
            methodologyVersion: _methodologyVersion,
            timestamp: uint64(block.timestamp)
        });

        ledger.push(newRecord);
        entryIndex = ledger.length - 1;

        emit ResourceAvoidedLogged(
            _nodeOrAgentId,
            _canonicalHash,
            _avoidedEnergyMWh,
            _avoidedWaterUml,
            _methodologyVersion,
            uint64(block.timestamp)
        );

        return entryIndex;
    }

    function totalRecords() external view returns (uint256) {
        return ledger.length;
    }
}
