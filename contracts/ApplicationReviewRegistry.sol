// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IWorkspaceRegistry.sol";
import "./interfaces/IApplicationRegistry.sol";
import "./interfaces/IGrantFactory.sol";
import "./interfaces/IGrant.sol";

contract ApplicationReviewRegistry is Initializable, UUPSUpgradeable, OwnableUpgradeable {
    struct Review {
        uint96 id;
        uint96 workspaceId;
        uint96 applicationId;
        address grant;
        address reviewer;
        string metadataHash;
        bool active;
    }

    struct GrantReviewState {
        address grant;
        uint96 workspaceId;
        uint96 numOfReviews;
        string rubricsMetadataHash;

        /// @notice list of reviewers who have been assigned to a grant
        /// if list non empty => grant auto assigning is enabled
        address[] reviewersAvailable;
        /// @notice number of reviewers required per application
        uint8 numOfReviewersPerApplication;
    }

    struct AssignedReviewerLoad {
        bool exists;
        uint64 totalApplicationsAssigned;
    }

    /// @notice workspaceRegistry interface used for fetching fetching workspace admins and reviewers
    IWorkspaceRegistry public workspaceReg;

    /// @notice grantFactory interface used for authoriziing Grant Factory
    IGrantFactory public grantFactory;

    /// @notice applicationRegistry interface used for fetching application workspace id
    IApplicationRegistry public applicationReg;

    /// @notice Number of reviews submitted
    uint96 public reviewCount;

    /// @notice mapping to store reviewer address vs applicationId vs review
    mapping(address => mapping(uint96 => Review)) public reviews;

    /// @notice mapping to store grant address vs grant review state
    mapping(address => GrantReviewState) public grantReviewStates;

    /// @notice mapping to store review id vs review payment status
    mapping(uint96 => bool) public reviewPaymentsStatus;

    /// @notice mapping from workspace ID to number of applications assigned to each reviewer
    mapping(uint96 => mapping(address => AssignedReviewerLoad)) public assignedReviewers;

    // --- Events ---
    /// @notice Emitted when reviewers are assigned
    event ReviewersAssigned(
        uint96[] indexed _reviewIds,
        uint96 _workspaceId,
        uint96 _applicationId,
        address _grantAddress,
        address[] _reviewers,
        bool[] _active,
        uint256 time
    );

    /// @notice Emitted when a new review is submitted
    event ReviewSubmitted(
        uint96 indexed _reviewId,
        uint96 _workspaceId,
        uint96 _applicationId,
        address _grantAddress,
        string _metadataHash,
        uint256 time
    );

    /// @notice Emitted when rubric metadata is set
    event RubricsSet(uint96 _workspaceId, address indexed _grantAddress, string _metadataHash, uint256 time);

    /// @notice Emitted when review payment is marked as done
    event ReviewPaymentMarkedDone(
        uint96[] _reviewIds,
        address _asset,
        address _reviewer,
        uint256 _amount,
        string _transactionHash,
        uint256 time
    );

    /// @notice Emitted when review payment is fulfilled
    event ReviewPaymentFulfilled(
        uint96[] _reviewIds,
        address _asset,
        address _sender,
        address _reviewer,
        uint256 _amount,
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

    modifier onlyWorkspaceAdminOrGrantFactory(uint96 _workspaceId) {
        require(
            workspaceReg.isWorkspaceAdmin(_workspaceId, msg.sender) || msg.sender == address(grantFactory),
            "Unauthorised: Not an admin nor grantFactory"
        );
        _;
    }

    /**
     * @notice Calls initialize on the base contracts
     *
     * @dev This acts as a constructor for the upgradeable proxy contract
     */
    function initialize() external initializer {
        __Ownable_init();
    }

    /**
     * @notice Override of UUPSUpgradeable virtual function
     *
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(address) internal view override onlyOwner {}

    /**
     * @notice sets workspace registry contract interface
     * @param _workspaceReg WorkspaceRegistry interface
     */
    function setWorkspaceReg(IWorkspaceRegistry _workspaceReg) external onlyOwner {
        workspaceReg = _workspaceReg;
    }

    /**
     * @notice sets grant factory contract interface
     * @param _grantFactory GrantFactory contract address
     */
    function setGrantFactory(IGrantFactory _grantFactory) external onlyOwner {
        grantFactory = _grantFactory;
    }

    /**
     * @notice sets application registry contract interface
     * @param _applicationReg ApplicationRegistry contract address
     */
    function setApplicationReg(IApplicationRegistry _applicationReg) external onlyOwner {
        applicationReg = _applicationReg;
    }

    /**
     * @notice assigns/unassign reviewers to an application
     * @param _workspaceId Workspace id
     * @param _applicationId Application id
     * @param _grantAddress Grant address
     * @param _reviewers Array of reviewer addresses
     * @param _active Array of boolean values indicating whether the reviewers are active or not
     */
    function assignReviewers(
        uint96 _workspaceId,
        uint96 _applicationId,
        address _grantAddress,
        address[] memory _reviewers,
        bool[] memory _active
    ) public onlyWorkspaceAdmin(_workspaceId) {
        require(applicationReg.getApplicationWorkspace(_applicationId) == _workspaceId, "AssignReviewer: Unauthorized");
        require(_reviewers.length == _active.length, "AssignReviewer: Parameters length mismatch");
        uint96[] memory _reviewIds = new uint96[](_reviewers.length);

        for (uint256 i = 0; i < _reviewers.length; i++) {
            require(_reviewers[i] != address(0), "AssignReviewer: Reviewer is zero address");

            Review memory review = reviews[_reviewers[i]][_applicationId];

            if (_hasSubmittedReview(review.metadataHash) && !_active[i]) {
                revert("AssignReviewer: Review already submitted");
            }

            uint96 _id;
            if (review.reviewer == address(0)) {
                _id = reviewCount;
                assert(reviewCount + 1 > reviewCount);
                reviewCount += 1;
            } else {
                _id = review.id;
            }

            _reviewIds[i] = _id;
            reviews[_reviewers[i]][_applicationId] = Review(
                _id,
                _workspaceId,
                _applicationId,
                _grantAddress,
                _reviewers[i],
                "",
                _active[i]
            );
        }

        emit ReviewersAssigned(
            _reviewIds,
            _workspaceId,
            _applicationId,
            _grantAddress,
            _reviewers,
            _active,
            block.timestamp
        );
    }

    /**
     * @notice Submits a review for an application
     * @param _workspaceId Workspace id
     * @param _applicationId Application id
     * @param _grantAddress Grant address
     * @param _metadataHash IPFS hash of the review metadata
     */
    function submitReview(
        uint96 _workspaceId,
        uint96 _applicationId,
        address _grantAddress,
        string memory _metadataHash
    ) public onlyWorkspaceAdminOrReviewer(_workspaceId) {
        Review storage review = reviews[msg.sender][_applicationId];
        GrantReviewState storage grantReviewState = grantReviewStates[_grantAddress];

        require(review.workspaceId == _workspaceId, "ReviewSubmit: Unauthorised");
        require(review.active, "ReviewSubmit: Revoked access");

        if (!_hasSubmittedReview(review.metadataHash)) {
            grantReviewState.numOfReviews += 1;
        }

        review.metadataHash = _metadataHash;

        // subtract number of applications this reviewer is assignment
        AssignedReviewerLoad storage load = assignedReviewers[_workspaceId][msg.sender];
        if(load.totalApplicationsAssigned > 0) {
            load -= 1;
        }

        emit ReviewSubmitted(review.id, _workspaceId, _applicationId, _grantAddress, _metadataHash, block.timestamp);
    }

    /**
     * @notice Sets the rubrics metadata hash for a grant, only callable by Admin of the workspace
     * @param _workspaceId Workspace id
     * @param _grantAddress Grant address
     * @param _metadataHash IPFS hash of the rubrics metadata
     */
    function setRubrics(
        uint96 _workspaceId,
        address _grantAddress,
        string memory _metadataHash
    ) external onlyWorkspaceAdminOrGrantFactory(_workspaceId) {
        GrantReviewState storage grantReviewState = grantReviewStates[_grantAddress];

        require(IGrant(_grantAddress).workspaceId() == _workspaceId, "RubricsSet: Unauthorised");
        require(grantReviewState.numOfReviews == 0, "RubricsSet: Reviews non-zero");

        grantReviewState.rubricsMetadataHash = _metadataHash;
        grantReviewState.workspaceId = _workspaceId;
        grantReviewState.grant = _grantAddress;

        emit RubricsSet(_workspaceId, _grantAddress, _metadataHash, block.timestamp);
    }

    /**
     * @notice Sets if a grant is available for auto assignment (only available for admins)
     * @param _grantAddress grant to disable/enable auto assignment
     * @param _reviewersAvailable list of reviewers available for auto assignment, pass empty to diable auto assignment
     */
    function setAutoAssignment(
        address _grantAddress,
        address[] _reviewersAvailable,
        uint8 _numOfReviewersPerApplication,
    ) external {
        uint96 workspaceId = IGrant(_grantAddress).workspaceId();
        // assert msg.sender is admin of workspace
        require(workspaceReg.isAdmin(workspaceId, msg.sender), "SetAutoAssignment: Unauthorized");
        GrantReviewState storage grantReviewState = grantReviewStates[_grantAddress];
        // check grant actually exists in our map
        require(grantReviewState.grant != address(0), "Grant does not exist");
        grantReviewState.reviewersAvailable = _reviewersAvailable;
        if(_reviewersAvailable.length > 0) {
            require(_reviewersAvailable >= _numOfReviewersPerApplication, "Expected number of reviewers per app > 0");
        }
        grantReviewState.numOfReviewersPerApplication = _numOfReviewersPerApplication;
        // TODO: fetch all applications of the grant & call autoAssignApplicationIfRequired()
        // TODO: auto assignment event
    }

    function autoAssignApplicationIfRequired(uint96 _applicationId) external {
        uint96 workspaceId = applicationReg.getApplicationWorkspace(_applicationId);
        address grant = applicationReg.getApplicationGrant(_applicationId);
        // assert msg.sender is admin of workspace or grant factory itself
        require(
            workspaceReg.isAdmin(workspaceId, msg.sender) || msg.sender == _grantAddress,
            "DidReceiveApplication: Unauthorized"
        );

        GrantReviewState storage grantReviewState = grantReviewStates[_grantAddress];
        address[] storage reviewersAvailable = grantReviewState.reviewersAvailable;
        // reviewers we need to assign
        uint8 reviewersToAssign = grantReviewState.numOfReviewersPerApplication;
        // TODO: check how many reviewers already assigned to this app
        // we have auto assignment enabled for this grant
        // and we need to assign some number of reviewers
        if(reviewersAvailable.length > 0 && reviewersToAssign > 0) {
            // the list of the reviewers that will be assigned to this application
            address[] memory reviewersToAssignList = new address[](reviewersToAssign);
            bool[] memory redundantActiveList = new bool[](reviewersToAssign);

            address leastAssignedReviewer = reviewersAvailable[0];
            for(uint64 i = 1;i < reviewersAvailable.length;i++) {
                uint64 thisReviewerCount =
                    assignedReviewers[workspaceId][reviewersAvailable[i]].totalApplicationsAssigned;
                uint64 leastAssignedReviewerCount =
                    assignedReviewers[workspaceId][leastAssignedReviewer].totalApplicationsAssigned;
                if(
                    thisReviewerCount < leastAssignedReviewerCount
                    && !_isAssignedToReviewer(reviewersAvailable[i], _applicationId)
                ) {
                    leastAssignedReviewer = reviewersAvailable[i];
                }
            }
            // actually load balance and assign
            AssignedReviewerLoad storage load = assignedReviewers[_workspaceId][leastAssignedReviewer];
            load.totalApplicationsAssigned += 1;
            // store back in map if didn't exist before
            if(!load.exists) {
                load.exists = true;
                assignedReviewers[_workspaceId][leastAssignedReviewer] = load;
            }

            // TODO: append to array

            assignReviewers(workspaceId, applicationId, grant, reviewersToAssignList, redundantActiveList);
        }
    }

    /**
     * @notice Mark payment as done of a review, only callable by Admin of the workspace
     * @param _workspaceId Workspace id
     * @param _applicationIds Array of Application ids
     * @param _reviewer Address of the reviewer
     * @param _reviewIds Array of review ids
     * @param _erc20Interface interface for erc20 asset using which payment is done
     * @param _amount Amount of the payment
     * @param _transactionHash Transaction hash of the payment
     */
    function markPaymentDone(
        uint96 _workspaceId,
        uint96[] memory _applicationIds,
        address _reviewer,
        uint96[] memory _reviewIds,
        IERC20 _erc20Interface,
        uint256 _amount,
        string memory _transactionHash
    ) public onlyWorkspaceAdmin(_workspaceId) {
        require(_reviewIds.length == _applicationIds.length, "ChangePaymentStatus: Parameters length mismatch");

        for (uint256 i = 0; i < _reviewIds.length; i++) {
            Review memory review = reviews[_reviewer][_applicationIds[i]];
            require(review.workspaceId == _workspaceId, "ChangePaymentStatus: Unauthorised");
            reviewPaymentsStatus[_reviewIds[i]] = true;
        }
        emit ReviewPaymentMarkedDone(
            _reviewIds,
            address(_erc20Interface),
            _reviewer,
            _amount,
            _transactionHash,
            block.timestamp
        );
    }

    /**
     * @notice Fulfill payment for reviews to reviewer, only callable by Admin of the workspace
     * @param _workspaceId Workspace id
     * @param _applicationIds Array of Application ids
     * @param _reviewer Address of the reviewer
     * @param _reviewIds Array of review ids
     * @param _erc20Interface interface for erc20 asset using which payment is done
     * @param _amount Amount to be paid
     */
    function fulfillPayment(
        uint96 _workspaceId,
        uint96[] memory _applicationIds,
        address _reviewer,
        uint96[] memory _reviewIds,
        IERC20 _erc20Interface,
        uint256 _amount
    ) external onlyWorkspaceAdmin(_workspaceId) {
        markPaymentDone(_workspaceId, _applicationIds, _reviewer, _reviewIds, _erc20Interface, _amount, "");
        require(_erc20Interface.transferFrom(msg.sender, _reviewer, _amount), "Failed to transfer funds");
        emit ReviewPaymentFulfilled(
            _reviewIds,
            address(_erc20Interface),
            msg.sender,
            _reviewer,
            _amount,
            block.timestamp
        );
    }

    /// @notice check if reviewer is already assigned to an application
    function _isAssignedToApplication(address reviewer, uint96 applicationId) internal view returns (bool) {
        return reviews[reviewer][applicationId].active;
    }

    /**
     * @notice Internal function to check if a review has been submitted
     * @param _metadataHash IPFS hash of the review metadata
     * @return bool true if review has been submitted, false otherwise
     *
     * @dev Just checks the length of the metadata hash, if it is not 0, then it has been submitted
     */
    function _hasSubmittedReview(string memory _metadataHash) internal pure returns (bool) {
        bytes memory metadataHashBytes = bytes(_metadataHash);
        return (metadataHashBytes.length != 0);
    }
}
