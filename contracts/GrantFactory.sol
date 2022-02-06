// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Grant.sol";

contract GrantFactory is Ownable, Pausable {
    /// @notice Emitted when a new grant contract is deployed
    event GrantCreated(address grantAddress, uint96 workspaceId, string metadataHash, uint256 time);

    /**
     * @notice Create a new grant in the registry, can be called by workspace admins
     * @param _workspaceId id of workspace to which the grant belongs
     * @param _metadataHash grant metadata pointer to ipfs file
     * @param _workspaceReg workspace registry interface
     * @param _applicationReg application registry interface
     * @return address of created grant contract
     */
    function createGrant(
        uint96 _workspaceId,
        string memory _metadataHash,
        IWorkspaceRegistry _workspaceReg,
        IApplicationRegistry _applicationReg
    ) public whenNotPaused returns (address) {
        require(_workspaceReg.isWorkspaceAdmin(_workspaceId, msg.sender), "GrantCreate: Unauthorised");
        address _grantAddress = address(new Grant(_workspaceId, _metadataHash, _workspaceReg, _applicationReg));
        emit GrantCreated(_grantAddress, _workspaceId, _metadataHash, block.timestamp);
        return _grantAddress;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
