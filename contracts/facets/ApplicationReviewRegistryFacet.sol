// SPDX-License-Identifier: MIT
pragma solidity >=0.8.1;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IWorkspaceRegistry.sol";
import "../interfaces/IApplicationRegistry.sol";
import "../interfaces/IGrantFactory.sol";
import "../interfaces/IGrant.sol";
import { AppStorage, Review, GrantReviewState, ModifierFacets } from "../libraries/LibAppStorage.sol";

contract ApplicationReviewRegistryFacet is ModifierFacets {
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
        uint96[] indexed _reviewIds,
        address _asset,
        address _reviewer,
        uint256 _amount,
        string _transactionHash,
        uint256 time
    );

    /// @notice Emitted when review payment is fulfilled
    event ReviewPaymentFulfilled(
        uint96[] indexed _reviewIds,
        address _asset,
        address _sender,
        address _reviewer,
        uint256 _amount,
        uint256 time
    );

    /**
     * @notice Calls initialize on the base contracts
     *
     * @dev This acts as a constructor for the upgradeable proxy contract
     */
    // function initialize() external initializer {
    //     __Ownable_init();
    // }

    /**
     * @notice Override of UUPSUpgradeable virtual function
     *
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     */
    // function _authorizeUpgrade(address) internal view override onlyOwner {}

    /**
     * @notice sets workspace registry contract interface
     * @param _workspaceReg WorkspaceRegistry interface
     */
    // function setWorkspaceReg(IWorkspaceRegistry _workspaceReg) external onlyOwner {
    //     workspaceReg = _workspaceReg;
    // }

    /**
     * @notice sets grant factory contract interface
     * @param _grantFactory GrantFactory contract address
     */
    // function setGrantFactory(IGrantFactory _grantFactory) external onlyOwner {
    //     grantFactory = _grantFactory;
    // }

    /**
     * @notice sets application registry contract interface
     * @param _applicationReg ApplicationRegistry contract address
     */
    // function setApplicationReg(IApplicationRegistry _applicationReg) external onlyOwner {
    //     applicationReg = _applicationReg;
    // }

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
    ) public // onlyWorkspaceAdmin(_workspaceId)
    {
        // require(applicationReg.getApplicationWorkspace(_applicationId) == _workspaceId, "AssignReviewer: Unauthorized");
        require(_reviewers.length == _active.length, "AssignReviewer: Parameters length mismatch");
        uint96[] memory _reviewIds = new uint96[](_reviewers.length);

        for (uint256 i = 0; i < _reviewers.length; i++) {
            require(_reviewers[i] != address(0), "AssignReviewer: Reviewer is zero address");

            Review memory review = appStorage.reviews[_reviewers[i]][_applicationId];
            uint96 _id;
            if (review.reviewer == address(0)) {
                _id = appStorage.reviewCount;
                assert(appStorage.reviewCount + 1 > appStorage.reviewCount);
                appStorage.reviewCount += 1;
            } else {
                _id = review.id;
            }

            _reviewIds[i] = _id;
            appStorage.reviews[_reviewers[i]][_applicationId] = Review(
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
    ) public // onlyWorkspaceAdminOrReviewer(_workspaceId)
    {
        Review storage review = appStorage.reviews[msg.sender][_applicationId];
        GrantReviewState storage grantReviewState = appStorage.grantReviewStates[_grantAddress];

        require(review.workspaceId == _workspaceId, "ReviewSubmit: Unauthorised");
        require(review.active, "ReviewSubmit: Revoked access");

        bytes memory metadataHashBytes = bytes(review.metadataHash);
        if (metadataHashBytes.length == 0) {
            grantReviewState.numOfReviews += 1;
        }

        review.metadataHash = _metadataHash;

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
    ) external // onlyWorkspaceAdminOrGrantFactory(_workspaceId)
    {
        GrantReviewState storage grantReviewState = appStorage.grantReviewStates[_grantAddress];

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
    ) public // onlyWorkspaceAdmin(_workspaceId)
    {
        require(_reviewIds.length == _applicationIds.length, "ChangePaymentStatus: Parameters length mismatch");

        for (uint256 i = 0; i < _reviewIds.length; i++) {
            Review memory review = appStorage.reviews[_reviewer][_applicationIds[i]];
            require(review.workspaceId == _workspaceId, "ChangePaymentStatus: Unauthorised");
            appStorage.reviewPaymentsStatus[_reviewIds[i]] = true;
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
    ) external // onlyWorkspaceAdmin(_workspaceId)
    {
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
}
