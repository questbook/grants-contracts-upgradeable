// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./Grant.sol";
import "./interfaces/IApplicationReviewRegistry.sol";
import "./interfaces/IGrant.sol";

/// @title Factory contract used to create new grants,
/// each grant is a new contract deployed using this factory
contract GrantFactory is Initializable, UUPSUpgradeable, OwnableUpgradeable, PausableUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable grantImplementation;

    /// @notice applicationReviewRegistry interface
    IApplicationReviewRegistry public applicationReviewReg;

    /// @notice Emitted when a new grant contract is deployed
    event GrantCreated(address grantAddress, uint96 workspaceId, string metadataHash, uint256 time);

    /// @notice Emitted when a Grant implementation contract is upgraded
    event GrantImplementationUpdated(address grantAddress, bool success, bytes data);

    /// @notice Emitted when a grant is updated
    event GrantUpdatedFromFactory(
        address indexed grantAddress,
        uint96 indexed workspaceId,
        string metadataHash,
        bool active,
        uint256 time
    );

    /**
     * @notice Constructor for initializing the Grant Implementation Contract
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        grantImplementation = address(new Grant());
    }

    /**
     * @notice Calls initialize on the base contracts
     *
     * @dev This acts as a constructor for the upgradeable proxy contract
     */
    function initialize() external initializer {
        __Ownable_init();
        __Pausable_init();
    }

    /**
     * @notice Override of UUPSUpgradeable virtual function
     *
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(address) internal view override onlyOwner {}

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
        string memory _rubricsMetadataHash,
        IWorkspaceRegistry _workspaceReg,
        IApplicationRegistry _applicationReg
    ) external whenNotPaused returns (address) {
        require(_workspaceReg.isWorkspaceAdmin(_workspaceId, msg.sender), "GrantCreate: Unauthorised");
        ERC1967Proxy grantProxy = new ERC1967Proxy(
            grantImplementation,
            abi.encodeWithSelector(
                Grant.initialize.selector,
                _workspaceId,
                _metadataHash,
                _workspaceReg,
                _applicationReg,
                address(this),
                owner()
            )
        );
        address _grantAddress = address(grantProxy);
        emit GrantCreated(_grantAddress, _workspaceId, _metadataHash, block.timestamp);
        applicationReviewReg.setRubrics(_workspaceId, _grantAddress, _rubricsMetadataHash);
        return _grantAddress;
    }

    /**
     * @notice Function to update grant
     * @param grantAddress Address of the grant contract that needs to be updated
     * @param _workspaceId Workspace Id that the grant belongs to
     * @param _metadataHash New URL that points to grant metadata
     */
    function updateGrant(
        address grantAddress,
        uint96 _workspaceId,
        IWorkspaceRegistry _workspaceReg,
        string memory _metadataHash
    ) external {
        require(_workspaceReg.isWorkspaceAdmin(_workspaceId, msg.sender), "GrantUpdate: Unauthorised");
        IGrant(grantAddress).updateGrant(_metadataHash);
        bool active = IGrant(grantAddress).active();

        emit GrantUpdatedFromFactory(grantAddress, _workspaceId, _metadataHash, active, block.timestamp);
    }

    function updateGrantAccessibility(
        address grantAddress,
        uint96 _workspaceId,
        IWorkspaceRegistry _workspaceReg,
        bool _canAcceptApplication
    ) external {
        require(_workspaceReg.isWorkspaceAdmin(_workspaceId, msg.sender), "GrantUpdate: Unauthorised");
        IGrant(grantAddress).updateGrantAccessibility(_canAcceptApplication);
        string memory metadataHash = IGrant(grantAddress).metadataHash();
        emit GrantUpdatedFromFactory(grantAddress, _workspaceId, metadataHash, _canAcceptApplication, block.timestamp);
    }

    /**
     * @notice sets application review registry contract interface
     * @param _applicationReviewReg ApplicationReviewRegistry interface
     */
    function setApplicationReviewReg(IApplicationReviewRegistry _applicationReviewReg) external onlyOwner {
        applicationReviewReg = _applicationReviewReg;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
