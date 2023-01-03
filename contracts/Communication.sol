// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IWorkspaceRegistry.sol";
import "./interfaces/IApplicationRegistry.sol";
import "./interfaces/IGrant.sol";

contract Communication is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    /// @notice workspaceRegistry interface used for fetching fetching workspace admins and reviewers
    IWorkspaceRegistry public workspaceReg;

    /// @notice applicationRegistry interface used for fetching application workspace id
    IApplicationRegistry public applicationReg;

    event EmailAdded(uint256 chainId, string emailHash, string message, address sender, uint256 timestamp);
    event CommentAdded(
        uint96 workspaceId,
        address grantAddress,
        uint96 applicationId,
        bool isPrivate,
        string commentMetadataHash,
        address sender,
        uint256 timestamp
    );

    /**
     * @notice Calls initialize on the base contracts
     *
     * @dev This acts as a constructor for the upgradeable proxy contract
     */
    function initialize() external initializer {
        __Ownable_init();
    }

    /**
     * @notice Override of UUPSUpgradeable virtual function
     *
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(address) internal view override onlyOwner {}

    /**
     * @notice sets workspace registry contract interface
     * @param _workspaceReg WorkspaceRegistry interface
     */
    function setWorkspaceReg(IWorkspaceRegistry _workspaceReg) external onlyOwner {
        workspaceReg = _workspaceReg;
    }

    /**
     * @notice sets application registry contract interface
     * @param _applicationReg ApplicationRegistry contract address
     */
    function setApplicationReg(IApplicationRegistry _applicationReg) external onlyOwner {
        applicationReg = _applicationReg;
    }

    /**
     * @notice Helper function to create a link between an address and an email
     * @param _chainId the chain id of the network
     * @param _emailHash sha256 hash of email address
     * @param _message signed message using the webwallet private key
     */
    function createLink(
        uint256 _chainId,
        string memory _emailHash,
        string memory _message
    ) external {
        require(block.chainid == _chainId, "Chain ID does not match");
        emit EmailAdded(_chainId, _emailHash, _message, msg.sender, block.timestamp);
    }

    /**
     * @notice Add a comment to an application
     * @param _workspaceId workspace id of application
     * @param _grantAddress grant to which the application belongs
     * @param _applicationId target applicationId to which comment needs to be added
     * @param _isPrivate if true, comment is private and only workspace admins, reviewers and applicants can see it
     * @param _commentMetadataHash metadata file hash with the comment
     */
    function addComment(
        uint96 _workspaceId,
        address _grantAddress,
        uint96 _applicationId,
        bool _isPrivate,
        string memory _commentMetadataHash
    ) public {
        if (_isPrivate) {
            require(
                workspaceReg.isWorkspaceAdminOrReviewer(_workspaceId, msg.sender) ||
                    applicationReg.getApplicationOwner(_applicationId) == msg.sender,
                "Not authorized to add private comment"
            );
        }
        IGrant grantRef = IGrant(_grantAddress);
        require(grantRef.workspaceId() == _workspaceId, "Grant not in workspace");
        require(applicationReg.getApplicationWorkspace(_applicationId) == _workspaceId, "Application not in workspace");

        emit CommentAdded(
            _workspaceId,
            _grantAddress,
            _applicationId,
            _isPrivate,
            _commentMetadataHash,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Add the same comment to multiple applications
     * @param _workspaceId workspace id of application
     * @param _grantAddress grant to which the application belongs
     * @param _applicationIds target applicationIds to which comment needs to be added
     * @param _isPrivate if true, comment is private and only workspace admins, reviewers and applicants can see it
     * @param _commentMetadataHash metadata file hash with the comment
     */
    function addComments(
        uint96 _workspaceId,
        address _grantAddress,
        uint96[] memory _applicationIds,
        bool _isPrivate,
        string memory _commentMetadataHash
    ) public {
        for (uint256 i = 0; i < _applicationIds.length; i++) {
            addComment(_workspaceId, _grantAddress, _applicationIds[i], _isPrivate, _commentMetadataHash);
        }
    }
}
