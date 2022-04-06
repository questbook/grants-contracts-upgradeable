// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../WorkspaceRegistry.sol";

contract WorkspaceRegistryV2 is WorkspaceRegistry {
    function version() public pure returns (string memory) {
        return "v2!";
    }
}
