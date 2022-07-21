// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IWorkspaceRegistry.sol";
import "./interfaces/IApplicationRegistry.sol";
import "@questbook/anon-authoriser/contracts/anon-authoriser.sol";
import "hardhat/console.sol";

/// @title Registry for all the workspaces used to create and update workspaces
contract WorkspaceRegistry is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    IWorkspaceRegistry
{
    /// @notice Number of workspace stored in this registry
    uint96 public workspaceCount;

    /// @notice Optional safe used by a workspace
    struct Safe {
        /// The address of the safe
        bytes32 _address;
        /// ID of the chain, where it is stored
        uint256 chainId;
    }

    /// @notice structure holding each workspace data
    struct Workspace {
        uint96 id;
        address owner;
        string metadataHash;
        Safe safe;
    }

    /// @notice mapping to store workspaceId vs workspace data structure
    mapping(uint96 => Workspace) public workspaces;

    /// @notice mapping to store workspaceId vs members vs roles
    mapping(uint96 => mapping(address => bytes32)) public memberRoles;

    /// @notice Address of the anon authoriser contract
    address public anonAuthoriserAddress;

    /// @notice applicationRegistry interface used for fetching application owner
    IApplicationRegistry public applicationReg;

    // --- Events ---
    /// @notice Emitted when a new workspace is created
    event WorkspaceCreated(uint96 indexed id, address indexed owner, string metadataHash, uint256 time);

    /// @notice Emitted when a workspace's safe is updated
    event WorkspaceSafeUpdated(uint96 indexed id, bytes32 safeAddress, uint256 safeChainId, uint256 time);

    /// @notice Emitted when a workspace is updated
    event WorkspaceUpdated(uint96 indexed id, address indexed owner, string metadataHash, uint256 time);

    /// @notice Emitted when workspace members are updated
    /// @notice The role 0 denotes an admin role
    /// @notice The role 1 denotes a reviewer role
    event WorkspaceMembersUpdated(
        uint96 indexed id,
        address[] members,
        uint8[] roles,
        bool[] enabled,
        string[] emails,
        uint256 time
    );

    /// @notice Emitted when a workspace member's profile is updated
    /// @notice The role 0 denotes an admin role
    /// @notice The role 1 denotes a reviewer role
    /// @notice enabled => member is active, otherwise removed from workspace
    event WorkspaceMemberUpdated(
        uint96 indexed id,
        address member,
        uint8 role,
        bool enabled,
        string metadataHash,
        uint256 time
    );

    /// @notice Emitted when grant reward is disbursed
    event DisburseReward(
        uint96 indexed applicationId,
        uint96 milestoneId,
        address asset,
        address sender,
        uint256 amount,
        bool isP2P,
        uint256 time
    );

    modifier onlyWorkspaceAdmin(uint96 _workspaceId) {
        require(_checkRole(_workspaceId, msg.sender, 0), "Unauthorised: Not an admin");
        _;
    }

    modifier onlyWorkspaceAdminOrReviewer(uint96 _workspaceId) {
        require(
            _checkRole(_workspaceId, msg.sender, 0) || _checkRole(_workspaceId, msg.sender, 1),
            "Unauthorised: Neither an admin nor a reviewer"
        );
        _;
    }

    modifier withinLimit(uint256 _membersLength) {
        require(_membersLength <= 1000, "WorkspaceMembers: Limit exceeded");
        _;
    }

    modifier checkBalance(
        IERC20 _erc20Interface,
        address _sender,
        uint256 _amount
    ) {
        require(_erc20Interface.balanceOf(_sender) > _amount, "Insufficient Balance");
        _;
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
     * @notice Change the address of the anon authoriser contract
     */
    function updateAnonAuthoriserAddress(address addr) external onlyOwner {
        anonAuthoriserAddress = addr;
    }

    /**
     * @notice Create a new workspace under which grants will be created,
     * can be called by anyone who wants to create workspace
     * @param _metadataHash workspace metadata pointer to IPFS file
     * @param _safeAddress address of the safe used by the workspace (optional)
     * @param _safeChainId chain id of the safe used by the workspace (optional -- specify 0 if not used)
     */
    function createWorkspace(
        string memory _metadataHash,
        bytes32 _safeAddress,
        uint256 _safeChainId
    ) external whenNotPaused {
        uint96 _id = workspaceCount;
        workspaces[_id] = Workspace(_id, msg.sender, _metadataHash, Safe(_safeAddress, _safeChainId));
        _setRole(_id, msg.sender, 0, true);
        emit WorkspaceCreated(_id, msg.sender, _metadataHash, block.timestamp);
        // emit safe update if safe was specified
        if (_safeChainId > 0) {
            emit WorkspaceSafeUpdated(_id, _safeAddress, _safeChainId, block.timestamp);
        }
        assert(workspaceCount + 1 > workspaceCount);
        workspaceCount += 1;
    }

    /**
     * @notice Update the metadata pointer of a workspace,
     * can be called by workspace admins or reviewers
     * @param _id ID of workspace to update
     * @param _metadataHash New IPFS hash that points to workspace metadata
     */
    function updateWorkspaceMetadata(uint96 _id, string memory _metadataHash)
        external
        whenNotPaused
        onlyWorkspaceAdminOrReviewer(_id)
    {
        Workspace storage workspace = workspaces[_id];
        workspace.metadataHash = _metadataHash;
        emit WorkspaceUpdated(workspace.id, workspace.owner, workspace.metadataHash, block.timestamp);
    }

    /**
     * @notice Update the workspace safe address and chain id, admin only
     *
     * @param _id ID of workspace to update
     * @param _safeAddress address of the safe used by the workspace (optional)
     * @param _safeChainId chain id of the safe used by the workspace (set to 0 to remove)
     */
    function updateWorkspaceSafe(
        uint96 _id,
        bytes32 _safeAddress,
        uint256 _safeChainId
    ) external whenNotPaused onlyWorkspaceAdmin(_id) {
        Workspace storage workspace = workspaces[_id];
        workspace.safe = Safe(_safeAddress, _safeChainId);
        emit WorkspaceSafeUpdated(_id, _safeAddress, _safeChainId, block.timestamp);
    }

    /**
     * @notice Update workspace members' roles, can be called by workspace admins
     * @param _id ID of target workspace
     * @param _members Members whose roles are to be updated
     * @param _roles Roles to be updated
     * @param _enabled Whether to enable or disable the role
     * @param _emails Emails of members.
     */
    function updateWorkspaceMembers(
        uint96 _id,
        address[] memory _members,
        uint8[] memory _roles,
        bool[] memory _enabled,
        string[] memory _emails
    ) external whenNotPaused onlyWorkspaceAdmin(_id) withinLimit(_members.length) {
        require(_members.length == _roles.length, "UpdateWorkspaceMembers: Parameters length mismatch");
        require(_members.length == _enabled.length, "UpdateWorkspaceMembers: Parameters length mismatch");
        require(_members.length == _emails.length, "UpdateWorkspaceMembers: Parameters length mismatch");
        for (uint256 i = 0; i < _members.length; i++) {
            address member = _members[i];
            /// @notice The role 0 denotes an admin role
            /// @notice The role 1 denotes a reviewer role
            uint8 role = _roles[i];
            bool enabled = _enabled[i];
            _setRole(_id, member, role, enabled);
        }
        emit WorkspaceMembersUpdated(_id, _members, _roles, _enabled, _emails, block.timestamp);
    }

    /**
     * @notice Create an invite link for someone to join with
     * @param _id ID of workspace to create invite link for
     * @param _role what the role of the invited member should be
     * @param publicKeyAddress Generated public key address for the invite link
     * (corresponding private key should be sent to invitee)
     */
    function createInviteLink(
        uint96 _id,
        uint8 _role,
        address publicKeyAddress
    ) external whenNotPaused onlyWorkspaceAdmin(_id) {
        bytes32 apiFlag = apiFlagForWorkspaceId(_id, _role);
        AnonAuthoriser(anonAuthoriserAddress).generateAnonAuthorisation(publicKeyAddress, apiFlag);
    }

    /**
     * @notice Join a workspace with an invite link
     * @param _id ID of workspace to join
     * @param _metadataHash metadata for the member
     * @param _role the role the user was invited for
     * Remaining params are of the signature to be sent to AnonAuthoriser
     */
    function joinViaInviteLink(
        uint96 _id,
        string memory _metadataHash,
        uint8 _role,
        uint8 signatureV,
        bytes32 signatureR,
        bytes32 signatureS
    ) external whenNotPaused {
        bytes32 apiFlag = apiFlagForWorkspaceId(_id, _role);
        AnonAuthoriser(anonAuthoriserAddress).anonAuthorise(
            address(this),
            apiFlag,
            msg.sender,
            signatureV,
            signatureR,
            signatureS
        );

        _setRole(_id, msg.sender, _role, true);
        emit WorkspaceMemberUpdated(_id, msg.sender, _role, true, _metadataHash, block.timestamp);
    }

    /**
     * @notice Check if an address is admin of specified workspace, can be called by anyone
     * @param _id ID of target workspace
     * @param _address Address to validate role
     * @return true if specified address is admin of provided workspace id, else false
     */
    function isWorkspaceAdmin(uint96 _id, address _address) external view override returns (bool) {
        return _checkRole(_id, _address, 0);
    }

    /**
     * @notice Check if an address is admin or reviewer of specified workspace, can be called by anyone
     * @param _id ID of target workspace
     * @param _address Address to validate role
     * @return true if specified address is admin or reviewer of provided workspace id, else false
     */
    function isWorkspaceAdminOrReviewer(uint96 _id, address _address) external view override returns (bool) {
        return _checkRole(_id, _address, 0) || _checkRole(_id, _address, 1);
    }

    /**
     * @notice Set role of an address for specified workspace, can be called internally
     * @param _workspaceId ID of target workspace
     * @param _address Address of the member whose role to set
     * @param _role Role to be set
     * @param _enabled Whether to enable or disable the role
     */
    function _setRole(
        uint96 _workspaceId,
        address _address,
        uint8 _role,
        bool _enabled
    ) internal {
        Workspace memory workspace = workspaces[_workspaceId];

        /// @notice Do not allow anybody other than owner to set admin role false for workspace owner
        if (_address == workspace.owner && _enabled == false && msg.sender != workspace.owner) {
            revert("WorkspaceOwner: Cannot disable owner admin role");
        }
        if (_enabled) {
            /// @notice Set _role'th bit in roles of _address in workspace
            memberRoles[_workspaceId][_address] |= bytes32(1 << _role);
        } else {
            /// @notice Unset _role'th bit in roles of _address in workspace
            memberRoles[_workspaceId][_address] &= ~bytes32(1 << _role);
        }
    }

    /**
     * @notice Check role of an address for specified workspace, can be called internally
     * @param _workspaceId ID of target workspace
     * @param _address Address of the member whose role to set
     * @param _role Role to be set
     * @return true if specified address has that role in specified workspace, else false
     */
    function _checkRole(
        uint96 _workspaceId,
        address _address,
        uint8 _role
    ) internal view returns (bool) {
        /// @notice Check if _address has _role'th bit set in roles of _address in workspace
        return (uint256(memberRoles[_workspaceId][_address]) >> _role) & 1 != 0;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function apiFlagForWorkspaceId(uint96 workspaceId, uint8 role) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("workspace-invite-", abi.encodePacked(workspaceId), abi.encodePacked(role)));
    }

    /**
     * @notice Disburses grant reward, can be called by applicationRegistry contract
     * @param _applicationId application id for which the funds are disbursed
     * @param _applicantWalletAddress wallet address of the applicant to disburse rewards to
     * @param _milestoneId milestone id for which the funds are disbursed
     * @param _erc20Interface interface for erc20 asset using which rewards are disbursed
     * @param _amount amount disbursed
     * @param _workspaceId workspace that the application belongs to
     */
    function disburseRewardP2P(
        uint96 _applicationId,
        address _applicantWalletAddress,
        uint96 _milestoneId,
        IERC20 _erc20Interface,
        uint256 _amount,
        uint96 _workspaceId
    ) external onlyWorkspaceAdmin(_workspaceId) checkBalance(_erc20Interface, msg.sender, _amount) {
        emit DisburseReward(
            _applicationId,
            _milestoneId,
            address(_erc20Interface),
            msg.sender,
            _amount,
            true,
            block.timestamp
        );
        require(_applicantWalletAddress != address(this), "This transfer is prohibited");
        console.log("Inside disburse reward");
        if (_applicantWalletAddress == address(0)) {
            require(
                _erc20Interface.transferFrom(msg.sender, applicationReg.getApplicationOwner(_applicationId), _amount),
                "Failed to transfer funds"
            );
        } else {
            require(
                _erc20Interface.transferFrom(msg.sender, _applicantWalletAddress, _amount),
                "Failed to transfer funds to applicant wallet address"
            );
        }
    }
}
