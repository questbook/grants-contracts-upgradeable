// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

contract Communication {
    event EmailAdded(uint256 chainId, string emailHash, string message, address sender, uint256 timestamp);

    function createLink(
        uint256 chainId,
        string memory emailHash,
        string memory message
    ) external {
        require(block.chainid == chainId, "Chain ID does not match");
        emit EmailAdded(chainId, emailHash, message, msg.sender, block.timestamp);
    }
}
