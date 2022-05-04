// SPDX-License-Identifier: MIT
pragma solidity >=0.8.1;

import "@openzeppelin/contracts/security/Pausable.sol";
import "../interfaces/IWorkspaceRegistry.sol";
import { AppStorage, Workspace, ModifierFacets } from "../libraries/LibAppStorage.sol";

/// @title Registry for all the workspaces used to create and update workspaces
contract WorkspaceRegistryFacet is Pausable, IWorkspaceRegistry, ModifierFacets {
    /// @notice workspaceRegistry interface used for fetching fetching workspace admins and reviewers
    IWorkspaceRegistry public workspaceReg;

    // --- Events ---
    /// @notice Emitted when a new workspace is created
    event WorkspaceCreated(uint96 indexed id, address indexed owner, string metadataHash, uint256 time);

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

    modifier onlyWorkspaceAdmin(uint96 _workspaceId) {
        require(workspaceReg.isWorkspaceAdmin(_workspaceId, msg.sender), "Unauthorised: Not an admin");
        _;
    }

    modifier onlyWorkspaceAdminOrReviewer(uint96 _workspaceId) {
        require(
            workspaceReg.isWorkspaceAdminOrReviewer(_workspaceId, msg.sender),
            "Unauthorised: Neither an admin nor a reviewer"
        );
        _;
    }

    modifier withinLimit(uint256 _membersLength) {
        require(_membersLength <= 1000, "WorkspaceMembers: Limit exceeded");
        _;
    }

    /**
     * @notice Create a new workspace under which grants will be created,
     * can be called by anyone who wants to create workspace
     * @param _metadataHash workspace metadata pointer to IPFS file
     */
    function createWorkspace(string memory _metadataHash) external whenNotPaused {
        uint96 _id = appStorage.workspaceCount;
        appStorage.workspaces[_id] = Workspace(_id, msg.sender, _metadataHash);
        _setRole(_id, msg.sender, 0, true);
        emit WorkspaceCreated(_id, msg.sender, _metadataHash, block.timestamp);
        assert(appStorage.workspaceCount + 1 > appStorage.workspaceCount);
        appStorage.workspaceCount += 1;
    }

    /**
     * @notice Update the metadata pointer of a workspace, can be called by workspace admins
     * @param _id ID of workspace to update
     * @param _metadataHash New IPFS hash that points to workspace metadata
     */
    function updateWorkspaceMetadata(uint96 _id, string memory _metadataHash)
        external
        whenNotPaused
    // onlyWorkspaceAdminOrReviewer(_id)
    {
        Workspace storage workspace = appStorage.workspaces[_id];
        workspace.metadataHash = _metadataHash;
        emit WorkspaceUpdated(workspace.id, workspace.owner, workspace.metadataHash, block.timestamp);
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
            // @notice The role 0 denotes an admin role
            // @notice The role 1 denotes a reviewer role
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
        Workspace memory workspace = appStorage.workspaces[_workspaceId];

        /// @notice Do not allow anybody other than owner to set admin role false for workspace owner
        if (_address == workspace.owner && _enabled == false && msg.sender != workspace.owner) {
            revert("WorkspaceOwner: Cannot disable owner admin role");
        }
        if (_enabled) {
            /// @notice Set _role'th bit in roles of _address in workspace
            appStorage.memberRoles[_workspaceId][_address] |= bytes32(1 << _role);
        } else {
            /// @notice Unset _role'th bit in roles of _address in workspace
            appStorage.memberRoles[_workspaceId][_address] &= ~bytes32(1 << _role);
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
        return (uint256(appStorage.memberRoles[_workspaceId][_address]) >> _role) & 1 != 0;
    }

    function pauseWorkspaceRegistry() external onlyOwner {
        _pause();
    }

    function unpauseWorkspaceRegistry() external onlyOwner {
        _unpause();
    }
}
