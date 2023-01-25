// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

interface ISafeGuard {
    function safeAddress() external view returns (address);

    function reviewers() external view returns (address[] memory);
}
