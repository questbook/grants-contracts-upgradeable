// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
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
    uint96 public numApplicants;

    /// @notice grant metadata pointer to IPFS hash
    string public metadataHash;

    /// @notice denotes if grant is receiving applications
    bool public active;

    /// @notice applicationRegistry interface used for fetching application owner
    IApplicationRegistry public applicationReg;

    /// @notice workspaceRegistry interface used for fetching fetching workspace admin
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

    modifier onlyWorkspaceAdmin() {
        require(workspaceReg.isWorkspaceAdmin(workspaceId, msg.sender), "Unauthorised: Not an admin");
        _;
    }

    modifier onlyApplicationRegistry() {
        require(msg.sender == address(applicationReg), "Unauthorised: Not applicationRegistry");
        _;
    }

    /**
     * @notice Set grant details on contract deployment
     * @param _workspaceId workspace id to which the grant belong
     * @param _metadataHash metadata pointer
     * @param _workspaceReg workspace registry interface
     * @param _applicationReg application registry interface
     */
    constructor(
        uint96 _workspaceId,
        string memory _metadataHash,
        IWorkspaceRegistry _workspaceReg,
        IApplicationRegistry _applicationReg
    ) {
        workspaceId = _workspaceId;
        active = true;
        metadataHash = _metadataHash;
        applicationReg = _applicationReg;
        workspaceReg = _workspaceReg;
    }

    /**
     * @notice Update number of applications on grant, can be called by applicationRegistry contract
     */
    function incrementApplicant() external onlyApplicationRegistry {
        assert(numApplicants + 1 > numApplicants);
        numApplicants += 1;
    }

    /**
     * @notice Update the metadata pointer of a grant, can be called by workspace admins
     * @param _metadataHash New URL that points to grant metadata
     */
    function updateGrant(string memory _metadataHash) external onlyWorkspaceAdmin {
        require(numApplicants == 0, "GrantUpdate: Applicants have already started applying");
        metadataHash = _metadataHash;
        emit GrantUpdated(workspaceId, _metadataHash, active, block.timestamp);
    }

    /**
     * @notice Update grant accessibility, can be called by workspace admins
     * @param _canAcceptApplication set to false for disabling grant from receiving new applications
     */
    function updateGrantAccessibility(bool _canAcceptApplication) external onlyWorkspaceAdmin {
        active = _canAcceptApplication;
        emit GrantUpdated(workspaceId, metadataHash, _canAcceptApplication, block.timestamp);
    }

    /**
     * @notice Deposit funds to a workspace, can be called by anyone
     * @param _erc20Interface interface for erc20 asset using which rewards are disbursed
     * @param _amount Amount to be deposited for a given asset
     */
    function depositFunds(IERC20 _erc20Interface, uint256 _amount) external payable {
        if (_amount > _erc20Interface.allowance(msg.sender, address(this))) {
            emit FundsDepositFailed(address(_erc20Interface), _amount, block.timestamp);
            revert("Please approve funds before transfer");
        }
        require(_erc20Interface.transferFrom(msg.sender, address(this), _amount), "Failed to transfer funds");
        emit FundsDeposited(address(_erc20Interface), _amount, block.timestamp);
    }

    /**
     * @notice Disburses grant reward, can be called by applicationRegistry contract
     * @param _applicationId application id for which the funds are disbursed
     * @param _milestoneId milestone id for which the funds are disbursed
     * @param _erc20Interface interface for erc20 asset using which rewards are disbursed
     * @param _amount amount disbursed
     * @param _sender address of person trasferring reward
     */
    function disburseReward(
        uint96 _applicationId,
        uint96 _milestoneId,
        IERC20 _erc20Interface,
        uint256 _amount,
        address _sender
    ) external payable onlyApplicationRegistry {
        require(
            _erc20Interface.transfer(applicationReg.getApplicationOwner(_applicationId), _amount),
            "Failed to transfer funds"
        );
        emit DisburseReward(_applicationId, _milestoneId, address(_erc20Interface), _sender, _amount, block.timestamp);
    }

    /**
     * @notice Disburses grant reward, can be called by applicationRegistry contract
     * @param _applicationId application id for which the funds are disbursed
     * @param _milestoneId milestone id for which the funds are disbursed
     * @param _erc20Interface interface for erc20 asset using which rewards are disbursed
     * @param _amount amount disbursed
     * @param _sender address of person trasferring reward
     */
    function disburseRewardP2P(
        uint96 _applicationId,
        uint96 _milestoneId,
        IERC20 _erc20Interface,
        uint256 _amount,
        address _sender
    ) external payable onlyApplicationRegistry {
        require(
            _erc20Interface.transferFrom(_sender, applicationReg.getApplicationOwner(_applicationId), _amount),
            "Failed to transfer funds"
        );
        emit DisburseReward(_applicationId, _milestoneId, address(_erc20Interface), _sender, _amount, block.timestamp);
    }
}
