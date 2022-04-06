// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../GrantFactory.sol";

contract GrantFactoryV2 is GrantFactory {
    function version() public pure returns (string memory) {
        return "v2!";
    }
}
