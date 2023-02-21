// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IWorkspaceRegistry.sol";
import "./interfaces/IApplicationRegistry.sol";
import "./interfaces/ISafe.sol";
import "./interfaces/ISafeGuard.sol";
import "@questbook/anon-authoriser/contracts/anon-authoriser.sol";
import "hardhat/console.sol";

/// @title Registry for all the workspaces used to create and update workspaces
contract WorkspaceRegistry is
    Initializable,
    UUPSUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    IWorkspaceRegistry
{
    /// @notice Number of workspace stored in this registry
    uint96 public workspaceCount;

    /// @notice Optional safe used by a workspace
    struct Safe {
        /// The address of the safe
        bytes32 _address;
        /// ID of the chain, where it is stored
        uint256 chainId;
    }

    /// @notice structure holding each workspace data
    struct Workspace {
        uint96 id;
        address owner;
        string metadataHash;
        Safe safe;
    }

    /// @notice mapping to store workspaceId vs workspace data structure
    mapping(uint96 => Workspace) public workspaces;

    /// @notice mapping to store workspaceId vs members vs roles
    mapping(uint96 => mapping(address => bytes32)) public memberRoles;

    /// @notice Address of the anon authoriser contract
    address public anonAuthoriserAddress;

    /// @notice applicationRegistry interface used for fetching application owner
    IApplicationRegistry public applicationReg;

    /// @notice qbAdmins list holding addresses of all QB admins.
    address[] public qbAdmins;

    /// @notice this stores a mapping from a scwAddress to the wallet address of an user
    // mapping(address => address) public scwAddressToWalletAddress;

    /// @notice this stores a mapping from a wallet address to the scwAddress of an user
    /// Deprecated: this is deprecated and is retained to preserve upgradability
    mapping(address => address) public walletAddressToScwAddress;

    /// @notice this is the offset that is used to get the guard contract address for a safe.
    /// @notice In case, SAFE decides to upgrade their contracts, this offset should be changed.
    uint256 public GUARD_OFFSET;

    /// @notice this stores a mapping from a wallet address to the scwAddress of an user, for every workspace
    mapping(address => mapping(uint96 => address)) public eoaToScw;

    // --- Events ---
    /// @notice Emitted when a new workspace is created
    event WorkspaceCreated(uint96 indexed id, address indexed owner, string metadataHash, uint256 time);

    /// @notice Emitted when a workspace's safe is updated
    event WorkspaceSafeUpdated(
        uint96 indexed id,
        bytes32 safeAddress,
        string longSafeAddress,
        uint256 safeChainId,
        uint256 time
    );

    /// @notice Emitted when a workspace is updated
    event WorkspaceUpdated(uint96 indexed id, address indexed owner, string metadataHash, uint256 time);

    /// @notice Emitted when workspace members are updated
    /// @notice The role 0 denotes an admin role
    /// @notice The role 1 denotes a reviewer role
    event WorkspaceMembersUpdated(
        uint96 indexed id,
        address[] members,
        uint8[] roles,
        bool[] enabled,
        string[] emails,
        uint256 time
    );

    /// @notice Emitted when a workspace member's profile is updated
    /// @notice The role 0 denotes an admin role
    /// @notice The role 1 denotes a reviewer role
    /// @notice enabled => member is active, otherwise removed from workspace
    event WorkspaceMemberUpdated(
        uint96 indexed id,
        address member,
        uint8 role,
        bool enabled,
        string metadataHash,
        uint256 time
    );

    /// @notice Emitted when grant reward is disbursed
    event DisburseReward(
        uint96 indexed applicationId,
        uint96 milestoneId,
        address asset,
        address sender,
        uint256 amount,
        bool isP2P,
        uint256 time
    );

    /// @notice Emitted when grant reward is disbursed from safe
    event DisburseRewardFromSafe(
        uint96[] applicationIds,
        uint96[] milestoneIds,
        address asset,
        string nonEvmAssetAddress,
        string transactionHash,
        address sender,
        uint256[] amounts,
        bool isP2P,
        uint256 time
    );

    /// @notice Emitted when payout is initiated through safe
    event DisburseRewardFromSafe(
        uint96[] applicationIds,
        uint96[] milestoneIds,
        address asset,
        string tokenName,
        string nonEvmAssetAddress,
        string transactionHash,
        address sender,
        uint256[] amounts,
        bool isP2P,
        uint256 time
    );

    /// @notice Emitted when payout is initiated through wallet
    event DisburseRewardFromWallet(
        uint96[] applicationIds,
        uint96[] milestoneIds,
        address asset,
        string tokenName,
        string nonEvmAssetAddress,
        string transactionHash,
        address sender,
        uint256[] amounts,
        bool isP2P,
        uint256 time
    );

    event WorkspaceMemberMigrate(uint96 workspaceId, address from, address to, uint256 time);

    /// @notice Emitted when some daos' visibility is updated by a QB admin
    event WorkspacesVisibleUpdated(uint96[] workspaceId, bool[] isVisible);

    /// @notice Emitted when QB admins are added or removed
    event QBAdminsUpdated(address[] walletAddresses, bool isAdded, uint256 time);

    /// @notice Emitted when transaction status is updated
    event FundsTransferStatusUpdated(
        uint96[] applicationId,
        string[] transactionHash,
        string[] status,
        uint256[] tokenUSDValue,
        uint256[] executionTimestamp
    );

    event GrantsSectionUpdated(address[] grantIds, string sectionName, string sectionLogoIpfsHash);

    modifier onlyQBAdmin() {
        require(_isQBAdminPresent(msg.sender), "Unauthorised: Not a QB admin");
        _;
    }

    modifier onlyWorkspaceAdmin(uint96 _workspaceId) {
        require(_checkRole(_workspaceId, msg.sender, 0), "Unauthorised: Not an admin");
        _;
    }

    modifier onlyWorkspaceAdminOrReviewer(uint96 _workspaceId) {
        require(
            _checkRole(_workspaceId, msg.sender, 0) || _checkRole(_workspaceId, msg.sender, 1),
            "Unauthorised: Neither an admin nor a reviewer"
        );
        _;
    }

    modifier withinLimit(uint256 _membersLength) {
        require(_membersLength <= 1000, "WorkspaceMembers: Limit exceeded");
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
     * @notice Calls initialize on the base contracts
     *
     * @dev This acts as a constructor for the upgradeable proxy contract
     */
    function initialize() external initializer {
        __Ownable_init();
        __Pausable_init();
    }

    /**
     * @notice Override of UUPSUpgradeable virtual function
     *
     * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
     * {upgradeTo} and {upgradeToAndCall}.
     */
    function _authorizeUpgrade(address) internal view override onlyOwner {}

    /**
     * @notice Change the address of the anon authoriser contract
     */
    function updateAnonAuthoriserAddress(address addr) external onlyOwner {
        anonAuthoriserAddress = addr;
    }

    /**
     * @notice sets application registry contract interface
     * @param _applicationReg interface
     */
    function setApplicationReg(IApplicationRegistry _applicationReg) external onlyOwner {
        applicationReg = _applicationReg;
    }

    function setGuardOffset(uint256 _guardOffset) external onlyOwner {
        GUARD_OFFSET = _guardOffset;
    }

    /**
     * @notice Create a new workspace under which grants will be created,
     * can be called by anyone who wants to create workspace
     * @param _metadataHash workspace metadata pointer to IPFS file
     * @param _safeAddress address of the safe used by the workspace (optional)
     * @param _safeChainId chain id of the safe used by the workspace (optional -- specify 0 if not used)
     */
    function createWorkspace(
        string memory _metadataHash,
        bytes32 _safeAddress,
        string memory _longSafeAddress,
        uint256 _safeChainId
    ) external whenNotPaused {
        uint96 _id = workspaceCount;
        workspaces[_id] = Workspace(_id, msg.sender, _metadataHash, Safe(_safeAddress, _safeChainId));
        _setRole(_id, msg.sender, 0, true);
        emit WorkspaceCreated(_id, msg.sender, _metadataHash, block.timestamp);
        // emit safe update if safe was specified
        if (_safeChainId > 0) {
            emit WorkspaceSafeUpdated(_id, _safeAddress, _longSafeAddress, _safeChainId, block.timestamp);
        }
        assert(workspaceCount + 1 > workspaceCount);
        workspaceCount += 1;
    }

    /**
     * @notice Update the metadata pointer of a workspace,
     * can be called by workspace admins or reviewers
     * @param _id ID of workspace to update
     * @param _metadataHash New IPFS hash that points to workspace metadata
     */
    function updateWorkspaceMetadata(
        uint96 _id,
        string memory _metadataHash
    ) external whenNotPaused onlyWorkspaceAdminOrReviewer(_id) {
        Workspace storage workspace = workspaces[_id];
        workspace.metadataHash = _metadataHash;
        emit WorkspaceUpdated(workspace.id, workspace.owner, workspace.metadataHash, block.timestamp);
    }

    /**
     * @notice Update the workspace safe address and chain id, admin only
     *
     * @param _id ID of workspace to update
     * @param _safeAddress address of the safe used by the workspace (optional)
     * @param _safeChainId chain id of the safe used by the workspace (set to 0 to remove)
     */
    function updateWorkspaceSafe(
        uint96 _id,
        bytes32 _safeAddress,
        string memory _longSafeAddress,
        uint256 _safeChainId
    ) external whenNotPaused onlyWorkspaceAdmin(_id) {
        Workspace storage workspace = workspaces[_id];
        workspace.safe = Safe(_safeAddress, _safeChainId);
        emit WorkspaceSafeUpdated(_id, _safeAddress, _longSafeAddress, _safeChainId, block.timestamp);
    }

    /**
     * @notice Migrate the user's wallet to a new address
     *
     * @param fromWallet Current wallet address of the user
     * @param toWallet The new wallet address to migrate to
     */
    function migrateWallet(address fromWallet, address toWallet) public {
        require(msg.sender == fromWallet || owner() == msg.sender, "Only fromWallet/owner can migrate");

        for (uint96 i = 0; i < workspaceCount; i++) {
            Workspace storage workspace = workspaces[i];
            bool modified = false;
            if (workspace.owner == fromWallet) {
                workspace.owner = toWallet;
                modified = true;
            }

            bytes32 role = memberRoles[workspace.id][fromWallet];
            if (role > 0) {
                delete memberRoles[workspace.id][fromWallet];
                memberRoles[workspace.id][toWallet] = role;
                modified = true;
            }

            if (modified) {
                emit WorkspaceMemberMigrate(workspace.id, fromWallet, toWallet, block.timestamp);
            }
        }

        applicationReg.migrateWallet(fromWallet, toWallet);
    }

    /**
     * @notice Migrate multiple users' wallets in one go
     *
     * @param fromWallets Current wallet addresses of the users
     * @param toWallets The new wallet addresses to migrate to
     */
    function migrateWalletBatch(address[] calldata fromWallets, address[] calldata toWallets) external {
        require(owner() == msg.sender, "Only owner can perform batch migration");
        require(fromWallets.length == toWallets.length, "Array length mismatch");

        for (uint96 i = 0; i < fromWallets.length; ++i) {
            migrateWallet(fromWallets[i], toWallets[i]);
        }
    }

    /**
     * @notice Update workspace members' roles, can be called by workspace admins
     * @param _id ID of target workspace
     * @param _members Members whose roles are to be updated
     * @param _roles Roles to be updated
     * @param _enabled Whether to enable or disable the role
     * @param _metadataHashes Metadatas for the members.
     */
    function updateWorkspaceMembers(
        uint96 _id,
        address[] memory _members,
        uint8[] memory _roles,
        bool[] memory _enabled,
        string[] memory _metadataHashes
    ) external whenNotPaused onlyWorkspaceAdmin(_id) withinLimit(_members.length) {
        require(_members.length == _roles.length, "UpdateWorkspaceMembers: Parameters length mismatch");
        require(_members.length == _enabled.length, "UpdateWorkspaceMembers: Parameters length mismatch");
        require(_members.length == _metadataHashes.length, "UpdateWorkspaceMembers: Parameters length mismatch");
        for (uint256 i = 0; i < _members.length; i++) {
            address member = _members[i];
            /// @notice The role 0 denotes an admin role
            /// @notice The role 1 denotes a reviewer role
            uint8 role = _roles[i];
            bool enabled = _enabled[i];
            _setRole(_id, member, role, enabled);
            emit WorkspaceMemberUpdated(_id, member, role, enabled, _metadataHashes[i], block.timestamp);
        }
    }

    /**
     * @notice Create an invite link for someone to join with
     * @param _id ID of workspace to create invite link for
     * @param _role what the role of the invited member should be
     * @param publicKeyAddress Generated public key address for the invite link
     * (corresponding private key should be sent to invitee)
     */
    function createInviteLink(
        uint96 _id,
        uint8 _role,
        address publicKeyAddress
    ) external whenNotPaused onlyWorkspaceAdmin(_id) {
        bytes32 apiFlag = apiFlagForWorkspaceId(_id, _role);
        AnonAuthoriser(anonAuthoriserAddress).generateAnonAuthorisation(publicKeyAddress, apiFlag);
    }

    /**
     * @notice Join a workspace with an invite link
     * @param _id ID of workspace to join
     * @param _metadataHash metadata for the member
     * @param _role the role the user was invited for
     * Remaining params are of the signature to be sent to AnonAuthoriser
     */
    function joinViaInviteLink(
        uint96 _id,
        string memory _metadataHash,
        uint8 _role,
        uint8 signatureV,
        bytes32 signatureR,
        bytes32 signatureS
    ) external whenNotPaused {
        bytes32 apiFlag = apiFlagForWorkspaceId(_id, _role);
        AnonAuthoriser(anonAuthoriserAddress).anonAuthorise(
            address(this),
            apiFlag,
            msg.sender,
            signatureV,
            signatureR,
            signatureS
        );

        Workspace memory workspace = workspaces[_id];
        bool isAdmin = workspace.owner == msg.sender || _checkRole(_id, msg.sender, 0);
        require(!isAdmin, "Already an admin");

        _setRole(_id, msg.sender, _role, true);

        emit WorkspaceMemberUpdated(_id, msg.sender, _role, true, _metadataHash, block.timestamp);
    }

    function getAddress(bytes memory data) internal pure returns (address addr) {
        assembly {
            addr := mload(add(data, 32))
        }
    }

    function splitSignature(bytes memory sig) public pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "invalid signature length");

        assembly {
            /*
            First 32 bytes stores the length of the signature

            add(sig, 32) = pointer of sig + 32
            effectively, skips first 32 bytes of signature

            mload(p) loads next 32 bytes starting at the memory address p into memory
            */

            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }
    }

    /**
     * @notice Join a workspace by proving your membership using SafeGuard
     * @param _id ID of workspace to join
     * @param _walletAddress wallet address of the member (not scwAddress)
     * @param _signature signature of the hashed message
     * @param _metadataHash metadata for the member
     * @param _role the role the user was invited for
     */
    function proveMembership(
        uint96 _id,
        string memory _metadataHash,
        address _walletAddress,
        uint8 _role,
        bytes memory _signature
    ) external whenNotPaused {
        require(eoaToScw[_walletAddress][_id] == address(0), "Already a member");

        {
            bytes32 messageHash = keccak256(abi.encodePacked("Verification message"));
            bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));

            (bytes32 r, bytes32 s, uint8 v) = splitSignature(_signature);
            address signer = ecrecover(ethSignedMessageHash, v, r, s);
            require(signer == _walletAddress, "Signer should be the wallet address");
        }

        // Check if the wallet address is a signer on the safe
        Workspace memory workspace = workspaces[_id];
        address safeAddress = address(uint160(uint256(workspace.safe._address)));
        require(safeAddress != address(0), "Safe not added");

        ISafe safeContract = ISafe(safeAddress);
        bool shouldAdd = false;
        if (_role == 0) {
            // Trying to add an admin. Need to check if they are a signer
            address[] memory owners = safeContract.getOwners();
            for (uint256 i = 0; i < owners.length; ++i) {
                if (owners[i] == _walletAddress) {
                    shouldAdd = true;
                    break;
                }
            }
        } else if (_role == 1) {
            // Trying to add a reviewer.
            // Need to check if they are in the list of reviewers on the guard contract
            address _guardAddress = getAddress(safeContract.getStorageAt(GUARD_OFFSET, 1));
            require(_guardAddress != address(0), "Guard is not set");
            ISafeGuard guard = ISafeGuard(_guardAddress);

            address[] memory reviewers = guard.getReviewers();
            for (uint256 i = 0; i < reviewers.length; ++i) {
                if (reviewers[i] == _walletAddress) {
                    shouldAdd = true;
                    break;
                }
            }
        }

        require(shouldAdd, "Neither a signer on the safe nor a reviewer on the guard");

        // Create mapping between wallet address and scw address
        eoaToScw[_walletAddress][_id] = msg.sender;

        // Add the person to the workspace
        bool isAdmin = workspace.owner == msg.sender || _checkRole(_id, msg.sender, 0);
        require(!isAdmin, "Already an admin");

        _setRole(_id, msg.sender, _role, true);

        emit WorkspaceMemberUpdated(_id, msg.sender, _role, true, _metadataHash, block.timestamp);
    }

    /**
     * @notice Check if an address is admin of specified workspace, can be called by anyone
     * @param _id ID of target workspace
     * @param _address Address to validate role
     * @return true if specified address is admin of provided workspace id, else false
     */
    function isWorkspaceAdmin(uint96 _id, address _address) external view override returns (bool) {
        return _checkRole(_id, _address, 0);
    }

    /**
     * @notice Check if an address is admin or reviewer of specified workspace, can be called by anyone
     * @param _id ID of target workspace
     * @param _address Address to validate role
     * @return true if specified address is admin or reviewer of provided workspace id, else false
     */
    function isWorkspaceAdminOrReviewer(uint96 _id, address _address) external view override returns (bool) {
        return _checkRole(_id, _address, 0) || _checkRole(_id, _address, 1);
    }

    /**
     * @notice Set role of an address for specified workspace, can be called internally
     * @param _workspaceId ID of target workspace
     * @param _address Address of the member whose role to set
     * @param _role Role to be set
     * @param _enabled Whether to enable or disable the role
     */
    function _setRole(uint96 _workspaceId, address _address, uint8 _role, bool _enabled) internal {
        Workspace memory workspace = workspaces[_workspaceId];

        /// @notice Do not allow anybody other than owner to set admin role false for workspace owner
        if (_address == workspace.owner && _enabled == false && msg.sender != workspace.owner) {
            revert("WorkspaceOwner: Cannot disable owner admin role");
        }
        if (_enabled) {
            /// @notice Set _role'th bit in roles of _address in workspace
            memberRoles[_workspaceId][_address] |= bytes32(1 << _role);
        } else {
            /// @notice Unset _role'th bit in roles of _address in workspace
            memberRoles[_workspaceId][_address] &= ~bytes32(1 << _role);
        }
    }

    /**
     * @notice Check role of an address for specified workspace, can be called internally
     * @param _workspaceId ID of target workspace
     * @param _address Address of the member whose role to set
     * @param _role Role to be set
     * @return true if specified address has that role in specified workspace, else false
     */
    function _checkRole(uint96 _workspaceId, address _address, uint8 _role) internal view returns (bool) {
        /// @notice Check if _address has _role'th bit set in roles of _address in workspace
        return (uint256(memberRoles[_workspaceId][_address]) >> _role) & 1 != 0;
    }

    /**
     * @notice Check's whether the user making the request is a QB admin, can be used internally
     * @return true if user making request is a QB admin, else false
     */
    function _isQBAdminPresent(address id) internal view returns (bool) {
        if (id == owner()) {
            return true;
        }

        for (uint256 i = 0; i < qbAdmins.length; i++) {
            if (id == qbAdmins[i]) {
                return true;
            }
        }

        return false;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function apiFlagForWorkspaceId(uint96 workspaceId, uint8 role) public pure returns (bytes32) {
        return keccak256(abi.encodePacked("workspace-invite-", abi.encodePacked(workspaceId), abi.encodePacked(role)));
    }

    /**
     * @notice Disburses grant reward, can be called by applicationRegistry contract
     * @param _applicationId application id for which the funds are disbursed
     * @param _applicantWalletAddress wallet address of the applicant to disburse rewards to
     * @param _milestoneId milestone id for which the funds are disbursed
     * @param _erc20Interface interface for erc20 asset using which rewards are disbursed
     * @param _amount amount disbursed
     * @param _workspaceId workspace that the application belongs to
     */
    function disburseRewardP2P(
        uint96 _applicationId,
        address _applicantWalletAddress,
        uint96 _milestoneId,
        IERC20 _erc20Interface,
        uint256 _amount,
        uint96 _workspaceId
    ) external onlyWorkspaceAdmin(_workspaceId) checkBalance(_erc20Interface, msg.sender, _amount) {
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
        console.log("Inside disburse reward");
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

    /**
     * @notice Emits event when funds disbursed through the safe
     * @param _applicationIds[] application id for which the funds are disbursed
     * @param _milestoneIds[] milestone id for which the funds are disbursed
     * @param _erc20Interface interface for erc20 asset using which rewards are disbursed
     * @param _tokenName array of names of token
     * @param nonEvmAssetAddress address of non-EVM asset that was disbusrsed
     * @param _amounts[] amount disbursed
     * @param _workspaceId workspace that the application belongs to
     * @param transactionHash safe transaction hash
     */
    function disburseRewardFromSafe(
        uint96[] memory _applicationIds,
        uint96[] memory _milestoneIds,
        IERC20 _erc20Interface,
        string memory _tokenName,
        string memory nonEvmAssetAddress,
        uint256[] memory _amounts,
        uint96 _workspaceId,
        string memory transactionHash
    ) external onlyWorkspaceAdmin(_workspaceId) {
        require(
            _applicationIds.length == _milestoneIds.length,
            "Error: applicationIds and milestoneIds length mismatch"
        );
        require(_applicationIds.length == _amounts.length, "Error: applicationIds and amounts length mismatch");
        emit DisburseRewardFromSafe(
            _applicationIds,
            _milestoneIds,
            address(_erc20Interface),
            _tokenName,
            nonEvmAssetAddress,
            transactionHash,
            msg.sender,
            _amounts,
            true,
            block.timestamp
        );
    }

    /**
     * @notice Emits event when funds disbursed through the external wallet
     * @param _applicationIds[] application id for which the funds are disbursed
     * @param _milestoneIds[] milestone id for which the funds are disbursed
     * @param _erc20Interface interface for erc20 asset using which rewards are disbursed
     * @param _tokenName array of names of token
     * @param nonEvmAssetAddress address of non-EVM asset that was disbusrsed
     * @param _amounts[] amount disbursed
     * @param _workspaceId workspace that the application belongs to
     * @param transactionHash wallet transaction hash
     */
    function disburseRewardFromWallet(
        uint96[] memory _applicationIds,
        uint96[] memory _milestoneIds,
        IERC20 _erc20Interface,
        string memory _tokenName,
        string memory nonEvmAssetAddress,
        uint256[] memory _amounts,
        uint96 _workspaceId,
        string memory transactionHash
    ) external onlyWorkspaceAdmin(_workspaceId) {
        require(
            _applicationIds.length == _milestoneIds.length,
            "Error: applicationIds and milestoneIds length mismatch"
        );
        require(_applicationIds.length == _amounts.length, "Error: applicationIds and amounts length mismatch");
        emit DisburseRewardFromWallet(
            _applicationIds,
            _milestoneIds,
            address(_erc20Interface),
            _tokenName,
            nonEvmAssetAddress,
            transactionHash,
            msg.sender,
            _amounts,
            true,
            block.timestamp
        );
    }

    /**
     * @notice Emits event when funds transfer transaction status is updated
     * @param _applicationId[] array of application id for which the transaction status is updated
     * @param _transactionHash[] array of transaction hashes of the transaction
     * @param _status array of status of each transaction
     * @param _tokenUSDValue array of USD value of token
     * @param _executionTimestamp array of timestamp of execution of transaction
     */
    function updateFundsTransferTransactionStatus(
        uint96[] calldata _applicationId,
        string[] calldata _transactionHash,
        string[] calldata _status,
        uint256[] calldata _tokenUSDValue,
        uint256[] calldata _executionTimestamp
    ) external onlyOwner {
        require(
            _applicationId.length == _transactionHash.length,
            "Error: applicationId and transactionHash length mismatch"
        );
        emit FundsTransferStatusUpdated(_applicationId, _transactionHash, _status, _tokenUSDValue, _executionTimestamp);
    }

    /**
     * @notice Emits event when some daos' visibility is updated by a QB admin
     * @param _workspaceIds workspaces whose visibility was updated
     * @param _isVisible isVisible booleans corresponding to the workspaceIds
     */
    function updateWorkspacesVisible(uint96[] memory _workspaceIds, bool[] memory _isVisible) external onlyQBAdmin {
        require(_workspaceIds.length == _isVisible.length, "Error: workspaceIds and isVisible length mismatch");

        emit WorkspacesVisibleUpdated(_workspaceIds, _isVisible);
    }

    function updateGrantsSection(
        address[] calldata _grantIds,
        string calldata _sectionName,
        string calldata _sectionLogoIpfsHash
    ) external onlyQBAdmin {
        emit GrantsSectionUpdated(_grantIds, _sectionName, _sectionLogoIpfsHash);
    }

    /**
     * @notice Allows an admin to add other admins
     * @param _addresses addresses of the admins to be added
     */
    function addQBAdmins(address[] memory _addresses) external onlyQBAdmin {
        require(_addresses.length != 0, "Error: addresses cannot be empty");

        for (uint256 i = 0; i < _addresses.length; i++) {
            address _address = _addresses[i];

            require(!_isQBAdminPresent(_address), "Admin already exists!");

            qbAdmins.push(_address);
        }

        emit QBAdminsUpdated(_addresses, true, block.timestamp);
    }

    /**
     * @notice Allows an admin to remove other admins
     * @param _addresses addresses of the admins to be removed
     */
    function removeQBAdmins(address[] memory _addresses) external onlyQBAdmin {
        require(_addresses.length != 0, "Error: addresses cannot be empty");

        for (uint256 i = 0; i < _addresses.length; i++) {
            address _address = _addresses[i];

            require(_isQBAdminPresent(_address), "Admin does not exist!");

            uint256 addressIdx;
            for (uint256 idx = 0; idx < qbAdmins.length; idx++) {
                if (_address == qbAdmins[idx]) {
                    addressIdx = idx;
                    break;
                }
            }

            delete qbAdmins[addressIdx];
            qbAdmins[addressIdx] = qbAdmins[qbAdmins.length - 1];
            qbAdmins.pop();
        }

        emit QBAdminsUpdated(_addresses, false, block.timestamp);
    }

    /**
     * @notice Returns the list of QB admins
     */
    function getQBAdmins() external view returns (address[] memory) {
        return qbAdmins;
    }
}
