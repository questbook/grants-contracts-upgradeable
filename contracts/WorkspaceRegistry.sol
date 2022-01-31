// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

contract WorkspaceRegistry {
    /// @notice Number of workspace stored in this registry
    uint96 public workspaceCount;

    /// @notice structure holding each workspace data
    struct Workspace {
        uint96 id;
        address owner;
        string metadataHash;
    }

    /// @notice mapping to store workspaceId vs workspace data structure
    mapping(uint96 => Workspace) public workspaces;

    /// @notice mapping to store workspaceId vs admins
    mapping(uint96 => mapping(address => bool)) public workspaceAdmins;

    // --- Events ---
    /// @notice Emitted when a new workspace is created
    event WorkspaceCreated(uint96 indexed id, address indexed owner, string metadataHash, uint256 time);

    /// @notice Emitted when a workspace is updated
    event WorkspaceUpdated(uint96 indexed id, address indexed owner, string metadataHash, uint256 time);

    /// @notice Emitted when a workspace is updated
    event WorkspaceAdminsAdded(uint96 indexed id, address[] admins, string[] emails, uint256 time);

    /// @notice Emitted when a workspace is updated
    event WorkspaceAdminsRemoved(uint96 indexed id, address[] admins, uint256 time);

    /**
     * @notice Create a new workspace under which grants will be created
     * @param _metadataHash workspace metadata pointer to IPFS file
     */
    function createWorkspace(string memory _metadataHash) external {
        uint96 _id = workspaceCount;
        workspaces[_id] = Workspace(_id, msg.sender, _metadataHash);
        workspaceAdmins[_id][msg.sender] = true;
        emit WorkspaceCreated(_id, msg.sender, _metadataHash, block.timestamp);
        workspaceCount += 1;
    }

    /**
     * @notice Update the metadata pointer of a workspace
     * @param _id ID of workspace to update
     * @param _metadataHash New IPFS hash that points to workspace metadata
     */
    function updateWorkspaceMetadata(uint96 _id, string memory _metadataHash) external {
        require(workspaceAdmins[_id][msg.sender], "WorkspaceRegistry: Not authorized");
        Workspace storage workspace = workspaces[_id];
        workspace.metadataHash = _metadataHash;
        emit WorkspaceUpdated(workspace.id, workspace.owner, workspace.metadataHash, block.timestamp);
    }

    /**
     * @notice Add admin to a workspace
     * @param _id ID of target workspace
     * @param _admins New admins for managing workspace
     * @param _emails emails of admin. admin[0] has email [0]
     */
    function addWorkspaceAdmins(
        uint96 _id,
        address[] memory _admins,
        string[] memory _emails
    ) external {
        require(workspaceAdmins[_id][msg.sender], "WorkspaceAddAdmins: Not authorized");
        for (uint256 i = 0; i < _admins.length; i++) {
            address adm = _admins[i];
            workspaceAdmins[_id][adm] = true;
        }
        emit WorkspaceAdminsAdded(_id, _admins, _emails, block.timestamp);
    }

    /**
     * @notice Remove admins from a workspace
     * @param _id ID of target workspace
     * @param _admins Admins to be removed
     */
    function removeWorkspaceAdmins(uint96 _id, address[] memory _admins) external {
        require(workspaceAdmins[_id][msg.sender], "WorkspaceRemoveAdmins: Not authorized");
        for (uint256 i = 0; i < _admins.length; i++) {
            address adm = _admins[i];
            workspaceAdmins[_id][adm] = false;
        }
        emit WorkspaceAdminsRemoved(_id, _admins, block.timestamp);
    }

    /**
     * @notice Check if an address is admin of specified workspace
     * @param _id ID of target workspace
     * @param _address Address to validate role
     */
    function isWorkspaceAdmin(uint96 _id, address _address) external view returns (bool) {
        return workspaceAdmins[_id][_address];
    }
}
