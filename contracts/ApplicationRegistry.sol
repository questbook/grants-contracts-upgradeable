// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IWorkspaceRegistry.sol";
import "./interfaces/IGrant.sol";
import "./interfaces/IApplicationRegistry.sol";

/// @title Registry for all the grant applications used for updates on application
/// and requesting funds/milestone approvals
contract ApplicationRegistry is Ownable, Pausable, IApplicationRegistry {
    /// @notice Number of applications submitted
    uint96 public applicationCount;

    /// @notice possible states of an application milestones
    enum MilestoneState {
        Submitted,
        Requested,
        Approved
    }

    /// @notice possible states of an application
    enum ApplicationState {
        Submitted,
        Resubmit,
        Approved,
        Rejected,
        Complete
    }

    /// @notice types of reward disbursals
    enum DisbursalType {
        LockedAmount,
        P2P
    }

    /// @notice structure holding each application data
    struct Application {
        uint96 id;
        uint96 workspaceId;
        address grant;
        address owner;
        uint48 milestoneCount;
        string metadataHash;
        ApplicationState state;
        bool milestonesDone;
    }

    /// @notice mapping to store applicationId along with application
    mapping(uint96 => Application) public applications;

    /// @dev mapping to store application owner along with grant address
    /// ex: for application id - 0, grant addr - 0x0
    /// applicantGrant[0][0x0] will be = true, this is used to prevent duplicate entry
    mapping(address => mapping(address => bool)) private applicantGrant;

    /// @notice mapping to store applicationId along with milestones
    mapping(uint96 => mapping(uint48 => MilestoneState)) public applicationMilestones;

    /// @notice interface for using external functionalities like checking workspace admin
    IWorkspaceRegistry public workspaceReg;

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
        require(workspaceReg.isWorkspaceAdmin(_workspaceId, msg.sender), "Unauthorised: Not an admin");
        _;
    }

    /**
     * @notice sets workspace registry contract interface
     * @param _workspaceReg WorkspaceRegistry interface
     */
    function setWorkspaceReg(IWorkspaceRegistry _workspaceReg) external onlyOwner whenNotPaused {
        workspaceReg = _workspaceReg;
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
    ) external whenNotPaused {
        require(!applicantGrant[msg.sender][_grant], "ApplicationSubmit: Already applied to grant once");
        IGrant grantRef = IGrant(_grant);
        require(grantRef.active(), "ApplicationSubmit: Invalid grant");
        uint96 _id = applicationCount;
        assert(applicationCount + 1 > applicationCount);
        applicationCount += 1;
        applications[_id] = Application(
            _id,
            _workspaceId,
            _grant,
            msg.sender,
            _milestoneCount,
            _metadataHash,
            ApplicationState.Submitted,
            false
        );
        applicantGrant[msg.sender][_grant] = true;
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
    ) external whenNotPaused {
        Application storage application = applications[_applicationId];
        require(application.owner == msg.sender, "ApplicationUpdate: Unauthorised");
        require(application.state == ApplicationState.Resubmit, "ApplicationUpdate: Invalid state");
        /// @dev we need to reset milestone state of all the milestones set previously
        for (uint48 i = 0; i < application.milestoneCount; i++) {
            applicationMilestones[_applicationId][i] = MilestoneState.Submitted;
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
    ) external whenNotPaused onlyWorkspaceAdmin(_workspaceId) {
        Application storage application = applications[_applicationId];
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
    ) external whenNotPaused onlyWorkspaceAdmin(_workspaceId) {
        Application storage application = applications[_applicationId];
        require(application.milestonesDone, "CompleteApplication: Invalid milestione state");

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
    ) external whenNotPaused {
        Application memory application = applications[_applicationId];
        require(application.owner == msg.sender, "MilestoneStateUpdate: Unauthorised");
        require(application.state == ApplicationState.Approved, "MilestoneStateUpdate: Invalid application state");
        require(_milestoneId < application.milestoneCount, "MilestoneStateUpdate: Invalid milestone id");
        require(
            applicationMilestones[_applicationId][_milestoneId] == MilestoneState.Submitted,
            "MilestoneStateUpdate: Invalid state transition"
        );
        applicationMilestones[_applicationId][_milestoneId] = MilestoneState.Requested;
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
     * @param _disbursalType 0 if disbursal from locked amount, 1 if P2P disbursal
     * @param _disbursalAsset address of erc20 asset for disbursal
     * @param _disbursalAmount amount to be disbursed
     */
    function approveMilestone(
        uint96 _applicationId,
        uint48 _milestoneId,
        uint96 _workspaceId,
        string memory _reasonMetadataHash,
        DisbursalType _disbursalType,
        IERC20 _disbursalAsset,
        uint256 _disbursalAmount
    ) external whenNotPaused onlyWorkspaceAdmin(_workspaceId) {
        Application storage application = applications[_applicationId];
        require(application.state == ApplicationState.Approved, "MilestoneStateUpdate: Invalid application state");
        require(_milestoneId < application.milestoneCount, "MilestoneStateUpdate: Invalid milestone id");
        MilestoneState currentState = applicationMilestones[_applicationId][_milestoneId];
        /// @notice grant creator can only make below transitions
        /// @notice Submitted => Approved
        /// @notice Requested => Approved
        if (currentState == MilestoneState.Submitted || currentState == MilestoneState.Requested) {
            applicationMilestones[_applicationId][_milestoneId] = MilestoneState.Approved;
        } else {
            revert("MilestoneStateUpdate: Invalid state transition");
        }

        if (_milestoneId == (application.milestoneCount - 1)) {
            application.milestonesDone = true;
        }

        emit MilestoneUpdated(
            _applicationId,
            _milestoneId,
            MilestoneState.Approved,
            _reasonMetadataHash,
            block.timestamp
        );

        /// @notice disburse reward
        if (_disbursalAmount > 0) {
            IGrant grantRef = IGrant(application.grant);
            if (_disbursalType == DisbursalType.LockedAmount) {
                grantRef.disburseReward(
                    _applicationId,
                    _milestoneId,
                    address(_disbursalAsset),
                    _disbursalAmount,
                    msg.sender
                );
            } else if (_disbursalType == DisbursalType.P2P) {
                grantRef.disburseRewardP2P(
                    _applicationId,
                    _milestoneId,
                    address(_disbursalAsset),
                    _disbursalAmount,
                    msg.sender
                );
            } else {
                revert("MilestoneStateUpdate: Invalid disbursal type");
            }
        }
    }

    /**
     * @notice returns application owner
     * @param _applicationId applicationId for which owner is required
     * @return address of application owner
     */
    function getApplicationOwner(uint96 _applicationId) external view override returns (address) {
        Application memory application = applications[_applicationId];
        return application.owner;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
