// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../Grant.sol";

contract GrantV2 is Grant {
    function version() public pure returns (string memory) {
        return "v2!";
    }
}
