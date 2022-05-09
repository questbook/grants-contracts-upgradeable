// SPDX-License-Identifier: MIT
pragma solidity >=0.8.1;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../facets/GrantFacet.sol";
import "../facets/OwnershipFacet.sol";
import "../interfaces/IApplicationReviewRegistry.sol";
import { AppStorage, Workspace, ModifierFacets } from "../libraries/LibAppStorage.sol";

/// @title Factory contract used to create new grants,
/// each grant is a new contract deployed using this factory
contract GrantFactoryFacet is ModifierFacets {
    OwnershipFacet internal ownership;

    bool paused;

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    // address public immutable grantImplementation;

    /// @notice applicationReviewRegistry interface
    IApplicationReviewRegistry public applicationReviewReg;

    /// @notice Emitted when a new grant contract is deployed
    event GrantCreated(address grantAddress, uint96 workspaceId, string metadataHash, uint256 time);

    /// @notice Emitted when a Grant implementation contract is upgraded
    event GrantImplementationUpdated(address grantAddress, bool success, bytes data);

    modifier whenNotPaused() {
        require(!paused, "Unauthorised: Paused");
        _;
    }

    /**
     * @notice Constructor for initializing the Grant Implementation Contract
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    // constructor() {
    //     grantFacet = new GrantFacet();
    // }

    // /**
    //  * @notice Calls initialize on the base contracts
    //  *
    //  * @dev This acts as a constructor for the upgradeable proxy contract
    //  */
    // function initialize() external initializer {
    //     __Ownable_init();
    //     __Pausable_init();
    // }

    // /**
    //  * @notice Override of UUPSUpgradeable virtual function
    //  *
    //  * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
    //  * {upgradeTo} and {upgradeToAndCall}.
    //  */
    // function _authorizeUpgrade(address) internal view override onlyOwner {}

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
        GrantFacet grant = new GrantFacet(
            _workspaceId,
            _metadataHash,
            _workspaceReg,
            _applicationReg
            // ownership.owner()
        );
        address _grantAddress = address(grant);
        emit GrantCreated(_grantAddress, _workspaceId, _metadataHash, block.timestamp);
        applicationReviewReg.setRubrics(_workspaceId, _grantAddress, _rubricsMetadataHash);
        return _grantAddress;
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

    function _pause() internal {
        paused = true;
    }

    function _unpause() internal {
        paused = false;
    }
}
