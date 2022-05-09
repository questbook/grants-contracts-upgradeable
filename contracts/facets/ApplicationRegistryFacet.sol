// SPDX-License-Identifier: MIT
pragma solidity >=0.8.1;

import "../interfaces/IWorkspaceRegistry.sol";
import "../interfaces/IGrant.sol";
import "../interfaces/IApplicationRegistry.sol";
import { AppStorage, Application, ApplicationState, MilestoneState, ModifierFacets } from "../libraries/LibAppStorage.sol";

/// @title Registry for all the grant applications used for updates on application
/// and requesting funds/milestone approvals
contract ApplicationRegistryFacet is IApplicationRegistry, ModifierFacets {
    /// @notice interface for using external functionalities like checking workspace admin
    IWorkspaceRegistry public workspaceRegApplicationRegistry;

    // --- Events ---
    /// @notice Emitted when a new application is submitted
    event ApplicationSubmitted(
        uint96 indexed applicationId,
        address grant,
        address owner,
        string metadataHash,
        uint48 milestoneCount,
        uint256 time
    );

    /// @notice Emitted when a new application is updated
    event ApplicationUpdated(
        uint96 indexed applicationId,
        address owner,
        string metadataHash,
        ApplicationState state,
        uint48 milestoneCount,
        uint256 time
    );

    /// @notice Emitted when application milestone is updated
    event MilestoneUpdated(uint96 _id, uint96 _milestoneId, MilestoneState _state, string _metadataHash, uint256 time);

    modifier onlyWorkspaceAdmin(uint96 _workspaceId) {
        require(
            workspaceRegApplicationRegistry.isWorkspaceAdmin(_workspaceId, msg.sender),
            "Unauthorised: Not an admin"
        );
        _;
    }

    function applicationCount() public view returns (uint256) {
        return appStorage.applicationCount;
    }

    /**
     * @notice sets workspace registry contract interface
     * @param _workspaceReg WorkspaceRegistry interface
     */
    function setWorkspaceReg(IWorkspaceRegistry _workspaceReg) external onlyOwner {
        workspaceRegApplicationRegistry = _workspaceReg;
    }

    /**
     * @notice Create/submit application
     * @param _grant address of Grant for which the application is submitted
     * @param _workspaceId workspaceId to which the grant belongs
     * @param _metadataHash application metadata pointer to IPFS file
     * @param _milestoneCount number of milestones under the application
     */
    function submitApplication(
        address _grant,
        uint96 _workspaceId,
        string memory _metadataHash,
        uint48 _milestoneCount
    ) external {
        require(!appStorage.applicantGrant[msg.sender][_grant], "ApplicationSubmit: Already applied to grant once");
        IGrant grantRef = IGrant(_grant);
        require(grantRef.active(), "ApplicationSubmit: Invalid grant");
        uint96 _id = appStorage.applicationCount;
        assert(appStorage.applicationCount + 1 > appStorage.applicationCount);
        appStorage.applicationCount += 1;
        appStorage.applications[_id] = Application(
            _id,
            _workspaceId,
            _grant,
            msg.sender,
            _milestoneCount,
            0,
            _metadataHash,
            ApplicationState.Submitted
        );
        appStorage.applicantGrant[msg.sender][_grant] = true;
        emit ApplicationSubmitted(_id, _grant, msg.sender, _metadataHash, _milestoneCount, block.timestamp);
        grantRef.incrementApplicant();
    }

    /**
     * @notice Update application
     * @param _applicationId target applicationId which needs to be updated
     * @param _metadataHash updated application metadata pointer to IPFS file
     */
    function updateApplicationMetadata(
        uint96 _applicationId,
        string memory _metadataHash,
        uint48 _milestoneCount
    ) external {
        Application storage application = appStorage.applications[_applicationId];
        require(application.owner == msg.sender, "ApplicationUpdate: Unauthorised");
        require(
            application.state == ApplicationState.Resubmit || application.state == ApplicationState.Submitted,
            "ApplicationUpdate: Invalid state"
        );
        /// @dev we need to reset milestone state of all the milestones set previously
        for (uint48 i = 0; i < application.milestoneCount; i++) {
            appStorage.applicationMilestones[_applicationId][i] = MilestoneState.Submitted;
        }
        application.milestoneCount = _milestoneCount;
        application.metadataHash = _metadataHash;
        application.state = ApplicationState.Submitted;
        emit ApplicationUpdated(
            _applicationId,
            msg.sender,
            _metadataHash,
            ApplicationState.Submitted,
            _milestoneCount,
            block.timestamp
        );
    }

    /**
     * @notice Update application state
     * @param _applicationId target applicationId for which state needs to be updated
     * @param _workspaceId workspace id of application's grant
     * @param _state updated state
     * @param _reasonMetadataHash metadata file hash with state change reason
     */
    function updateApplicationState(
        uint96 _applicationId,
        uint96 _workspaceId,
        ApplicationState _state,
        string memory _reasonMetadataHash
    ) external onlyWorkspaceAdmin(_workspaceId) {
        Application storage application = appStorage.applications[_applicationId];
        require(application.workspaceId == _workspaceId, "ApplicationStateUpdate: Invalid workspace");
        /// @notice grant creator can only make below transitions
        /// @notice Submitted => Resubmit
        /// @notice Submitted => Approved
        /// @notice Submitted => Rejected
        if (
            (application.state == ApplicationState.Submitted && _state == ApplicationState.Resubmit) ||
            (application.state == ApplicationState.Submitted && _state == ApplicationState.Approved) ||
            (application.state == ApplicationState.Submitted && _state == ApplicationState.Rejected)
        ) {
            application.state = _state;
        } else {
            revert("ApplicationStateUpdate: Invalid state transition");
        }
        emit ApplicationUpdated(
            _applicationId,
            msg.sender,
            _reasonMetadataHash,
            _state,
            application.milestoneCount,
            block.timestamp
        );
    }

    /**
     * @notice Mark application as complete
     * @param _applicationId target applicationId which needs to be marked as complete
     * @param _workspaceId workspace id of application's grant
     * @param _reasonMetadataHash metadata file hash with application overall feedback
     */
    function completeApplication(
        uint96 _applicationId,
        uint96 _workspaceId,
        string memory _reasonMetadataHash
    ) external onlyWorkspaceAdmin(_workspaceId) {
        Application storage application = appStorage.applications[_applicationId];
        require(application.workspaceId == _workspaceId, "ApplicationStateUpdate: Invalid workspace");
        require(
            application.milestonesDone == application.milestoneCount,
            "CompleteApplication: Invalid milestones state"
        );

        application.state = ApplicationState.Complete;

        emit ApplicationUpdated(
            _applicationId,
            msg.sender,
            _reasonMetadataHash,
            ApplicationState.Complete,
            application.milestoneCount,
            block.timestamp
        );
    }

    /**
     * @notice Update application milestone state
     * @param _applicationId target applicationId for which milestone needs to be updated
     * @param _milestoneId target milestoneId which needs to be updated
     * @param _reasonMetadataHash metadata file hash with state change reason
     */
    function requestMilestoneApproval(
        uint96 _applicationId,
        uint48 _milestoneId,
        string memory _reasonMetadataHash
    ) external {
        Application memory application = appStorage.applications[_applicationId];
        require(application.owner == msg.sender, "MilestoneStateUpdate: Unauthorised");
        require(application.state == ApplicationState.Approved, "MilestoneStateUpdate: Invalid application state");
        require(_milestoneId < application.milestoneCount, "MilestoneStateUpdate: Invalid milestone id");
        require(
            appStorage.applicationMilestones[_applicationId][_milestoneId] == MilestoneState.Submitted,
            "MilestoneStateUpdate: Invalid state transition"
        );
        appStorage.applicationMilestones[_applicationId][_milestoneId] = MilestoneState.Requested;
        emit MilestoneUpdated(
            _applicationId,
            _milestoneId,
            MilestoneState.Requested,
            _reasonMetadataHash,
            block.timestamp
        );
    }

    /**
     * @notice Update application milestone state
     * @param _applicationId target applicationId for which milestone needs to be updated
     * @param _milestoneId target milestoneId which needs to be updated
     * @param _workspaceId workspace id of application's grant
     * @param _reasonMetadataHash metadata file hash with state change reason
     */
    function approveMilestone(
        uint96 _applicationId,
        uint48 _milestoneId,
        uint96 _workspaceId,
        string memory _reasonMetadataHash
    ) external onlyWorkspaceAdmin(_workspaceId) {
        Application storage application = appStorage.applications[_applicationId];
        require(application.workspaceId == _workspaceId, "ApplicationStateUpdate: Invalid workspace");
        require(application.state == ApplicationState.Approved, "MilestoneStateUpdate: Invalid application state");
        require(_milestoneId < application.milestoneCount, "MilestoneStateUpdate: Invalid milestone id");
        MilestoneState currentState = appStorage.applicationMilestones[_applicationId][_milestoneId];
        /// @notice grant creator can only make below transitions
        /// @notice Submitted => Approved
        /// @notice Requested => Approved
        if (currentState == MilestoneState.Submitted || currentState == MilestoneState.Requested) {
            appStorage.applicationMilestones[_applicationId][_milestoneId] = MilestoneState.Approved;
        } else {
            revert("MilestoneStateUpdate: Invalid state transition");
        }

        application.milestonesDone += 1;

        emit MilestoneUpdated(
            _applicationId,
            _milestoneId,
            MilestoneState.Approved,
            _reasonMetadataHash,
            block.timestamp
        );
    }

    /**
     * @notice returns application owner
     * @param _applicationId applicationId for which owner is required
     * @return address of application owner
     */
    function getApplicationOwner(uint96 _applicationId) external view override returns (address) {
        Application memory application = appStorage.applications[_applicationId];
        return application.owner;
    }

    /**
     * @notice returns application workspace id
     * @param _applicationId applicationId for which owner is required
     * @return id of application's workspace
     */
    function getApplicationWorkspace(uint96 _applicationId) external view override returns (uint96) {
        Application memory application = appStorage.applications[_applicationId];
        return application.workspaceId;
    }
}
