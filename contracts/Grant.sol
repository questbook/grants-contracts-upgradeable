// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IWorkspaceRegistry.sol";
import "./interfaces/IApplicationRegistry.sol";
import "./interfaces/IGrantFactory.sol";

/// @title Singleton grant contract used for updating a grant, depositing and disbursal of reward funds
contract Grant is Initializable, UUPSUpgradeable, OwnableUpgradeable {
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

    IGrantFactory public grantFactory;

    /// @notice Emitted when a grant is updated
    event GrantUpdated(uint96 indexed workspaceId, string metadataHash, bool active, uint256 time);

    /// @notice Emitted when funds are withdrawn
    event FundsWithdrawn(address asset, uint256 amount, address recipient, uint256 time);

    /// @notice Emitted when fund deposit fails
    event FundsDepositFailed(address asset, uint256 amount, uint256 time);

    /// @notice Emitted when grant milestone is disbursed
    event DisburseReward(
        uint96 indexed applicationId,
        uint96 milestoneId,
        address asset,
        address sender,
        uint256 amount,
        bool isP2P,
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

    /// @notice Emitted when a transaction is simply recorded
    event TransactionRecord(
        uint96 indexed applicationId,
        uint96 milestoneId,
        address asset,
        address sender,
        bytes transactionHash,
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

    modifier onlyGrantFactory() {
        require(msg.sender == address(grantFactory), "Unauthorised: Not being called from GrantFactory");
        _;
    }

    modifier checkBalance(
        IERC20 _erc20Interface,
        address _sender,
        uint256 _amount
    ) {
        require(_erc20Interface.balanceOf(_sender) > _amount, "Insufficient Balance");
        _;
    }

    /**
     * @notice Set grant details on contract deployment
     *
     * @param _workspaceId workspace id to which the grant belong
     * @param _metadataHash metadata pointer
     * @param _workspaceReg workspace registry interface
     * @param _applicationReg application registry interface
     *
     * @dev This acts as a constructor for the upgradeable proxy contract
     */
    function initialize(
        uint96 _workspaceId,
        string memory _metadataHash,
        IWorkspaceRegistry _workspaceReg,
        IApplicationRegistry _applicationReg,
        IGrantFactory _grantFactory,
        address _grantFactoryOwner
    ) external initializer {
        __Ownable_init();
        workspaceId = _workspaceId;
        active = true;
        metadataHash = _metadataHash;
        applicationReg = _applicationReg;
        workspaceReg = _workspaceReg;
        grantFactory = _grantFactory;
        transferOwnership(_grantFactoryOwner);
    }

    /**
     * @notice Override of UUPSUpgradeable virtual function
     *
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(address) internal view override onlyOwner {}

    /**
     * @notice Update number of applications on grant, can be called by applicationRegistry contract
     */
    function incrementApplicant() external onlyApplicationRegistry {
        assert(numApplicants + 1 > numApplicants);
        numApplicants += 1;
    }

    /**
     * @notice Update the metadata pointer of a grant, can be called by GrantFactory contract
     * @param _metadataHash New URL that points to grant metadata
     */
    function updateGrant(string memory _metadataHash) external onlyGrantFactory {
        require(numApplicants == 0, "GrantUpdate: Applicants have already started applying");
        metadataHash = _metadataHash;
        // emit GrantUpdated(workspaceId, _metadataHash, active, block.timestamp);
    }

    /**
     * @notice Update grant accessibility, can be called by GrantFactory contract
     * @param _canAcceptApplication set to false for disabling grant from receiving new applications
     */
    function updateGrantAccessibility(bool _canAcceptApplication) external onlyGrantFactory {
        active = _canAcceptApplication;
        // emit GrantUpdated(workspaceId, metadataHash, _canAcceptApplication, block.timestamp);
    }

    /**
     * @notice Withdraws funds from a grant to specified recipient, can be called only by workspace admin
     * @param _erc20Interface interface for erc20 asset using which rewards are disbursed
     * @param _amount Amount to be withdrawn for a given asset
     * @param _recipient address of wallet where the funds should be withdrawn to
     */
    function withdrawFunds(
        IERC20 _erc20Interface,
        uint256 _amount,
        address _recipient
    ) external onlyWorkspaceAdmin {
        emit FundsWithdrawn(address(_erc20Interface), _amount, _recipient, block.timestamp);
        require(_erc20Interface.transfer(_recipient, _amount), "Failed to transfer funds");
    }

    /**
     * @notice Disburses grant reward, can be called by applicationRegistry contract
     * @param _applicationId application id for which the funds are disbursed
     * @param _milestoneId milestone id for which the funds are disbursed
     * @param _erc20Interface interface for erc20 asset using which rewards are disbursed
     * @param _amount amount disbursed
     */
    function disburseReward(
        uint96 _applicationId,
        uint96 _milestoneId,
        IERC20 _erc20Interface,
        uint256 _amount
    ) external onlyWorkspaceAdmin {
        emit DisburseReward(
            _applicationId,
            _milestoneId,
            address(_erc20Interface),
            msg.sender,
            _amount,
            false,
            block.timestamp
        );
        require(
            _erc20Interface.transfer(applicationReg.getApplicationOwner(_applicationId), _amount),
            "Failed to transfer funds"
        );
    }

    /**
     * @notice Disburses grant reward, can be called by applicationRegistry contract
     * @param _applicationId application id for which the funds are disbursed
     * @param _applicantWalletAddress wallet address of the applicant to disburse rewards to
     * @param _milestoneId milestone id for which the funds are disbursed
     * @param _erc20Interface interface for erc20 asset using which rewards are disbursed
     * @param _amount amount disbursed
     */
    function disburseRewardP2P(
        uint96 _applicationId,
        address _applicantWalletAddress,
        uint96 _milestoneId,
        IERC20 _erc20Interface,
        uint256 _amount
    ) external onlyWorkspaceAdmin checkBalance(_erc20Interface, msg.sender, _amount) {
        emit DisburseReward(
            _applicationId,
            _milestoneId,
            address(_erc20Interface),
            msg.sender,
            _amount,
            true,
            block.timestamp
        );
        require(_applicantWalletAddress != address(this), "This transfer is prohibited");

        if (_applicantWalletAddress == address(0)) {
            require(
                _erc20Interface.transferFrom(msg.sender, applicationReg.getApplicationOwner(_applicationId), _amount),
                "Failed to transfer funds"
            );
        } else {
            require(
                _erc20Interface.transferFrom(msg.sender, _applicantWalletAddress, _amount),
                "Failed to transfer funds to applicant wallet address"
            );
        }
    }

    function recordTransaction(
        uint96 _applicationId,
        uint96 _milestoneId,
        address _asset,
        bytes memory _transactionHash,
        uint256 _amount
    ) external onlyWorkspaceAdmin {
        emit TransactionRecord(
            _applicationId,
            _milestoneId,
            _asset,
            msg.sender,
            _transactionHash,
            _amount,
            block.timestamp
        );
    }
}
