// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;
import "./Grant.sol";

contract GrantFactory {
    /// @notice Emitted when a new grant contract is deployed
    event GrantCreated(address grantAddress, uint96 workspaceId, string metadataHash, uint256 time);

    /**
     * @notice Create a new grant in the registry
     * @param _workspaceId id of workspace to which the grant belongs
     * @param _metadataHash grant metadata pointer to ipfs file
     * @param _workspaceRegAddr contract address of workspace registry contract
     * @param _applicationRegAddr contract address of application registry contract
     */
    function createGrant(
        uint96 _workspaceId,
        string memory _metadataHash,
        address _workspaceRegAddr,
        address _applicationRegAddr
    ) public returns (address) {
        require(
            IWorkspaceRegistry(_workspaceRegAddr).isWorkspaceAdmin(_workspaceId, msg.sender),
            "GrantCreate: Unauthorised"
        );
        address _grantAddress = address(new Grant(_workspaceId, _metadataHash, _workspaceRegAddr, _applicationRegAddr));
        emit GrantCreated(_grantAddress, _workspaceId, _metadataHash, block.timestamp);
        return _grantAddress;
    }
}
