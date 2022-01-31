// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

interface IWorkspaceRegistry {
    function isWorkspaceAdmin(uint96 _id, address _member) external view returns (bool);
}

interface IApplicationRegistry {
    function getApplicationOwner(uint96 _applicationId) external view returns (address);
}

contract Grant {
    /// @notice workspaceId to which the grant belongs
    uint96 public workspaceId;

    /// @notice number of submitted applicantions
    uint48 public numApplicants;

    /// @notice grant metadata pointer to IPFS hash
    string public metadataHash;

    /// @notice grant creator address
    address public owner;

    /// @notice denotes if grant is receiving applications
    bool public active;

    /// @notice interfaces for using external functionalities like fetching application owner, checking workspace admin
    IApplicationRegistry public applicationReg;
    IWorkspaceRegistry public workspaceReg;

    /// @notice Emitted when a grant is updated
    event GrantUpdated(uint96 indexed workspaceId, string metadataHash, bool active, uint256 time);

    /// @notice Emitted when funds is deposited is updated
    event FundsDeposited(address asset, uint256 amount, uint256 time);

    /// @notice Emitted when fund deposit fails
    event FundsDepositFailed(address asset, uint256 amount, uint256 time);

    /// @notice Emitted when grant milestone is disbursed
    event DisburseReward(
        uint96 indexed applicationId,
        uint96 milestoneId,
        address asset,
        address sender,
        uint256 amount,
        uint256 time
    );

    /// @notice Emitted when disbursal fails
    event DisburseRewardFailed(
        uint96 indexed applicationId,
        uint96 milestoneId,
        address asset,
        address sender,
        uint256 amount,
        uint256 time
    );

    /**
     * @notice Set grant details on contract deployment
     * @param _workspaceId workspace id to which the grant belong
     * @param _metadataHash metadata pointer
     * @param _workspaceRegAddr workspace registry contract
     * @param _applicationRegAddr application registry contract
     */
    constructor(
        uint96 _workspaceId,
        string memory _metadataHash,
        address _workspaceRegAddr,
        address _applicationRegAddr
    ) {
        workspaceId = _workspaceId;
        active = true;
        metadataHash = _metadataHash;
        applicationReg = IApplicationRegistry(_applicationRegAddr);
        workspaceReg = IWorkspaceRegistry(_workspaceRegAddr);
    }

    /**
     * @notice Update number of applications on grant
     */
    function incrementApplicant() external {
        require(msg.sender == address(applicationReg), "GrantUpdate: Unauthorised");
        numApplicants += 1;
    }

    /**
     * @notice Update the metadata pointer of a grant
     * @param _metadataHash New URL that points to grant metadata
     */
    function updateGrant(string memory _metadataHash) external {
        require(numApplicants == 0, "GrantUpdate: Applicants have already started applying");
        require(workspaceReg.isWorkspaceAdmin(workspaceId, msg.sender), "GrantUpdate: Unauthorised");
        metadataHash = _metadataHash;
        emit GrantUpdated(workspaceId, _metadataHash, active, block.timestamp);
    }

    /**
     * @notice Update grant accessibility
     * @param _canAcceptApplication set to false for disabling grant from receiving new applications
     */
    function updateGrantAccessibility(bool _canAcceptApplication) external {
        require(workspaceReg.isWorkspaceAdmin(workspaceId, msg.sender), "GrantUpdate: Unauthorised");
        active = _canAcceptApplication;
        emit GrantUpdated(workspaceId, metadataHash, _canAcceptApplication, block.timestamp);
    }

    /**
     * @notice Deposit funds to a workspace
     * @param _asset Asset to be deposited
     * @param _amount Amount to be deposited for a given asset
     */
    function depositFunds(address _asset, uint256 _amount) external payable {
        IERC20 erc20Interface = IERC20(_asset);
        if (_amount > erc20Interface.allowance(msg.sender, address(this))) {
            emit FundsDepositFailed(_asset, _amount, block.timestamp);
            revert("Please approve funds before transfer");
        }
        require(erc20Interface.transferFrom(msg.sender, address(this), _amount), "Failed to transfer funds");
        emit FundsDeposited(_asset, _amount, block.timestamp);
    }

    /**
     * @notice Disburses grant reward
     * @param _applicationId application id for which the funds are disbursed
     * @param _milestoneId milestone id for which the funds are disbursed
     * @param _asset asset address in which rewards are disbursed
     * @param _amount amount disbursed
     */
    function disburseReward(
        uint96 _applicationId,
        uint96 _milestoneId,
        address _asset,
        uint256 _amount
    ) external payable {
        require(workspaceReg.isWorkspaceAdmin(workspaceId, msg.sender), "GrantRewardDisbursal: Unauthorised");
        require(
            IERC20(_asset).transferFrom(address(this), applicationReg.getApplicationOwner(_applicationId), _amount),
            "Failed to transfer funds"
        );
        emit DisburseReward(_applicationId, _milestoneId, _asset, msg.sender, _amount, block.timestamp);
    }

    /**
     * @notice Disburses grant reward
     * @param _applicationId application id for which the funds are disbursed
     * @param _milestoneId milestone id for which the funds are disbursed
     * @param _asset asset address in which rewards are disbursed
     * @param _amount amount disbursed
     */
    function disburseRewardP2P(
        uint96 _applicationId,
        uint96 _milestoneId,
        address _asset,
        uint256 _amount
    ) external payable {
        require(workspaceReg.isWorkspaceAdmin(workspaceId, msg.sender), "GrantRewardDisbursal: Unauthorised");
        IERC20 erc20Interface = IERC20(_asset);
        if (_amount > erc20Interface.allowance(msg.sender, address(this))) {
            emit DisburseRewardFailed(_applicationId, _milestoneId, _asset, msg.sender, _amount, block.timestamp);
            revert("Please approve funds before transfer");
        }
        require(
            erc20Interface.transferFrom(msg.sender, applicationReg.getApplicationOwner(_applicationId), _amount),
            "Failed to transfer funds"
        );
        emit DisburseReward(_applicationId, _milestoneId, _asset, msg.sender, _amount, block.timestamp);
    }
}
