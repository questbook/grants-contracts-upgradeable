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
import "hardhat/console.sol";

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
        uint96 numOfReviewersPerApplication;
    }

    struct RoundRobinNode {
        address reviewer;
        uint96 applicationsAssigned;
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

    /// @notice mapping to store which grants have auto-assigning of reviewers enabled
    mapping(address => bool) public isAutoAssigningEnabled;

    /// @notice mapping from grant address to reviewer address to the number of applications assigned to the reviewer
    mapping(address => mapping(address => uint96)) public reviewerAssignmentCounts;

    /// @notice mapping from grant address to list of reviewers
    mapping(address => address[]) public reviewers;

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
        address _reviewerAddress,
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
    ) public {
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

            if (_active[i]) {
                uint96 _assignmentCount = reviewerAssignmentCounts[_grantAddress][_reviewers[i]];
                assert(_assignmentCount + 1 > _assignmentCount);
                _assignmentCount += 1;
                reviewerAssignmentCounts[_grantAddress][_reviewers[i]] = _assignmentCount;
            }
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
     * @notice assigns reviewers in case of auto assign
     * @param _workspaceId Workspace id
     * @param _applicationId Application id
     * @param _grantAddress Grant address
     */
    function assignReviewersRoundRobin(
        uint96 _workspaceId,
        uint96 _applicationId,
        address _grantAddress
    ) public {
        require(
            applicationReg.getApplicationWorkspace(_applicationId) == _workspaceId,
            "AssignReviewers (Batch): Unauthorized"
        );
        require(_grantAddress != address(0), "AssignReviewers (Batch): Grant address is zero address");
        GrantReviewState storage grantReviewState = grantReviewStates[_grantAddress];
        address[] memory _reviewers = reviewers[_grantAddress];

        // Step - 1: Get the number of reviewers that need to be there per application
        uint96 numOfReviewersPerApplication = grantReviewState.numOfReviewersPerApplication;
        require(numOfReviewersPerApplication > 0, "AssignReviewers (Batch): Cannot assign reviewers");
        require(_reviewers.length > 0, "AssignReviewers (Batch): No reviewers assigned");

        // Step - 2: Get the number of applications associated with each reviewer.
        RoundRobinNode[] memory _assignmentCounts = new RoundRobinNode[](_reviewers.length);
        for (uint256 i = 0; i < _reviewers.length; i++) {
            _assignmentCounts[i] = RoundRobinNode(
                _reviewers[i],
                reviewerAssignmentCounts[_grantAddress][_reviewers[i]]
            );
        }

        // Step - 3: Sort the reviewers based on the number of applications they have been assigned.
        for (uint256 i = 0; i < _assignmentCounts.length; i++) {
            for (uint256 j = i + 1; j < _assignmentCounts.length; j++) {
                if (_assignmentCounts[i].applicationsAssigned > _assignmentCounts[j].applicationsAssigned) {
                    RoundRobinNode memory temp = _assignmentCounts[i];
                    _assignmentCounts[i] = _assignmentCounts[j];
                    _assignmentCounts[j] = temp;
                }
            }
        }

        // Step - 4: Filter out that number of reviewers from the list of reviewers from step - 1
        address[] memory _leastBusyReviewers = new address[](numOfReviewersPerApplication);
        bool[] memory _activeReviewers = new bool[](numOfReviewersPerApplication);
        for (uint256 i = 0; i < numOfReviewersPerApplication; i++) {
            _leastBusyReviewers[i] = _assignmentCounts[i].reviewer;
            _activeReviewers[i] = true;
        }

        // Step - 5: Assign the filtered list of reviewers to the application
        assignReviewers(_workspaceId, _applicationId, _grantAddress, _leastBusyReviewers, _activeReviewers);
    }

    /**
     * @notice auto assigns reviewers to all existing applications to a grant
     * @notice and enables it for all applications that come after it
     * @param _workspaceId Workspace id
     * @param _grantAddress Grant address
     * @param _reviewers Array of reviewer addresses
     * @param _active Array of boolean values indicating whether the reviewers are active or not
     * @param _numOfReviewersPerApplication Number of reviewers per application when auto assigning
     */
    function enableAutoAssignmentOfReviewers(
        uint96 _workspaceId,
        address _grantAddress,
        address[] memory _reviewers,
        bool[] memory _active,
        uint96 _numOfReviewersPerApplication
    ) public onlyWorkspaceAdmin(_workspaceId) {
        require(_numOfReviewersPerApplication > 0, "AutoAssignReviewers: Reviewers per application must be positive");

        IGrant grantRef = IGrant(_grantAddress);
        require(grantRef.workspaceId() == _workspaceId, "AutoAssignReviewers: Unauthorised");
        require(isAutoAssigningEnabled[_grantAddress] == false, "AutoAssignReviewers: Auto assignment already enabled");
        isAutoAssigningEnabled[_grantAddress] = true;

        uint96 trueCount = 0;
        for (uint256 i = 0; i < _active.length; i++) {
            if (_active[i]) {
                assert(trueCount + 1 > trueCount);
                trueCount += 1;
            }
        }
        require(trueCount >= _numOfReviewersPerApplication, "AutoAssignReviewers: Not enough reviewers selected");

        GrantReviewState storage grantReviewState = grantReviewStates[_grantAddress];
        grantReviewState.numOfReviewersPerApplication = _numOfReviewersPerApplication;

        address[] memory _activeReviewers = new address[](trueCount);
        uint256 j = 0;
        for (uint256 i = 0; i < trueCount; i++) {
            if (_active[i]) {
                _activeReviewers[j] = _reviewers[i];
                j += 1;
            }
        }

        reviewers[_grantAddress] = _activeReviewers;

        /// @notice Assign reviewers to already existing applications
        for (uint96 i = 0; i < grantRef.numApplicants(); i++) {
            assignReviewersRoundRobin(_workspaceId, i, _grantAddress);
        }
    }

    /**
     * @notice Submits a review for an application
     * @param _workspaceId Workspace id
     * @param _applicationId Application id
     * @param _grantAddress Grant address
     * @param _metadataHash IPFS hash of the review metadata
     */
    function submitReview(
        address _reviewerAddress,
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

        emit ReviewSubmitted(
            review.id,
            _reviewerAddress,
            _workspaceId,
            _applicationId,
            _grantAddress,
            _metadataHash,
            block.timestamp
        );
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

    /**
     * @notice Function to check is auto assigning has been enabled for a grant or not
     * @param _grantAddress Grant address
     */
    function hasAutoAssigningEnabled(address _grantAddress) external view returns (bool) {
        return isAutoAssigningEnabled[_grantAddress];
    }
}
