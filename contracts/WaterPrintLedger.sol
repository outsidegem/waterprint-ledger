// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

contract WaterPrintLedger {
    struct Attestation {
        bytes32 canonicalHash;
        address nodeAddress;
        uint256 energyAvoidedMWh;
        uint256 waterAvoidedUml;
        uint256 timestamp;
        string accountingType;
    }

    Attestation[] public attestations;
    mapping(bytes32 => bool) public registeredHashes;

    event AttestationRecorded(
        bytes32 indexed canonicalHash,
        address indexed nodeAddress,
        uint256 energyAvoidedMWh,
        uint256 waterAvoidedUml,
        uint256 timestamp
    );

    error HashAlreadyRegistered(bytes32 hash);
    error InvalidHash();

    function recordAttestation(
        bytes32 _canonicalHash,
        uint256 _energyAvoidedMWh,
        uint256 _waterAvoidedUml
    ) external {
        if (_canonicalHash == bytes32(0)) revert InvalidHash();
        if (registeredHashes[_canonicalHash]) {
            revert HashAlreadyRegistered(_canonicalHash);
        }

        registeredHashes[_canonicalHash] = true;

        attestations.push(Attestation({
            canonicalHash: _canonicalHash,
            nodeAddress: msg.sender,
            energyAvoidedMWh: _energyAvoidedMWh,
            waterAvoidedUml: _waterAvoidedUml,
            timestamp: block.timestamp,
            accountingType: "estimated_avoided"
        }));

        emit AttestationRecorded(
            _canonicalHash,
            msg.sender,
            _energyAvoidedMWh,
            _waterAvoidedUml,
            block.timestamp
        );
    }

    function totalAttestations() external view returns (uint256) {
        return attestations.length;
    }
}
