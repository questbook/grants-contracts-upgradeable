// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IWorkspaceRegistry.sol";

/// @title Registry for all the workspaces used to create and update workspaces
contract WorkspaceRegistry is Ownable, Pausable, IWorkspaceRegistry {
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

    modifier onlyWorkspaceAdmin(uint96 _workspaceId) {
        require(workspaceAdmins[_workspaceId][msg.sender], "Unauthorised: Not an admin");
        _;
    }

    modifier withinLimit(uint256 _adminsLength) {
        require(_adminsLength <= 1000, "WorkspaceRemoveAdmins: Limit exceeded");
        _;
    }

    /**
     * @notice Create a new workspace under which grants will be created,
     * can be called by anyone who wants to create workspace
     * @param _metadataHash workspace metadata pointer to IPFS file
     */
    function createWorkspace(string memory _metadataHash) external whenNotPaused {
        uint96 _id = workspaceCount;
        workspaces[_id] = Workspace(_id, msg.sender, _metadataHash);
        workspaceAdmins[_id][msg.sender] = true;
        emit WorkspaceCreated(_id, msg.sender, _metadataHash, block.timestamp);
        assert(workspaceCount + 1 > workspaceCount);
        workspaceCount += 1;
    }

    /**
     * @notice Update the metadata pointer of a workspace, can be called by workspace admins
     * @param _id ID of workspace to update
     * @param _metadataHash New IPFS hash that points to workspace metadata
     */
    function updateWorkspaceMetadata(uint96 _id, string memory _metadataHash)
        external
        whenNotPaused
        onlyWorkspaceAdmin(_id)
    {
        Workspace storage workspace = workspaces[_id];
        workspace.metadataHash = _metadataHash;
        emit WorkspaceUpdated(workspace.id, workspace.owner, workspace.metadataHash, block.timestamp);
    }

    /**
     * @notice Add admin to a workspace, can be called by workspace admins
     * @param _id ID of target workspace
     * @param _admins New admins for managing workspace
     * @param _emails emails of admin. admin[0] has email [0]
     */
    function addWorkspaceAdmins(
        uint96 _id,
        address[] memory _admins,
        string[] memory _emails
    ) external whenNotPaused onlyWorkspaceAdmin(_id) withinLimit(_admins.length) {
        for (uint256 i = 0; i < _admins.length; i++) {
            address adm = _admins[i];
            workspaceAdmins[_id][adm] = true;
        }
        emit WorkspaceAdminsAdded(_id, _admins, _emails, block.timestamp);
    }

    /**
     * @notice Remove admins from a workspace, can be called by workspace admins
     * @param _id ID of target workspace
     * @param _admins Admins to be removed
     */
    function removeWorkspaceAdmins(uint96 _id, address[] memory _admins)
        external
        whenNotPaused
        onlyWorkspaceAdmin(_id)
        withinLimit(_admins.length)
    {
        for (uint256 i = 0; i < _admins.length; i++) {
            address adm = _admins[i];
            workspaceAdmins[_id][adm] = false;
        }
        emit WorkspaceAdminsRemoved(_id, _admins, block.timestamp);
    }

    /**
     * @notice Check if an address is admin of specified workspace, can be called by anyone
     * @param _id ID of target workspace
     * @param _address Address to validate role
     * @return true if specified address is admin of provided workspace id, else false
     */
    function isWorkspaceAdmin(uint96 _id, address _address) external view override returns (bool) {
        return workspaceAdmins[_id][_address];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
