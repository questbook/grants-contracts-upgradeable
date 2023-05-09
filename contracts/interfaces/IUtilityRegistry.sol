// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface IUtilityRegistry {
    function createProfile(string memory metadataHash) external;

    function updateProfile(string memory metadataHash) external;

    function getAddress(bytes memory data) external pure returns (address addr);

    function splitSignature(bytes memory sig) external pure returns (bytes32 r, bytes32 s, uint8 v);
}
