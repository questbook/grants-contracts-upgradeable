// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface ISafeGuard {
    function reviewers() external view returns (address[] memory);
}
