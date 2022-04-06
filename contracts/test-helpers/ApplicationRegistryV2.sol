// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../ApplicationRegistry.sol";

contract ApplicationRegistryV2 is ApplicationRegistry {
    function version() public pure returns (string memory) {
        return "v2!";
    }
}
