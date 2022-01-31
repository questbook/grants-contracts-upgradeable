// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;
import "hardhat/console.sol";

interface IWorkspaceRegistry {
    function isWorkspaceAdmin(uint96 _id, address _member) external view returns (bool);
}

interface IGrant {
    function active() external view returns (bool);

    function incrementApplicant() external;

    function disburseReward(
        uint96 _applicationId,
        uint96 _milestoneId,
        address _asset,
        uint256 _amount
    ) external payable;

    function disburseRewardP2P(
        uint96 _applicationId,
        uint96 _milestoneId,
        address _asset,
        uint256 _amount
    ) external payable;
}

contract ApplicationRegistry {
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
        Rejected
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
    }

    /// @notice mapping to store applicationId along with application
    mapping(uint96 => Application) public applications;

    /// @notice mapping to store applicationId along with milestones
    mapping(uint96 => mapping(uint48 => MilestoneState)) public applicationMilestones;

    /// @notice contract deployer
    address public owner;

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

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice sets workspace registry contract interface
     * @param _workspaceRegAddr WorkspaceRegistry contract address
     */
    function setWorkspaceReg(address _workspaceRegAddr) external {
        require(msg.sender == owner, "Not authorised");
        workspaceReg = IWorkspaceRegistry(_workspaceRegAddr);
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
        IGrant grantRef = IGrant(_grant);
        require(grantRef.active(), "ApplicationSubmit: Invalid grant");
        uint96 _id = applicationCount;
        grantRef.incrementApplicant();
        applications[_id] = Application(
            _id,
            _workspaceId,
            _grant,
            msg.sender,
            _milestoneCount,
            _metadataHash,
            ApplicationState.Submitted
        );
        for (uint48 i = 0; i < _milestoneCount; i++) {
            applicationMilestones[_id][i] = MilestoneState.Submitted;
        }
        emit ApplicationSubmitted(_id, _grant, msg.sender, _metadataHash, _milestoneCount, block.timestamp);
        applicationCount += 1;
    }

    /**
     * @notice Update application
     * @param _id target applicationId which needs to be updated
     * @param _metadataHash updated application metadata pointer to IPFS file
     */
    function updateApplicationMetadata(
        uint96 _id,
        string memory _metadataHash,
        uint48 _milestoneCount
    ) external {
        Application storage application = applications[_id];
        require(application.owner == msg.sender, "ApplicationUpdate: Unauthorised");
        if (application.state == ApplicationState.Submitted || application.state == ApplicationState.Approved) {
            revert("ApplicationUpdate: Invalid state");
        }
        for (uint48 i = 0; i < _milestoneCount; i++) {
            applicationMilestones[_id][i] = MilestoneState.Submitted;
        }
        application.milestoneCount = _milestoneCount;
        application.metadataHash = _metadataHash;
        application.state = ApplicationState.Submitted;
        emit ApplicationUpdated(
            _id,
            msg.sender,
            _metadataHash,
            ApplicationState.Submitted,
            _milestoneCount,
            block.timestamp
        );
    }

    /**
     * @notice Update application state
     * @param _id target applicationId for which state needs to be updated
     * @param _state updated state
     * @param _metadataHash IPFS file where state change reason is stored
     */
    function updateApplicationState(
        uint96 _id,
        ApplicationState _state,
        string memory _metadataHash
    ) external {
        Application storage application = applications[_id];
        if (msg.sender == application.owner) {
            /// @notice applicant can only make below transitions
            /// @notice Resubmit => Submitted
            /// @notice Rejected => Submitted
            if (
                (application.state == ApplicationState.Resubmit && _state == ApplicationState.Submitted) ||
                (application.state == ApplicationState.Rejected && _state == ApplicationState.Submitted)
            ) {} else {
                revert("ApplicationStateUpdate: Invalid state transition");
            }
        } else if (workspaceReg.isWorkspaceAdmin(application.workspaceId, msg.sender)) {
            /// @notice grant creator can only make below transitions
            /// @notice Submitted => Resubmit
            /// @notice Submitted => Approved
            /// @notice Submitted => Rejected
            if (
                (application.state == ApplicationState.Submitted && _state == ApplicationState.Resubmit) ||
                (application.state == ApplicationState.Submitted && _state == ApplicationState.Approved) ||
                (application.state == ApplicationState.Submitted && _state == ApplicationState.Rejected)
            ) {} else {
                revert("ApplicationStateUpdate: Invalid state transition");
            }
        } else {
            revert("ApplicationStateUpdate: Unauthorised");
        }
        application.state = _state;
        application.metadataHash = _metadataHash;
        emit ApplicationUpdated(
            _id,
            msg.sender,
            application.metadataHash,
            _state,
            application.milestoneCount,
            block.timestamp
        );
    }

    /**
     * @notice Update application milestone state
     * @param _id target applicationId for which milestone needs to be updated
     * @param _milestoneId target milestoneId which needs to be updated
     * @param _state updated milestone state
     * @param _metadataHash updated milestone metadata pointer to IPFS file
     * @param _disbursalType 0 if disbursal from locked amount, 1 if P2P disbursal
     * @param _disbursalAsset address of erc20 asset for disbursal
     * @param _disbursalAmount amount to be disbursed
     */
    function updateApplicationMilestone(
        uint96 _id,
        uint48 _milestoneId,
        MilestoneState _state,
        string memory _metadataHash,
        uint256 _disbursalType,
        address _disbursalAsset,
        uint256 _disbursalAmount
    ) external {
        Application memory application = applications[_id];
        require(application.state == ApplicationState.Approved, "MilestoneStateUpdate: Invalid application state");
        MilestoneState currentState = applicationMilestones[_id][_milestoneId];
        if (msg.sender == application.owner) {
            /// @notice applicant can only make below transitions
            /// @notice Submitted => Requested
            if ((currentState == MilestoneState.Submitted && _state == MilestoneState.Requested)) {} else {
                revert("MilestoneStateUpdate: Invalid state transition");
            }
        } else if (workspaceReg.isWorkspaceAdmin(application.workspaceId, msg.sender)) {
            /// @notice grant creator can only make below transitions
            /// @notice Submitted => Approved
            /// @notice Requested => Approved
            if (
                (currentState == MilestoneState.Submitted && _state == MilestoneState.Approved) ||
                (currentState == MilestoneState.Requested && _state == MilestoneState.Approved)
            ) {} else {
                revert("MilestoneStateUpdate: Invalid state transition");
            }
        } else {
            revert("MilestoneStateUpdate: Unauthorised");
        }
        applicationMilestones[_id][_milestoneId] = _state;
        application.metadataHash = _metadataHash;

        /// @notice disburse reward along with updating milestone
        if (_disbursalAmount > 0) {
            IGrant grantRef = IGrant(application.grant);
            if (_disbursalType == 1) {
                grantRef.disburseReward(_id, _milestoneId, _disbursalAsset, _disbursalAmount);
            } else if (_disbursalType == 2) {
                grantRef.disburseRewardP2P(_id, _milestoneId, _disbursalAsset, _disbursalAmount);
            }
        }

        emit MilestoneUpdated(_id, _milestoneId, _state, _metadataHash, block.timestamp);
    }

    /**
     * @notice returns application owner
     * @param _applicationId applicationId for which owner is required
     */
    function getApplicationOwner(uint96 _applicationId) external view returns (address) {
        Application memory application = applications[_applicationId];
        return application.owner;
    }

    /**
     * @notice update owner of contract
     * @param _newOwner address of new owner
     */
    function setContractOwner(address _newOwner) external {
        require(msg.sender == owner, "Not authorised");
        owner = _newOwner;
    }
}
