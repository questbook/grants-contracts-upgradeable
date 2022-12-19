// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IWorkspaceRegistry.sol";
import "./interfaces/IApplicationRegistry.sol";
import "./interfaces/IApplicationReviewRegistry.sol";
import "./interfaces/IGrantFactory.sol";
import "./interfaces/IGrant.sol";
import "hardhat/console.sol";

// import "./libraries/IterableMapping.sol";

contract ApplicationReviewRegistry is Initializable, UUPSUpgradeable, OwnableUpgradeable, IApplicationReviewRegistry {
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

    /// @notice mapping from grant address to list of applications
    mapping(address => uint96[]) public applicationsToGrant;

    /// @notice mapping from grant address to index of the last reviewer assigned
    mapping(address => uint256) public lastAssignedReviewerIndices;

    /// @notice auxillary map to store reviewer assignment count while auto assigning
    mapping(address => uint96) private _reviewerCount;

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

    /// @notice Emitted when the reviewer of a review has been updated
    event ReviewMigrate(
        uint96 indexed _reviewId,
        uint96 _applicationId,
        address _previousReviewerAddress,
        address _newReviewerAddress,
        uint256 time
    );

    /// @notice Emitted when rubric metadata is set
    event RubricsSet(uint96 _workspaceId, address indexed _grantAddress, string _metadataHash, uint256 time);

    /// @notice Emitted when rubric metadata and number of reviewers is set
    event RubricsSetV2(
        uint96 _workspaceId,
        address indexed _grantAddress,
        uint96 _numberOfReviewersPerApplication,
        string _metadataHash,
        uint256 time
    );

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

    event AutoAssignmentUpdated(
        uint96 _workspaceId,
        address _grantAddress,
        address[] _reviewers,
        uint96 _numberOfReviewersPerApplication,
        bool _enabled,
        address _updatedBy,
        uint256 time
    );

    event ReviewerDataReset(uint96 _workspaceId, address _grantAddress, address _resetBy, uint256 time);

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
     * @notice Migrate the user's wallet to a new address
     *
     * @param fromWallet Current wallet address of the user
     * @param toWallet The new wallet address to migrate to
     * @param appId Application ID to migrate
     */
    function migrateWallet(
        address fromWallet,
        address toWallet,
        uint96 appId
    ) external override {
        require(
            msg.sender == fromWallet || msg.sender == address(applicationReg) || msg.sender == owner(),
            "Only ApplicationRegistry/owner/fromWallet can call"
        );

        Review storage review = reviews[fromWallet][appId];
        // execute migration if the application was assigned to the fromWallet
        if (review.reviewer == fromWallet) {
            uint96 existing = reviewerAssignmentCounts[review.grant][fromWallet];
            if (existing > 1) {
                // update wallet address in the reviewerAssignmentCounts
                reviewerAssignmentCounts[review.grant][fromWallet] = existing - 1;
            } else if (existing == 1) {
                delete reviewerAssignmentCounts[review.grant][fromWallet];
            }

            reviewerAssignmentCounts[review.grant][toWallet] += 1;

            // update wallet address in the auto-assign reviewers for the grant
            address[] storage grantReviewers = reviewers[review.grant];
            for (uint96 i = 0; i < grantReviewers.length; i++) {
                if (grantReviewers[i] == fromWallet) {
                    grantReviewers[i] = toWallet;
                    break;
                }
            }

            // update wallet address in the review
            review.reviewer = toWallet;
            reviews[toWallet][appId] = review;
            delete reviews[fromWallet][appId];

            emit ReviewMigrate(review.id, appId, fromWallet, toWallet, block.timestamp);
        }
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
    ) public override {
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

        // Step - 2: Get the index of the last assigned reviewer
        address[] memory _leastBusyReviewers = new address[](numOfReviewersPerApplication);
        bool[] memory _activeReviewers = new bool[](numOfReviewersPerApplication);
        uint256 lastIndex = lastAssignedReviewerIndices[_grantAddress];
        for (uint256 i = 0; i < numOfReviewersPerApplication; i++) {
            _leastBusyReviewers[i] = _reviewers[lastIndex];
            _activeReviewers[i] = true;
            lastIndex++;
            if (lastIndex > _reviewers.length - 1) {
                lastIndex = 0;
            }
        }
        lastAssignedReviewerIndices[_grantAddress] = lastIndex;

        // Step - 3: Assign the filtered list of reviewers to the application
        assignReviewers(_workspaceId, _applicationId, _grantAddress, _leastBusyReviewers, _activeReviewers);
    }

    function binarySearchApplication(uint96[] memory _applications, uint96 _applicationId)
        private
        pure
        returns (uint256)
    {
        uint256 low = 0;
        uint256 high = _applications.length - 1;

        while (low <= high) {
            uint256 mid = low + (high - low) / 2;
            if (_applications[mid] == _applicationId) {
                return mid;
            } else if (_applications[mid] < _applicationId) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return _applications.length;
    }

    /**
     * @notice auto assigns reviewers to all existing applications to a grant
     * @notice and enables it for all applications that come after it
     * @param _workspaceId Workspace id
     * @param _grantAddress Grant address
     * @param _reviewers Array of reviewer addresses
     * @param _applications Array of application ids
     * @param _applicationsPerReviewer Array of application ids per reviewer
     * @param _numOfReviewersPerApplication Number of reviewers per application when auto assigning
     */
    function enableAutoAssignmentOfReviewers(
        uint96 _workspaceId,
        address _grantAddress,
        address[] memory _reviewers,
        uint96[] memory _applications,
        uint96[][] memory _applicationsPerReviewer,
        uint96 _numOfReviewersPerApplication
    ) private onlyWorkspaceAdmin(_workspaceId) {
        require(_numOfReviewersPerApplication > 0, "AutoAssignReviewers: Reviewers per application must be positive");

        IGrant grantRef = IGrant(_grantAddress);
        require(grantRef.workspaceId() == _workspaceId, "AutoAssignReviewers: Unauthorised");
        require(isAutoAssigningEnabled[_grantAddress] == false, "AutoAssignReviewers: Auto assignment already enabled");

        require(
            applicationReg.getApplicationWorkspace(_applications[0]) == _workspaceId,
            "AutoAssignReviewers: Unauthorised"
        );
        for (uint256 i = 1; i < _applications.length; i++) {
            require(
                applicationReg.getApplicationWorkspace(_applications[i]) == _workspaceId,
                "AutoAssignReviewers: Unauthorised"
            );
            require(
                _applications[i] > _applications[i - 1],
                "AutoAssignReviewers: Applications must be in ascending order"
            );
        }

        require(
            _reviewers.length >= _numOfReviewersPerApplication,
            "AutoAssignReviewers: Not enough reviewers selected"
        );

        for (uint256 i = 0; i < _reviewers.length; i++) {
            require(
                workspaceReg.isWorkspaceAdminOrReviewer(_workspaceId, _reviewers[i]),
                "AutoAssignReviewers: Unauthorised"
            );
        }

        isAutoAssigningEnabled[_grantAddress] = true;

        GrantReviewState storage grantReviewState = grantReviewStates[_grantAddress];
        grantReviewState.numOfReviewersPerApplication = _numOfReviewersPerApplication;
        reviewers[_grantAddress] = _reviewers;

        // generateAssignment(_reviewers, _applications, _applicationsPerReviewer, _numOfReviewersPerApplication);

        address[][] memory _reviewersForApplications = new address[][](_applications.length);
        uint256[] memory _reviewerIndex = new uint256[](_applications.length);

        for (uint256 i = 0; i < _applications.length; i++) {
            _reviewersForApplications[i] = new address[](_numOfReviewersPerApplication);
            _reviewerIndex[i] = 0;
        }

        for (uint256 i = 0; i < _applicationsPerReviewer.length; i++) {
            for (uint256 j = 0; j < _applicationsPerReviewer[i].length; j++) {
                uint256 index1 = binarySearchApplication(_applications, _applicationsPerReviewer[i][j]);
                require(index1 >= 0 && index1 < _applications.length, "Application not found");
                uint256 index2 = _reviewerIndex[index1];
                // console.log(_applicationsPerReviewer[i][j], index1, index2);
                _reviewersForApplications[index1][index2] = _reviewers[i];
                _reviewerIndex[index1] = index2 + 1;
            }
        }

        // for (uint256 i = 0; i < _reviewersForApplications.length; ++i) {
        //     for (uint256 j = 0; j < _reviewersForApplications[i].length; ++j) {
        //         console.log(_reviewersForApplications[i][j]);
        //     }
        //     console.log(" ");
        // }

        for (uint256 i = 0; i < _applications.length; i++) {
            bool[] memory _active = new bool[](_reviewersForApplications[i].length);
            for (uint256 j = 0; j < _reviewersForApplications[i].length; j++) {
                _active[j] = true;
            }

            assignReviewers(_workspaceId, _applications[i], _grantAddress, _reviewersForApplications[i], _active);
            console.log("Done for application: ", _applications[i]);
        }

        emit AutoAssignmentUpdated(
            _workspaceId,
            _grantAddress,
            _reviewers,
            _numOfReviewersPerApplication,
            true,
            msg.sender,
            block.timestamp
        );
    }

    function disableAutoAssignmentOfReviewers(uint96 _workspaceId, address _grantAddress)
        public
        onlyWorkspaceAdmin(_workspaceId)
    {
        IGrant grantRef = IGrant(_grantAddress);
        require(grantRef.workspaceId() == _workspaceId, "AutoAssignReviewers: Unauthorised");
        require(isAutoAssigningEnabled[_grantAddress] == true, "AutoAssignReviewers: Auto assignment already disabled");
        isAutoAssigningEnabled[_grantAddress] = false;

        GrantReviewState storage grantReviewState = grantReviewStates[_grantAddress];
        emit AutoAssignmentUpdated(
            _workspaceId,
            _grantAddress,
            reviewers[_grantAddress],
            grantReviewState.numOfReviewersPerApplication,
            false,
            msg.sender,
            block.timestamp
        );
    }

    function updateAutoAssignmentConfig(
        uint96 _workspaceId,
        address _grantAddress,
        address[] memory _reviewers,
        uint96 _numOfReviewersPerApplication,
        uint256 _type
    ) public onlyWorkspaceAdmin(_workspaceId) {
        IGrant grantRef = IGrant(_grantAddress);
        require(grantRef.workspaceId() == _workspaceId, "AutoAssignReviewers: Unauthorised");
        require(isAutoAssigningEnabled[_grantAddress] == true, "AutoAssignReviewers: Auto assignment not enabled");
        require(
            _reviewers.length >= grantReviewStates[_grantAddress].numOfReviewersPerApplication,
            "Not enough reviewers selected"
        );

        for (uint256 i = 0; i < _reviewers.length; i++) {
            require(
                workspaceReg.isWorkspaceAdminOrReviewer(_workspaceId, _reviewers[i]),
                "AutoAssignReviewers: Unauthorised"
            );
        }

        if (_type == 0) {
            reviewers[_grantAddress] = _reviewers;
        }

        GrantReviewState storage grantReviewState = grantReviewStates[_grantAddress];
        if (_type == 1) {
            grantReviewState.numOfReviewersPerApplication = _numOfReviewersPerApplication;
        }

        emit AutoAssignmentUpdated(
            _workspaceId,
            _grantAddress,
            reviewers[_grantAddress],
            grantReviewState.numOfReviewersPerApplication,
            true,
            msg.sender,
            block.timestamp
        );
    }

    function resetAllReviewerData(
        uint96 _workspaceId,
        address _grantAddress,
        address[] memory _reviewers,
        uint96[] memory _applications
    ) public onlyWorkspaceAdmin(_workspaceId) {
        IGrant grantRef = IGrant(_grantAddress);
        require(grantRef.workspaceId() == _workspaceId, "AutoAssignReviewers: Unauthorised");
        for (uint256 i = 0; i < _reviewers.length; i++) {
            require(
                workspaceReg.isWorkspaceAdminOrReviewer(_workspaceId, _reviewers[i]),
                "AutoAssignReviewers: Unauthorised"
            );
            for (uint256 j = 0; j < _applications.length; ++j) {
                require(
                    applicationReg.getApplicationWorkspace(_applications[i]) == _workspaceId,
                    "AutoAssignReviewers: Unauthorised"
                );
                delete reviews[_reviewers[i]][_applications[j]];
            }
        }

        isAutoAssigningEnabled[_grantAddress] = false;
        delete reviewers[_grantAddress];

        GrantReviewState storage grantReviewState = grantReviewStates[_grantAddress];
        grantReviewState.numOfReviewersPerApplication = 0;
        grantReviewState.numOfReviews = 0;

        emit ReviewerDataReset(_workspaceId, _grantAddress, msg.sender, block.timestamp);
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
        uint96 _numberOfReviewersPerApplication,
        string memory _metadataHash
    ) public override onlyWorkspaceAdminOrGrantFactory(_workspaceId) {
        GrantReviewState storage grantReviewState = grantReviewStates[_grantAddress];

        require(IGrant(_grantAddress).workspaceId() == _workspaceId, "RubricsSet: Unauthorised");
        require(grantReviewState.numOfReviews == 0, "RubricsSet: Reviews non-zero");

        grantReviewState.rubricsMetadataHash = _metadataHash;
        grantReviewState.workspaceId = _workspaceId;
        grantReviewState.grant = _grantAddress;

        if (_numberOfReviewersPerApplication > 0) {
            grantReviewState.numOfReviewersPerApplication = _numberOfReviewersPerApplication;
            emit RubricsSetV2(
                _workspaceId,
                _grantAddress,
                _numberOfReviewersPerApplication,
                _metadataHash,
                block.timestamp
            );
        } else {
            emit RubricsSet(_workspaceId, _grantAddress, _metadataHash, block.timestamp);
        }
    }

    /**
     * @notice Sets the rubrics metadata hash for a grant, and enables auto assigning of reviewers at one go
     * @param _workspaceId Workspace id
     * @param _grantAddress Grant address
     * @param _reviewers Array of reviewer addresses
     * @param _applications Array of application ids
     * @param _applicationsPerReviewer Array of application ids per reviewer
     * @param _numOfReviewersPerApplication Number of reviewers per application when auto assigning
     * @param _rubricMetadataHash IPFS hash of the rubrics metadata
     */
    function setRubricsAndEnableAutoAssign(
        uint96 _workspaceId,
        address _grantAddress,
        address[] memory _reviewers,
        uint96[] memory _applications,
        uint96[][] memory _applicationsPerReviewer,
        uint96 _numOfReviewersPerApplication,
        string memory _rubricMetadataHash
    ) external onlyWorkspaceAdminOrGrantFactory(_workspaceId) {
        require(IGrant(_grantAddress).workspaceId() == _workspaceId, "RubricsSetAndEnableAutoAssign: Unauthorised");
        require(_reviewers.length == _applicationsPerReviewer.length, "RubricsSetAndEnableAutoAssign: Length mismatch");
        setRubrics(_workspaceId, _grantAddress, _numOfReviewersPerApplication, _rubricMetadataHash);
        enableAutoAssignmentOfReviewers(
            _workspaceId,
            _grantAddress,
            _reviewers,
            _applications,
            _applicationsPerReviewer,
            _numOfReviewersPerApplication
        );
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
    function hasAutoAssigningEnabled(address _grantAddress) external view override returns (bool) {
        return isAutoAssigningEnabled[_grantAddress];
    }

    /**
     * @notice Function to store the applications to a grant
     * @param _grantAddress Grant address
     * @param _applicationId Application ID
     */
    function appendToApplicationList(uint96 _applicationId, address _grantAddress) external override {
        applicationsToGrant[_grantAddress].push(_applicationId);
    }
}
