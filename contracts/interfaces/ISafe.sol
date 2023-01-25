// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface ISafe {
    // function getGuard() internal view returns (address guard);
    function getOwners() external view returns (address[] memory);

    function getStorageAt(uint256 offset, uint256 length) external view returns (bytes memory);
}
