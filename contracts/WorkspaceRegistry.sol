// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./interfaces/IWorkspaceRegistry.sol";

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

    // --- Events ---
    /// @notice Emitted when a new workspace is created
    event WorkspaceCreated(
        uint96 indexed id,
        address indexed owner,
        string metadataHash,
        bytes32 safeAddress,
        uint256 safeChainId,
        uint256 time
    );

    /// @notice Emitted when a workspace is updated
    event WorkspaceUpdated(
        uint96 indexed id,
        address indexed owner,
        string metadataHash,
        bytes32 safeAddress,
        uint256 safeChainId,
        uint256 time
    );

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
        emit WorkspaceCreated(_id, msg.sender, _metadataHash, _safeAddress, _safeChainId, block.timestamp);
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
        emit WorkspaceUpdated(
            workspace.id,
            workspace.owner,
            workspace.metadataHash,
            workspace.safe._address,
            workspace.safe.chainId,
            block.timestamp
        );
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
        emit WorkspaceUpdated(
            workspace.id,
            workspace.owner,
            workspace.metadataHash,
            workspace.safe._address,
            workspace.safe.chainId,
            block.timestamp
        );
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
}
