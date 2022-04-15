// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../ApplicationReviewRegistry.sol";

contract ApplicationReviewRegistryV2 is ApplicationReviewRegistry {
    function version() public pure returns (string memory) {
        return "v2!";
    }
}
